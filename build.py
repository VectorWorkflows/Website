#!/usr/bin/env python3
"""
build.py: the static site builder for vectorworkflows.com

Hand-rolled on purpose. Python standard library only for the core build, so
it will still run in ten years. Pillow (image derivatives) and fontTools
(font calibration / subsetting) are optional and only used when present.

    python build.py                     build everything
    python build.py fonts               sync font folders, regenerate fonts.css + MANIFEST.md, validate
    python build.py fonts --calibrate   measure installed fonts, write metric-matched fallback overrides
                                        (needs: pip install fonttools brotli)
    python build.py fonts --subset      subset installed fonts to Latin, in place
                                        (needs: pip install fonttools brotli)
    python build.py check               validate the built output without writing anything
    python build.py serve [port]        serve the site root locally (default 8000)

Source layout (everything authored lives in /src):

    src/site.json        site-wide values: contact details, routes, socials
    src/fonts.json       webfont source of truth (folders, @font-face, manifest)
    src/css/             token file, cascade layers, components, page CSS
    src/js/              vanilla ES modules
    src/icons/           Phosphor Light SVGs, compiled into a per-page sprite
    src/partials/        shared chrome: layout, head, header, footer
    src/pages/           one file per page: front matter + HTML body

Template syntax (deliberately tiny):

    {{ key }}  {{ site.email }}      HTML-escaped value (dotted lookup)
    {{{ key }}}                      raw value
    {% include "header" %}           src/partials/header.html
    {% icon "arrow-up-right" %}      inline sprite reference (validated)
    {% if key %}…{% else %}…{% endif %}

Safety: the builder never writes, moves or deletes anything inside a
protected directory (/cutabove/ above all). It hashes every protected tree
before and after each build and fails loudly if a single byte changed.
It will not overwrite a file it did not create unless that page's front
matter says `replaces_legacy: true`.
"""
from __future__ import annotations

import gzip
import hashlib
import html
import json
import os
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
MANIFEST_FILE = ROOT / ".build-manifest.json"

# Directories the builder must never touch. site.json can add more.
ALWAYS_PROTECTED = {".git", ".github", ".claude", ".agents", "src", "node_modules", "cutabove"}

# CSS bundles. Cascade layers are declared first (layers.css), so the order
# files arrive in never changes which rule wins. Critical CSS is inlined in
# <head>; deferred CSS loads without blocking render.
CRITICAL_CSS = [
    "layers.css",
    "fonts.css",
    "tokens.css",
    "reset.css",
    "base.css",
    "layout.css",
    "components/button.css",
    "components/badge.css",
    "components/header.css",
    "utilities.css",
]
DEFERRED_CSS = [
    "components/card.css",
    "components/footer.css",
]
SITE_JS = ["chrome.js"]

CSS_WEIGHT_NAMES = {100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium",
                    600: "Semibold", 700: "Bold", 800: "ExtraBold", 900: "Black"}
FONT_EXTENSIONS = {".woff2", ".woff", ".ttf", ".otf", ".eot"}


class BuildError(Exception):
    pass


# ---------------------------------------------------------------------------
# Output guard
# ---------------------------------------------------------------------------

class Output:
    """Every write goes through here. Tracks what was written for the build
    manifest (stale-file cleanup) and refuses protected or legacy paths."""

    def __init__(self, protected: set[str]):
        self.protected = protected
        self.written: set[str] = set()
        self.previous = set(json.loads(MANIFEST_FILE.read_text("utf-8"))["files"]) if MANIFEST_FILE.exists() else set()

    def _check(self, rel: str) -> Path:
        target = (ROOT / rel).resolve()
        if ROOT not in target.parents:
            raise BuildError(f"refusing to write outside the site root: {rel}")
        top = target.relative_to(ROOT).parts[0]
        if top in self.protected:
            raise BuildError(f"refusing to write inside protected directory '{top}/': {rel}")
        return target

    def write(self, rel: str, data: str | bytes, *, allow_legacy: bool = False) -> None:
        rel = rel.replace("\\", "/")
        target = self._check(rel)
        if target.exists() and rel not in self.previous and not allow_legacy and not rel.startswith("assets/"):
            raise BuildError(
                f"{rel} exists but was not created by build.py. Set `replaces_legacy: true` "
                f"in the page's front matter to replace it deliberately.")
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, str):
            data = data.encode("utf-8")
        if not target.exists() or target.read_bytes() != data:
            target.write_bytes(data)
        self.written.add(rel)

    def keep(self, rel: str) -> None:
        """Mark a file as a build product without rewriting it (cached image derivatives)."""
        self.written.add(rel.replace("\\", "/"))

    def finish(self) -> list[str]:
        stale = sorted(self.previous - self.written)
        removed = []
        for rel in stale:
            try:
                target = self._check(rel)
            except BuildError:
                continue
            if target.is_file():
                target.unlink()
                removed.append(rel)
        MANIFEST_FILE.write_text(json.dumps({"files": sorted(self.written)}, indent=2) + "\n", "utf-8")
        return removed


def tree_hash(path: Path) -> tuple[int, str]:
    """Hash every file (path + bytes) beneath a directory."""
    h = hashlib.sha256()
    count = 0
    if path.exists():
        for f in sorted(p for p in path.rglob("*") if p.is_file()):
            h.update(f.relative_to(path).as_posix().encode())
            h.update(f.read_bytes())
            count += 1
    return count, h.hexdigest()


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_site() -> dict:
    site = json.loads((SRC / "site.json").read_text("utf-8"))
    site["whatsapp_url"] = (f"https://wa.me/{site['whatsapp_number']}?text="
                            + quote(site["whatsapp_text"], safe=""))
    return site


def protected_dirs(site: dict) -> set[str]:
    return ALWAYS_PROTECTED | set(site.get("protected_dirs", []))


# ---------------------------------------------------------------------------
# Fonts: folders, @font-face, manifest, validation
# ---------------------------------------------------------------------------

def load_fonts() -> dict:
    return json.loads((SRC / "fonts.json").read_text("utf-8"))


def face_dir(cfg: dict, fam: dict, face: dict) -> Path:
    return ROOT / cfg["root"] / fam["folder"] / face["folder"]


def face_url(cfg: dict, fam: dict, face: dict) -> str:
    return f"/{cfg['root']}/{fam['folder']}/{face['folder']}/{cfg['file']}"


def face_status(path: Path) -> tuple[str, bool]:
    if not path.exists():
        return "Missing (folder or placeholder absent)", False
    size = path.stat().st_size
    if size == 0:
        return "Awaiting licensed font file (placeholder, 0 bytes)", False
    with path.open("rb") as fh:
        magic = fh.read(4)
    if magic != b"wOF2":
        return f"INVALID: not a WOFF2 file ({size} bytes)", False
    return f"Installed ({size / 1024:.1f} kB)", True


def expected_folder(face: dict) -> str:
    name = CSS_WEIGHT_NAMES[face["weight"]]
    return f"{face['weight']}-{name}" + ("-Italic" if face["style"] == "italic" else "")


def sync_fonts(cfg: dict, out: Output | None = None, *, write: bool = True,
               protected: set[str] = frozenset(ALWAYS_PROTECTED)) -> dict:
    """Create folders + placeholders, regenerate fonts.css and MANIFEST.md,
    and validate the whole font setup. With write=False it only validates.
    Returns {"errors", "warnings", "installed"}."""
    errors, warnings, installed = [], [], {}
    seen = set()
    fonts_root = ROOT / cfg["root"]

    for fam in cfg["families"]:
        for face in fam["faces"]:
            key = (fam["family"], face["weight"], face["style"])
            if key in seen:
                errors.append(f"duplicate @font-face: {key}")
            seen.add(key)
            if face["folder"] != expected_folder(face):
                errors.append(f"{fam['family']} {face['style_name']}: folder '{face['folder']}' "
                              f"does not match CSS mapping '{expected_folder(face)}'")
            d = face_dir(cfg, fam, face)
            f = d / cfg["file"]
            if write:
                d.mkdir(parents=True, exist_ok=True)
                if not f.exists():
                    f.touch()  # placeholder: the licensed file replaces this, same name
            if not f.exists():
                errors.append(f"missing folder or placeholder: {f.relative_to(ROOT).as_posix()}")
            status, ok = face_status(f)
            if status.startswith("INVALID"):
                errors.append(f"{f.relative_to(ROOT).as_posix()}: {status}")
            installed[key] = ok

    # Nothing else may live in the font tree
    expected = {face_dir(cfg, fam, face) / cfg["file"] for fam in cfg["families"] for face in fam["faces"]}
    for p in fonts_root.rglob("*"):
        if p.is_file() and p not in expected and p.name != "MANIFEST.md":
            errors.append(f"unexpected file in font tree: {p.relative_to(ROOT).as_posix()}")
        if p.is_dir() and not any(p == e.parent or p in e.parents for e in expected):
            errors.append(f"undocumented font directory: {p.relative_to(ROOT).as_posix()}")

    # No font files anywhere else in the project (separate sites in protected
    # directories such as /cutabove/ are their own business and not scanned)
    for dirpath, dirnames, filenames in os.walk(ROOT):
        here = Path(dirpath)
        if here == ROOT:
            dirnames[:] = [d for d in dirnames if d not in (protected - {"src"})]
        if here == fonts_root or fonts_root in here.parents:
            continue
        for name in filenames:
            if Path(name).suffix.lower() in FONT_EXTENSIONS:
                errors.append(f"font file outside {cfg['root']}/: {(here / name).relative_to(ROOT).as_posix()}")

    # Font files may only be referenced from the generated fonts.css
    for css in (SRC / "css").rglob("*.css"):
        if css.name == "fonts.css":
            continue
        if re.search(r"url\([^)]*\.(woff2?|ttf|otf)", css.read_text("utf-8")):
            errors.append(f"font file referenced outside fonts.css: {css.relative_to(ROOT).as_posix()}")

    # Every declared family must be used by a token; every used family must be declared
    tokens = (SRC / "css" / "tokens.css").read_text("utf-8")
    declared = {fam["family"] for fam in cfg["families"]}
    fallbacks = {fam["fallback"]["family"] for fam in cfg["families"]}
    for fam in cfg["families"]:
        if f'"{fam["family"]}"' not in tokens:
            warnings.append(f"{fam['family']} is declared but no token references it (unnecessary download?)")
    for css in (SRC / "css").rglob("*.css"):
        if css.name == "fonts.css":
            continue
        for m in re.finditer(r'font-family:\s*([^;}]+)', css.read_text("utf-8")):
            for name in re.findall(r'"([^"]+)"', m.group(1)):
                if name not in declared | fallbacks:
                    errors.append(f"{css.name}: font-family \"{name}\" is not declared in fonts.json")
    all_css = "\n".join(p.read_text("utf-8") for p in (SRC / "css").rglob("*.css") if p.name != "fonts.css")
    if any(face["weight"] == 500 for fam in cfg["families"] for face in fam["faces"]) \
            and "--weight-medium" not in all_css.replace("--weight-medium:", ""):
        warnings.append("a 500 face is declared but --weight-medium is never used")

    if write:
        css = render_font_css(cfg)
        manifest = render_font_manifest(cfg)
        # src/css/fonts.css is generated but lives in src so the CSS bundler sees it
        with open(SRC / "css" / "fonts.css", "w", encoding="utf-8", newline="\n") as fh:
            fh.write(css)
        if out:
            out.write(f"{cfg['root']}/MANIFEST.md", manifest)
        else:
            with open(fonts_root / "MANIFEST.md", "w", encoding="utf-8", newline="\n") as fh:
                fh.write(manifest)
    elif render_font_css(cfg) != (SRC / "css" / "fonts.css").read_text("utf-8"):
        errors.append("src/css/fonts.css is out of date with src/fonts.json (run: python build.py fonts)")
    return {"errors": errors, "warnings": warnings, "installed": installed}


def render_font_css(cfg: dict) -> str:
    lines = [
        "/* GENERATED by build.py from src/fonts.json. Do not edit by hand.",
        "   Self-hosted, Latin-subset WOFF2, font-display: swap. Each real face is",
        "   paired with a metric-matched local fallback (size-adjust + ascent/descent",
        "   overrides) so the swap from fallback to webfont causes no layout shift. */",
        "",
    ]
    for fam in cfg["families"]:
        for face in fam["faces"]:
            lines += [
                "@font-face {",
                f'  font-family: "{fam["family"]}";',
                f'  src: url("{face_url(cfg, fam, face)}") format("woff2");',
                f"  font-weight: {face['weight']};",
                f"  font-style: {face['style']};",
                "  font-display: swap;",
                f"  unicode-range: {cfg['unicode_range']};",
                "}",
            ]
        fb = fam["fallback"]
        note = "calibrated from the installed font" if fb.get("calibrated") else \
            "PROVISIONAL: run `python build.py fonts --calibrate` once the font file is installed"
        styles = sorted({face["style"] for face in fam["faces"]})
        for style in styles:
            locals_ = fb["local"] if style == "normal" else [f"{fb['local'][0]} Italic"]
            src = ", ".join(f'local("{n}")' for n in locals_)
            lines += [
                f"/* {fb['family']} ({style}): {note} */",
                "@font-face {",
                f'  font-family: "{fb["family"]}";',
                f"  src: {src};",
                f"  font-style: {style};",
                f"  size-adjust: {fb['size_adjust']};",
                f"  ascent-override: {fb['ascent_override']};",
                f"  descent-override: {fb['descent_override']};",
                f"  line-gap-override: {fb['line_gap_override']};",
                "}",
            ]
        lines.append("")
    return "\n".join(lines)


def render_font_manifest(cfg: dict) -> str:
    out = [
        "# Font manifest",
        "",
        "Generated by `build.py` from `src/fonts.json`, so edit that file, not this one.",
        "Status reflects what is on disk at the last build.",
        "",
        "Rules: one family per folder, one weight/style per subfolder, one file per",
        "subfolder, always named `font.woff2`. `@font-face` rules are generated into",
        "`src/css/fonts.css`, the only place font files are referenced.",
        "",
    ]
    for fam in cfg["families"]:
        out += [f"## {fam['family']}", "", f"_{fam['terminology']}_", ""]
        for face in fam["faces"]:
            f = face_dir(cfg, fam, face) / cfg["file"]
            status, _ = face_status(f)
            out += [
                f"### {fam['family']} {face['style_name']}",
                "",
                f"- **Font family:** {fam['family']}",
                f"- **Foundry:** {fam['foundry']}",
                f"- **Role:** {fam['role']}",
                f"- **License/vendor:** {fam['foundry']} (licence arranged by the site owner)",
                f"- **Weight:** {face['style_name'].replace(' Italic', '')}",
                f"- **CSS weight:** {face['weight']}",
                f"- **Style:** {'Italic' if face['style'] == 'italic' else 'Normal'}",
                f"- **CSS style:** {face['style']}",
                f"- **Folder:** `{cfg['root']}/{fam['folder']}/{face['folder']}/`",
                f"- **Expected file:** `{cfg['file']}`",
                f"- **Used for:** {face['used_for']}",
                f"- **Preloaded:** {'yes (once installed)' if face.get('preload') else 'no'}",
                f"- **Status:** {status}",
                "",
            ]
        fb = fam["fallback"]
        out += [f"Fallback: `{fb['family']}` → local {', '.join(fb['local'])} "
                f"({'calibrated' if fb.get('calibrated') else 'provisional metrics'}), then {fb['generic']}.", ""]
    out += ["## Directory tree", "", "```", font_tree(cfg), "```", ""]
    return "\n".join(out)


def font_tree(cfg: dict) -> str:
    lines = [f"{cfg['root']}/", "├── MANIFEST.md"]
    fams = cfg["families"]
    for i, fam in enumerate(fams):
        last_fam = i == len(fams) - 1
        lines.append(f"{'└──' if last_fam else '├──'} {fam['folder']}/")
        for j, face in enumerate(fam["faces"]):
            last_face = j == len(fam["faces"]) - 1
            pre = "    " if last_fam else "│   "
            lines.append(f"{pre}{'└──' if last_face else '├──'} {face['folder']}/")
            lines.append(f"{pre}{'    ' if last_face else '│   '}└── {cfg['file']}")
    return "\n".join(lines)


# Letter-frequency-weighted sample for average advance width (the same idea
# next/font and Capsize use): representative English text, including spaces.
_METRIC_SAMPLE = ("the studio builds backend systems messaging bots telephony pipelines and "
                  "hand built websites for small service businesses that need to answer every "
                  "call book every job and follow up on every lead without manual work")

_FALLBACK_FILES = {
    "Times New Roman": ["C:/Windows/Fonts/times.ttf", "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
                        "/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf"],
    "Arial": ["C:/Windows/Fonts/arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf"],
    "Courier New": ["C:/Windows/Fonts/cour.ttf", "/System/Library/Fonts/Supplemental/Courier New.ttf",
                    "/usr/share/fonts/truetype/msttcorefonts/Courier_New.ttf"],
}


def _avg_advance(font) -> float:
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    widths = [hmtx[cmap[ord(ch)]][0] for ch in _METRIC_SAMPLE if ord(ch) in cmap]
    return sum(widths) / len(widths) / upm


def calibrate_fonts(cfg: dict) -> None:
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        raise BuildError("calibration needs fontTools + brotli:  pip install fonttools brotli")
    changed = False
    for fam in cfg["families"]:
        regular = next((f for f in fam["faces"] if f["style"] == "normal"), fam["faces"][0])
        path = face_dir(cfg, fam, regular) / cfg["file"]
        if not face_status(path)[1]:
            print(f"  skip {fam['family']}: {regular['style_name']} not installed yet")
            continue
        fb = fam["fallback"]
        fb_path = next((p for p in _FALLBACK_FILES.get(fb["local"][0], []) if Path(p).exists()), None)
        if not fb_path:
            print(f"  skip {fam['family']}: fallback font file for '{fb['local'][0]}' not found on this machine")
            continue
        web, local = TTFont(path), TTFont(fb_path)
        upm = web["head"].unitsPerEm
        hhea = web["hhea"]
        size_adjust = _avg_advance(web) / _avg_advance(local)
        fb.update({
            "size_adjust": f"{size_adjust * 100:.2f}%",
            "ascent_override": f"{hhea.ascent / upm / size_adjust * 100:.2f}%",
            "descent_override": f"{abs(hhea.descent) / upm / size_adjust * 100:.2f}%",
            "line_gap_override": f"{hhea.lineGap / upm / size_adjust * 100:.2f}%",
            "calibrated": True,
        })
        changed = True
        print(f"  {fam['family']}: size-adjust {fb['size_adjust']}, ascent {fb['ascent_override']}, "
              f"descent {fb['descent_override']}, line-gap {fb['line_gap_override']}")
    if changed:
        (SRC / "fonts.json").write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", "utf-8", newline="\n")


def subset_fonts(cfg: dict) -> None:
    try:
        from fontTools import subset
    except ImportError:
        raise BuildError("subsetting needs fontTools + brotli:  pip install fonttools brotli")
    unicodes = subset.parse_unicodes(cfg["unicode_range"].replace(" ", ""))
    for fam in cfg["families"]:
        for face in fam["faces"]:
            path = face_dir(cfg, fam, face) / cfg["file"]
            if not face_status(path)[1]:
                continue
            before = path.stat().st_size
            opts = subset.Options()
            opts.flavor = "woff2"
            opts.layout_features = ["*"]
            opts.name_IDs = ["*"]
            opts.notdef_outline = True
            font = subset.load_font(str(path), opts)
            s = subset.Subsetter(opts)
            s.populate(unicodes=unicodes)
            s.subset(font)
            subset.save_font(font, str(path), opts)  # in place: still one font.woff2 per folder
            print(f"  {fam['family']} {face['style_name']}: {before / 1024:.1f} → {path.stat().st_size / 1024:.1f} kB")


# ---------------------------------------------------------------------------
# Assets: CSS, JS, icons, images
# ---------------------------------------------------------------------------

_CSS_TOKENS = re.compile(r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')|/\*.*?\*/', re.S)


def minify_css(css: str) -> str:
    strings: list[str] = []

    # One left-to-right scan: whichever starts first, a string or a comment,
    # wins. (An apostrophe inside a comment must not open a "string".)
    def stash(m):
        if m.group(1) is None:
            return ""  # comment
        strings.append(m.group(1))
        return f"\x00{len(strings) - 1}\x00"

    css = _CSS_TOKENS.sub(stash, css)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};,])\s*", r"\1", css)
    css = css.replace(";}", "}")
    return re.sub(r"\x00(\d+)\x00", lambda m: strings[int(m.group(1))], css).strip()


def read_css(files: list[str]) -> str:
    parts = []
    for name in files:
        p = SRC / "css" / name
        if not p.exists():
            raise BuildError(f"missing CSS file: src/css/{name}")
        parts.append(p.read_text("utf-8"))
    return "\n".join(parts)


def short_hash(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()[:10]


def emit_hashed(out: Output, folder: str, stem: str, ext: str, data: str) -> str:
    rel = f"assets/{folder}/{stem}.{short_hash(data)}.{ext}"
    out.write(rel, data)
    return "/" + rel


def load_icons() -> dict[str, str]:
    icons = {}
    for svg in sorted((SRC / "icons").glob("*.svg")):
        text = svg.read_text("utf-8")
        vb = re.search(r'viewBox="([^"]+)"', text).group(1)
        inner = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", text, flags=re.S).strip()
        icons[svg.stem] = f'<symbol id="i-{svg.stem}" viewBox="{vb}">{inner}</symbol>'
    return icons


def build_images(out: Output, site: dict) -> dict:
    """Resized derivatives of the existing logo artwork (not a redesign: the
    same pixels, scaled for the web). Cached: regenerated only when missing
    or older than the source file."""
    info = {"mark_w": 41, "mark_h": 28, "have": False}
    try:
        from PIL import Image
    except ImportError:
        print("  ! Pillow not installed: skipping image derivatives (pip install pillow)")
        return info

    def fresh(rel: str, src: Path) -> bool:
        p = ROOT / rel
        return p.exists() and p.stat().st_mtime >= src.stat().st_mtime

    def target(rel: str) -> Path:
        path = out._check(rel)  # same guard as every other write
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    mark_src = ROOT / "logo_2.png"      # tight crop, transparent
    icon_src = ROOT / "logo_2a.png"     # padded, transparent
    brand = "assets/img/brand"
    with Image.open(mark_src) as im:
        im = im.convert("RGBA")
        im = im.crop(im.getbbox())
        ratio = im.width / im.height
        info.update(mark_w=round(28 * ratio), mark_h=28, have=True)
        for h in (28, 56, 84):
            w = round(h * ratio)
            for fmt, ext, kw in (("AVIF", "avif", {"quality": 70}), ("WEBP", "webp", {"quality": 86, "method": 6}),
                                 ("PNG", "png", {"optimize": True})):
                rel = f"{brand}/mark-{h}.{ext}"
                if not fresh(rel, mark_src):
                    im.resize((w, h), Image.LANCZOS).save(target(rel), fmt, **kw)
                out.keep(rel)

    with Image.open(icon_src) as im:
        im = im.convert("RGBA")
        im = im.crop(im.getbbox())
        side = round(max(im.size) * 1.12)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
        targets = {f"{brand}/icon-192.png": (192, None),
                   f"{brand}/apple-touch-icon.png": (180, site["theme_color"])}
        for rel, (size, bg) in targets.items():
            if not fresh(rel, icon_src):
                img = square.resize((size, size), Image.LANCZOS)
                if bg:
                    base = Image.new("RGBA", img.size, bg)
                    base.alpha_composite(img)
                    img = base.convert("RGB")
                img.save(target(rel), "PNG", optimize=True)
            out.keep(rel)
        if not fresh("favicon.ico", icon_src):
            square.save(target("favicon.ico"), "ICO", sizes=[(16, 16), (32, 32), (48, 48)])
        out.keep("favicon.ico")
    return info


def brand_mark_html(info: dict) -> str:
    h, w = info["mark_h"], info["mark_w"]
    b = "/assets/img/brand/mark"
    return (f'<picture>'
            f'<source type="image/avif" srcset="{b}-28.avif 1x, {b}-56.avif 2x, {b}-84.avif 3x">'
            f'<source type="image/webp" srcset="{b}-28.webp 1x, {b}-56.webp 2x, {b}-84.webp 3x">'
            f'<img class="brand__mark" src="{b}-56.png" width="{w}" height="{h}" alt="" decoding="async">'
            f'</picture>')


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

RE_INCLUDE = re.compile(r'{%\s*include\s+"([\w\-/]+)"\s*%}')
RE_IF = re.compile(r'{%\s*if\s+(not\s+)?([\w.]+)\s*%}((?:(?!{%\s*if\b).)*?){%\s*endif\s*%}', re.S)
RE_ICON = re.compile(r'{%\s*icon\s+"([\w\-]+)"(?:\s+class="([^"]*)")?\s*%}')
RE_VALUE = re.compile(r"{{{\s*([\w.]+)\s*}}}|{{\s*([\w.]+)\s*}}")


def lookup(ctx: dict, dotted: str, where: str, strict: bool = True):
    cur = ctx
    for part in dotted.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            if strict:
                raise BuildError(f"{where}: unknown template variable '{dotted}'")
            return None
    return cur


def render(text: str, ctx: dict, icons: dict, used: set, where: str, depth: int = 0) -> str:
    if depth > 8:
        raise BuildError(f"{where}: include depth exceeded (circular include?)")

    def include(m):
        p = SRC / "partials" / f"{m.group(1)}.html"
        if not p.exists():
            raise BuildError(f"{where}: missing partial '{m.group(1)}'")
        return render(p.read_text("utf-8"), ctx, icons, used, f"partials/{m.group(1)}.html", depth + 1)

    text = RE_INCLUDE.sub(include, text)

    def cond(m):
        negate, key, body = m.group(1), m.group(2), m.group(3)
        yes, _, no = body.partition("{% else %}")
        truthy = bool(lookup(ctx, key, where, strict=False))
        return yes if truthy != bool(negate) else no

    while RE_IF.search(text):
        text = RE_IF.sub(cond, text)

    def icon(m):
        name, extra = m.group(1), m.group(2)
        if name not in icons:
            raise BuildError(f"{where}: unknown icon '{name}' (add src/icons/{name}.svg)")
        used.add(name)
        cls = "icon" + (f" {extra}" if extra else "")
        return f'<svg class="{cls}" aria-hidden="true" focusable="false"><use href="#i-{name}"></use></svg>'

    text = RE_ICON.sub(icon, text)

    # One pass for raw and escaped values, so inserted content (page bodies,
    # CSS) is never re-scanned for template syntax.
    def value(m):
        if m.group(1):
            return str(lookup(ctx, m.group(1), where))
        return html.escape(str(lookup(ctx, m.group(2), where)), quote=True)

    return RE_VALUE.sub(value, text)


def parse_page(path: Path) -> tuple[dict, str]:
    text = path.read_text("utf-8")
    meta: dict = {}
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if line.strip() and not line.lstrip().startswith("#"):
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    for req in ("title", "description", "path"):
        if req not in meta:
            raise BuildError(f"{path.name}: front matter is missing '{req}'")
    return meta, text


def out_path_for(url_path: str) -> str:
    if url_path.endswith("/"):
        return (url_path.lstrip("/") + "index.html") or "index.html"
    return url_path.lstrip("/")


def split_list(value: str | None) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def gz_size(data: str | bytes) -> int:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return len(gzip.compress(data, compresslevel=9))


def build() -> int:
    site = load_site()
    protected = protected_dirs(site)
    guarded = {d: tree_hash(ROOT / d) for d in site.get("protected_dirs", [])}
    out = Output(protected)
    print("build.py: vectorworkflows.com")

    # Fonts
    fonts_cfg = load_fonts()
    font_report = sync_fonts(fonts_cfg, out, protected=protected)
    for e in font_report["errors"]:
        print(f"  ✗ font: {e}")
    for w in font_report["warnings"]:
        print(f"  ! font: {w}")
    if font_report["errors"]:
        raise BuildError("font validation failed")
    n_inst = sum(font_report["installed"].values())
    print(f"  fonts: {n_inst}/{len(font_report['installed'])} faces installed "
          f"(placeholders render the metric-matched fallback)")

    # Images
    img = build_images(out, site)

    # Shared CSS and JS
    critical_base = minify_css(read_css(CRITICAL_CSS))
    deferred_site = minify_css(read_css(DEFERRED_CSS))
    deferred_site_url = emit_hashed(out, "css", "site", "css", deferred_site)
    js_urls, js_bytes = {}, {}
    for name in SITE_JS + [p.name for p in (SRC / "js").glob("*.js") if p.name not in SITE_JS]:
        code = (SRC / "js" / name).read_text("utf-8")
        js_urls[name] = emit_hashed(out, "js", Path(name).stem, "js", code)
        js_bytes[js_urls[name]] = code

    preloads = ""
    for fam in fonts_cfg["families"]:
        for face in fam["faces"]:
            if face.get("preload") and font_report["installed"][(fam["family"], face["weight"], face["style"])]:
                preloads += (f'<link rel="preload" href="{face_url(fonts_cfg, fam, face)}" '
                             f'as="font" type="font/woff2" crossorigin>\n')

    icons = load_icons()
    pages = sorted((SRC / "pages").rglob("*.html"))
    built = []
    for page in pages:
        meta, body = parse_page(page)
        used: set[str] = set()
        where = f"pages/{page.relative_to(SRC / 'pages').as_posix()}"

        crit = critical_base + minify_css(read_css(split_list(meta.get("critical_css"))))
        deferred_urls = [deferred_site_url] + [
            emit_hashed(out, "css", Path(c).stem, "css", minify_css(read_css([c])))
            for c in split_list(meta.get("css"))]
        deferred_tags = "".join(
            f'<link rel="stylesheet" href="{u}" media="print" onload="this.media=\'all\'">\n'
            f'<noscript><link rel="stylesheet" href="{u}"></noscript>\n' for u in deferred_urls)
        page_js = SITE_JS + [f"{n}.js" if not n.endswith(".js") else n for n in split_list(meta.get("js"))]
        for n in page_js:
            if n not in js_urls:
                raise BuildError(f"{where}: unknown script '{n}'")
        scripts = "\n".join(f'<script type="module" src="{js_urls[n]}"></script>' for n in page_js)

        og_rel = f"assets/img/og/{meta.get('og_image', 'default')}.png"
        ctx = {
            **meta,
            "site": site,
            "canonical": site["url"] + meta["path"],
            "noindex": meta.get("robots", "index").startswith("noindex"),
            "og_type": meta.get("og_type", "website"),
            "og_image_url": f"{site['url']}/{og_rel}" if (ROOT / og_rel).exists() else "",
            "body_class": meta.get("body_class", ""),
            "preloads": preloads,
            "critical_css": crit,
            "deferred_css": deferred_tags,
            "scripts": scripts,
            "brand_mark": brand_mark_html(img),
            "font_status": font_status_html(fonts_cfg, font_report),
            "build_date": date.today().isoformat(),
        }
        content = render(body, ctx, icons, used, where)
        ctx["content"] = content
        doc = render((SRC / "partials" / "layout.html").read_text("utf-8"), ctx, icons, used, "partials/layout.html")

        # Current-page marker on every nav link that points here
        if meta.get("nav"):
            doc = doc.replace(f'data-nav="{meta["nav"]}"', f'data-nav="{meta["nav"]}" aria-current="page"')

        # Per-page sprite: only the icons this page actually uses
        sprite = ('<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" '
                  'style="position:absolute;width:0;height:0;overflow:hidden">'
                  + "".join(icons[n] for n in sorted(used)) + "</svg>")
        doc = doc.replace("<!--SPRITE-->", sprite)

        # Honest page weight: HTML (with inlined critical CSS) + deferred CSS + JS, gzipped
        weight = gz_size(doc) + sum(gz_size((ROOT / u.lstrip("/")).read_bytes()) for u in deferred_urls) \
            + sum(gz_size(js_bytes[js_urls[n]]) for n in page_js)
        doc = doc.replace("<!--PAGE_WEIGHT-->", f"{weight / 1024:.1f}&nbsp;kB")

        rel = out_path_for(meta["path"])
        out.write(rel, doc, allow_legacy=meta.get("replaces_legacy") == "true")
        built.append((meta, rel, weight))
        print(f"  page: /{rel:<28} {weight / 1024:6.1f} kB gz   icons: {len(used)}")

    write_seo_files(out, site, built)
    removed = out.finish()
    for r in removed:
        print(f"  removed stale: {r}")

    # Protected trees must be byte-identical
    for d, before in guarded.items():
        after = tree_hash(ROOT / d)
        if after != before:
            raise BuildError(f"PROTECTED DIRECTORY CHANGED: {d}/  ({before} → {after})")
        print(f"  guard: {d}/ untouched ({before[0]} files, sha256 {before[1][:12]}…)")

    problems = validate(site, [ROOT / rel for _, rel, _ in built])
    print(f"  done: {len(built)} page(s), {len(out.written)} files tracked")
    return 1 if problems else 0


def font_status_html(cfg: dict, report: dict) -> str:
    rows = []
    for fam in cfg["families"]:
        for face in fam["faces"]:
            ok = report["installed"][(fam["family"], face["weight"], face["style"])]
            rows.append(
                f'<li><span class="badge {"badge--live" if ok else "badge--quiet"}"><span class="badge__dot"></span>'
                f'{"Installed" if ok else "Awaiting file"}</span>'
                f'<span class="t-mono">{fam["folder"]}/{face["folder"]}/font.woff2</span></li>')
    return "\n".join(rows)


def write_seo_files(out: Output, site: dict, built: list) -> None:
    """robots.txt and sitemap.xml. Only written once at least one indexable
    page is built by this script, so the legacy site is never half-described."""
    indexable = [(m, rel) for m, rel, _ in built if not m.get("robots", "index").startswith("noindex")]
    if not indexable:
        return
    today = date.today().isoformat()
    urls = "\n".join(f"  <url><loc>{site['url']}{m['path']}</loc><lastmod>{today}</lastmod></url>"
                     for m, _ in sorted(indexable, key=lambda x: x[0]["path"]))
    out.write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n'
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n",
              allow_legacy=True)
    disallow = "".join(f"Disallow: /{d}/\n" for d in site.get("protected_dirs", []))
    out.write("robots.txt", f"User-agent: *\n{disallow}Disallow: /_preview.html\n\n"
              f"Sitemap: {site['url']}/sitemap.xml\n", allow_legacy=True)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate(site: dict, files: list[Path]) -> list[str]:
    problems, notes = [], []
    planned = set(site.get("planned_routes", []))
    for f in files:
        doc = f.read_text("utf-8")
        rel = f.relative_to(ROOT).as_posix()
        visible = re.sub(r"<(script|style)\b.*?</\1>", "", doc, flags=re.S)

        h1 = len(re.findall(r"<h1[\s>]", visible))
        if h1 != 1:
            problems.append(f"{rel}: {h1} <h1> elements (need exactly 1)")
        levels = [int(m) for m in re.findall(r"<h([1-6])[\s>]", visible)]
        for a, b in zip(levels, levels[1:]):
            if b > a + 1:
                problems.append(f"{rel}: heading level jumps h{a} → h{b}")
                break
        for tag in ("<title>", 'name="description"', 'rel="canonical"', '<main id="main"'):
            if tag not in doc:
                problems.append(f"{rel}: missing {tag}")
        for m in re.finditer(r"<img\b[^>]*>", visible):
            if "width=" not in m.group(0) or "height=" not in m.group(0):
                problems.append(f"{rel}: <img> without explicit width/height: {m.group(0)[:80]}")
        for m in re.finditer(r'<a\b[^>]*target="_blank"[^>]*>', visible):
            if "noopener" not in m.group(0):
                problems.append(f"{rel}: target=_blank without rel=noopener")
        ids = set(re.findall(r'\sid="([^"]+)"', doc))
        for href in set(re.findall(r'href="([^"]+)"', visible)):
            if href.startswith("#"):
                if href != "#" and href[1:] not in ids:
                    problems.append(f"{rel}: in-page anchor {href} has no target")
            elif href.startswith("/") and not href.startswith("//"):
                path = href.split("#")[0].split("?")[0]
                target = ROOT / (path.lstrip("/") + ("index.html" if path.endswith("/") else ""))
                if not target.exists():
                    if path in planned:
                        notes.append(path)
                    else:
                        problems.append(f"{rel}: broken internal link {href}")
    for p in problems:
        print(f"  ✗ {p}")
    if notes:
        print(f"  · planned routes not built yet (expected at this stage): {', '.join(sorted(set(notes)))}")
    return problems


def check() -> int:
    site = load_site()
    fonts_cfg = load_fonts()
    report = sync_fonts(fonts_cfg, write=False, protected=protected_dirs(site))
    for e in report["errors"]:
        print(f"  ✗ font: {e}")
    for w in report["warnings"]:
        print(f"  ! font: {w}")
    files = [ROOT / f for f in json.loads(MANIFEST_FILE.read_text("utf-8"))["files"]
             if f.endswith(".html")] if MANIFEST_FILE.exists() else []
    problems = validate(site, [f for f in files if f.exists()])
    ok = not problems and not report["errors"]
    print("  ✓ all checks passed" if ok else "  ✗ checks failed")
    return 0 if ok else 1


def serve(port: int) -> None:
    import functools
    import http.server
    import mimetypes
    mimetypes.add_type("font/woff2", ".woff2")
    mimetypes.add_type("image/avif", ".avif")
    mimetypes.add_type("text/javascript", ".js")
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving {ROOT} at http://127.0.0.1:{port}/  (preview: /_preview.html)")
        httpd.serve_forever()


def main(argv: list[str]) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    cmd = argv[1] if len(argv) > 1 else "build"
    try:
        if cmd == "build":
            return build()
        if cmd == "fonts":
            cfg = load_fonts()
            if "--calibrate" in argv:
                calibrate_fonts(cfg)
                cfg = load_fonts()
            if "--subset" in argv:
                subset_fonts(cfg)
            report = sync_fonts(cfg, protected=protected_dirs(load_site()))
            for e in report["errors"]:
                print(f"  ✗ {e}")
            for w in report["warnings"]:
                print(f"  ! {w}")
            print(font_tree(cfg))
            print(f"  {sum(report['installed'].values())}/{len(report['installed'])} faces installed")
            return 1 if report["errors"] else 0
        if cmd == "check":
            return check()
        if cmd == "serve":
            serve(int(argv[2]) if len(argv) > 2 else 8000)
            return 0
        print(__doc__)
        return 2
    except BuildError as e:
        print(f"  ✗ build failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
