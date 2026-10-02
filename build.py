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
    python build.py og                  render Open Graph / Twitter cards (1200×630 PNG) for every
                                        indexable page with headless Chrome, then rebuild to link them
                                        (re-run after installing new fonts)

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
DATA = ROOT / "data"
MANIFEST_FILE = ROOT / ".build-manifest.json"

# Directories the builder must never touch. site.json can add more.
ALWAYS_PROTECTED = {".git", ".github", ".claude", ".agents", "src", "data", "node_modules", "cutabove"}

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
    "components/sys-index.css",
    "components/concept.css",
    "components/cursor.css",
]
SITE_JS = ["chrome.js", "motion.js", "cursor.js"]
# Third-party libraries, self-hosted. motion.js loads them on demand (only
# when motion is allowed), so they never block rendering. Their hashed URLs
# are injected into any script containing the __VENDOR_MAP__ token.
VENDOR_JS = {
    "gsap": "gsap.min.js",
    "ScrollTrigger": "ScrollTrigger.min.js",
    "SplitText": "SplitText.min.js",
    "Lenis": "lenis.min.js",
}

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
    # Templates can't index lists: site.sys.missed_lead_responder.name etc.
    site["sys"] = {s["slug"].replace("-", "_"): s for s in site["systems"]}
    # Booking notice: chrome.js turns the fallback into an exact local time
    hours = json.loads((DATA / "booking.json").read_text("utf-8"))["minNoticeHours"]
    site["booking"] = {"hours": hours,
                       "fallback": f"Pick a slot at least {hours} hour{'' if hours == 1 else 's'} from now"}
    return site


def protected_dirs(site: dict) -> set[str]:
    return ALWAYS_PROTECTED | set(site.get("protected_dirs", []))


# ---------------------------------------------------------------------------
# Pricing: data/pricing.json is the only place a price, the launch end date or
# a build time is written. Pages read the values this attaches to the site.
# ---------------------------------------------------------------------------

_NUM_WORDS = {2: "two", 3: "three", 4: "four", 5: "five"}


def rupees(n: int) -> str:
    """Indian digit grouping: 2999 → ₹2,999; 125000 → ₹1,25,000."""
    s = str(int(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = ",".join([head[max(0, i - 2):i] for i in range(len(head), 0, -2)][::-1])
        s = f"{head},{tail}"
    return f"₹{s}"


class Quoter:
    """Prices a selection of services. src/js/pricing.js runs the same rules
    in the browser; both read only data/pricing.json.

    The first system is at its full price, each further system at its bundle
    rate, or at the add-on rate when it builds on a system that's being paid
    for. Setups are at their own price, or the setup add-on rate alongside a
    related system. The cheapest valid arrangement wins."""

    def __init__(self, p: dict, launch: bool):
        self.p = p
        self.launch = launch
        self.order = list(p["services"])
        self.tier = {slug: p["tiers"][e["tier"]] for slug, e in p["services"].items()}
        self.related: dict[str, list[str]] = {s: [] for s in self.order}
        for a, b in p["related"]:
            if a not in self.tier or b not in self.tier:
                raise BuildError(f"data/pricing.json: related pair {a} / {b} names an unknown service")
            self.related[a].append(b)
            self.related[b].append(a)

    def kind(self, slug: str) -> str:
        return self.tier[slug]["kind"]

    def own(self, slug: str) -> int:
        t = self.tier[slug]
        return t["launch"] if self.launch else t["standard"]

    def standard(self, slug: str) -> int:
        return self.tier[slug]["standard"]

    def bundle(self, slug: str) -> int:
        """A further system's rate, written out for both periods in the data."""
        return self.tier[slug]["bundle"]["launch" if self.launch else "standard"]

    def hosts(self, slug: str) -> list[str]:
        """Systems this service can be added on to, in menu order. A host is
        never cheaper on its own than what rides on it (so a phone service
        can't be added on to a standard system for less than it costs alone).
        A service marked never_addon (the website) is always a main build."""
        if self.p["services"][slug].get("never_addon"):
            return []
        return [s for s in self.order if s in self.related[slug] and self.kind(s) == "system"
                and self.standard(s) >= self.standard(slug)]

    def quote(self, slugs: list[str]) -> dict:
        picked = [s for s in self.order if s in slugs]
        best = None
        for mask in range(1, 1 << len(picked)):
            paid = [s for i, s in enumerate(picked) if mask >> i & 1]
            systems = [s for s in paid if self.kind(s) == "system"]
            # The system with the smallest step down to its bundle rate pays in full
            anchor = min(systems, key=lambda s: self.own(s) - self.bundle(s)) if systems else None
            lines, ok = [], True
            for s in picked:
                if s in paid:
                    if self.kind(s) == "setup" or s == anchor:
                        lines.append({"slug": s, "price": self.own(s), "basis": "own", "via": ""})
                    else:
                        lines.append({"slug": s, "price": self.bundle(s), "basis": "bundle", "via": ""})
                    continue
                via = next((h for h in self.hosts(s) if h in paid), None)
                if not via:
                    ok = False
                    break
                lines.append({"slug": s, "price": self.p["addon"][self.kind(s)], "basis": "addon", "via": via})
            if not ok:
                continue
            total = sum(line["price"] for line in lines)
            if best is None or total < best["total"]:
                best = {"total": total, "lines": lines}
        if best is None:
            return {"total": 0, "lines": [], "own": 0, "standard": 0}
        best["own"] = sum(self.own(s) for s in picked)
        best["standard"] = sum(self.standard(s) for s in picked)
        return best


def _join_or(names: list[str]) -> str:
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} or {names[-1]}"


def load_pricing(site: dict, today: date | None = None) -> dict:
    """Attach prices to every service in site['service_groups'] and return the
    page-level pricing context. After launch_end only standard prices render."""
    p = json.loads((DATA / "pricing.json").read_text("utf-8"))
    end = date.fromisoformat(p["launch_end"])
    launch = (today or date.today()) <= end
    tiers = p["tiers"]
    q = Quoter(p, launch)
    q_std = Quoter(p, False)

    menu_slugs = [s["slug"] for g in site["service_groups"] for s in g["services"]]
    if sorted(menu_slugs) != sorted(p["services"]):
        missing = set(menu_slugs) ^ set(p["services"])
        raise BuildError(f"data/pricing.json and src/site.json list different services: {sorted(missing)}")
    names = {s["slug"]: s["name"] for g in site["service_groups"] for s in g["services"]}
    short = {s["slug"]: s.get("short", s["name"]) for g in site["service_groups"] for s in g["services"]}

    js_services = {}
    for g in site["service_groups"]:
        for s in g["services"]:
            entry = p["services"][s["slug"]]
            tier = tiers[entry["tier"]]
            days = entry.get("days", tier["days"])
            hosts = q.hosts(s["slug"])
            s["tier"] = entry["tier"]
            s["price"] = {
                "now": rupees(q.own(s["slug"])),
                "was": rupees(tier["standard"]) if launch else "",
                "value": q.own(s["slug"]),
                # "Get it for only ₹N with the X or Y (instead of ₹own)"
                "addon": rupees(p["addon"][tier["kind"]]) if hosts else "",
                "addon_with": f"with the {_join_or([short[h] for h in hosts])}" if hosts else "",
                "ready": f"Ready in under {days} days, once we have your details.",
                "days": days,
            }
            s["condition_text"] = site["conditions"].get(s.get("condition", ""), "")
            js_services[s["slug"]] = {
                "name": s["name"], "short": short[s["slug"]], "kind": tier["kind"],
                "neverAddon": bool(entry.get("never_addon")),
                "now": q.own(s["slug"]), "standard": tier["standard"],
                "bundle": q.bundle(s["slug"]) if tier["kind"] == "system" else None,
            }
        g["from"] = rupees(min(s["price"]["value"] for s in g["services"]))
        g["count_label"] = f"{len(g['services'])} services"

    for sysm in site["systems"]:
        sysm["related"] = [s for g in site["service_groups"] for s in g["services"] if s.get("case") == sysm["slug"]]
        for s in sysm["related"]:
            s["case_name"] = sysm["name"]
    unknown = [s["case"] for g in site["service_groups"] for s in g["services"]
               if s.get("case") and not s.get("case_name")]
    if unknown:
        raise BuildError(f"src/site.json: services point at unknown case studies {unknown}")

    # Packs: named combinations, priced by the same rules as any selection
    packs = []
    for pack in p["packs"]:
        if any(s not in names for s in pack["services"]):
            raise BuildError(f"data/pricing.json: pack '{pack['id']}' names an unknown service")
        quote_now = q.quote(pack["services"])
        packs.append({
            "id": pack["id"],
            "name": pack["name"],
            "featured": pack.get("featured", False),
            "services": [names[s] for s in pack["services"]],
            "label": " + ".join(names[s] for s in pack["services"]),
            "slugs": ",".join(pack["services"]),
            "price": rupees(quote_now["total"]),
            "was": rupees(q_std.quote(pack["services"])["total"]) if launch else "",
            "own": rupees(quote_now["own"]),
            "value": quote_now["total"],
        })
    starter = next(pk for pk in packs if pk["featured"])
    for g in site["service_groups"]:
        for s in g["services"]:
            if s.get("featured"):
                s["pack"] = starter

    add = p["addon"]
    period = "launch" if launch else "standard"
    std_bundle, phone_bundle = tiers["standard"]["bundle"][period], tiers["phone"]["bundle"][period]
    pricing = {
        "launch": launch,
        "launch_label": f"Launch pricing until {end.day} {end:%B %Y}",
        "launch_end": p["launch_end"],
        # The rules in owner language, from the data. rules[] is the full set
        # (services page); bundle_rule is the one-line version.
        "rules": [
            {"k": "First system", "v": "At its own price"},
            {"k": "Each further system", "v": f"{rupees(std_bundle)} (phone services {rupees(phone_bundle)})"},
            {"k": "A related system", "v": f"Only {rupees(add['system'])} with one you've picked"},
            {"k": "Google or WhatsApp setup", "v": f"Only {rupees(add['setup'])} with a related system"},
        ],
        "bundle_rule": (f"Pick more than one and the rest cost less: only {rupees(add['system'])} for a system "
                        f"that builds on one you've picked, only {rupees(add['setup'])} for a related setup, "
                        f"otherwise {rupees(std_bundle)} (phone services {rupees(phone_bundle)})."),
        "talk_rule": (f"Taking {_NUM_WORDS.get(p['talk_from'], p['talk_from'])} or more? Once we've gone through "
                      "exactly what you need, the price can come down from here."),
        "talk_tag": f"{p['talk_from']}+ services",
        "packs": packs,
        "starter": starter,
        "included": p["included_year_one"],
        "care_monthly": rupees(p["care_plan"]["monthly"]),
        "care_yearly": rupees(p["care_plan"]["yearly"]),
        "usage_note": p["usage_note"],
        "from": rupees(min(q.own(s) for s in p["services"] if q.kind(s) == "system")),
    }
    # What the browser needs to quote a selection (shared by /start and /services)
    pricing["json"] = json.dumps({
        "launch": launch,
        "order": q.order,
        "services": js_services,
        "addon": p["addon"],
        "related": p["related"],
        "packs": [{"id": pk["id"], "name": pk["name"], "services": pk["services"]} for pk in p["packs"]],
        "talkFrom": p["talk_from"],
    }, ensure_ascii=False, separators=(",", ":"))
    return pricing


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
        pin = fam.get("metrics")
        if pin:
            lines.append(f"/* {fam['family']}: vertical metrics pinned so every platform lays it out alike ({pin['reason']}) */")
        for face in fam["faces"]:
            lines += [
                "@font-face {",
                f'  font-family: "{fam["family"]}";',
                f'  src: url("{face_url(cfg, fam, face)}") format("woff2");',
                f"  font-weight: {face['weight']};",
                f"  font-style: {face['style']};",
                "  font-display: swap;",
                f"  unicode-range: {cfg['unicode_range']};",
            ]
            if pin:
                lines += [f"  ascent-override: {pin['ascent_override']};",
                          f"  descent-override: {pin['descent_override']};",
                          f"  line-gap-override: {pin['line_gap_override']};"]
            lines.append("}")
        fb = fam["fallback"]
        note = "calibrated from the installed font" if fb.get("calibrated") else \
            "PROVISIONAL: run `python build.py fonts --calibrate` once the font file is installed"
        # One fallback per real face: each weight and style sets its own
        # width, so each gets its own size-adjust (family values until measured)
        for face in fam["faces"]:
            style = face["style"]
            locals_ = fb["local"] if style == "normal" else [f"{fb['local'][0]} Italic"]
            src = ", ".join(f'local("{n}")' for n in locals_)
            m = fb.get("faces", {}).get(f"{face['weight']}-{style}") or fb
            lines += [
                f"/* {fb['family']} ({face['style_name']}): {note} */",
                "@font-face {",
                f'  font-family: "{fb["family"]}";',
                f"  src: {src};",
                f"  font-weight: {face['weight']};",
                f"  font-style: {style};",
                f"  size-adjust: {m['size_adjust']};",
                f"  ascent-override: {m['ascent_override']};",
                f"  descent-override: {m['descent_override']};",
                f"  line-gap-override: {m['line_gap_override']};",
                "}",
            ]
        lines.append("")
    # `ch` is the width of "0" in whichever font is showing, so a measure in ch
    # changes when the fallback swaps for the webfont. These tokens hold the
    # webfont's "0" in em, which resolves the same before and after the swap.
    lines += ["/* Font-independent character units: the installed face's \"0\" width */", ":root {"]
    for fam in cfg["families"]:
        role = fam["token"].removeprefix("--font-")
        lines.append(f"  --ch-{role}: {fam.get('zero_em', 0.55)}em;")
    lines += ["}", ""]
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


_FALLBACK_FILES = {
    "Times New Roman": ["C:/Windows/Fonts/times.ttf", "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
                        "/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf"],
    "Arial": ["C:/Windows/Fonts/arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf"],
    "Courier New": ["C:/Windows/Fonts/cour.ttf", "/System/Library/Fonts/Supplemental/Courier New.ttf",
                    "/usr/share/fonts/truetype/msttcorefonts/Courier_New.ttf"],
    "Times New Roman Italic": ["C:/Windows/Fonts/timesi.ttf", "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf",
                               "/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman_Italic.ttf"],
    "Arial Italic": ["C:/Windows/Fonts/ariali.ttf", "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
                     "/usr/share/fonts/truetype/msttcorefonts/Arial_Italic.ttf"],
    "Courier New Italic": ["C:/Windows/Fonts/couri.ttf", "/System/Library/Fonts/Supplemental/Courier New Italic.ttf",
                           "/usr/share/fonts/truetype/msttcorefonts/Courier_New_Italic.ttf"],
}


def _vertical_metrics(font) -> tuple[float, float, float, str | None]:
    """(ascent, descent, line gap) in em, plus a reason when the font must be
    pinned. macOS and Android lay text out from hhea; Windows uses OS/2 win
    (or typo with USE_TYPO_METRICS). When hhea is unusable (its ascent is
    shorter than the capitals) the platforms disagree by a large margin, so we
    take the win values and pin them in @font-face for every platform."""
    upm = font["head"].unitsPerEm
    hhea, os2 = font["hhea"], font["OS/2"]
    cap = getattr(os2, "sCapHeight", 0) or 0
    if hhea.ascent < cap:
        return os2.usWinAscent / upm, os2.usWinDescent / upm, 0.0, \
            f"hhea ascent {hhea.ascent} is below cap height {cap}; pinned to OS/2 win {os2.usWinAscent}/{os2.usWinDescent}"
    return hhea.ascent / upm, abs(hhea.descent) / upm, hhea.lineGap / upm, None


def _site_copy(headings: bool = False) -> str:
    """The site's own words (page bodies, tags and template syntax stripped):
    the text fallbacks actually have to match, capitals and punctuation included.
    headings=True keeps only h1-h3 text plus the system names that become case
    study titles: the display face sets nothing else, and short title-case
    lines weigh capitals far more than running copy does."""
    text = " ".join(re.sub(r"^---.*?---", "", p.read_text("utf-8"), flags=re.S)
                    for p in sorted((SRC / "pages").rglob("*.html")))
    if headings:
        text = " ".join(re.findall(r"<h[1-3]\b[^>]*>(.*?)</h[1-3]>", text, flags=re.S)
                        + [s["name"] for s in load_site()["systems"]])
    text = re.sub(r"<(script|style)\b.*?</\1>|{%.*?%}|{{.*?}}|<[^>]+>", " ", text, flags=re.S)
    return " ".join(html.unescape(text).split())


def _text_width(font, text: str) -> float:
    """Width of `text` in em. Shaped with HarfBuzz (kerning, ligatures) when
    uharfbuzz is installed, otherwise summed advances."""
    upm = font["head"].unitsPerEm
    try:
        import io
        import uharfbuzz as hb
    except ImportError:
        cmap, hmtx = font.getBestCmap(), font["hmtx"]
        return sum(hmtx[cmap[ord(c)]][0] for c in text if ord(c) in cmap) / upm
    raw = io.BytesIO()
    font.flavor = None  # woff2 -> plain sfnt for HarfBuzz
    font.save(raw)
    hb_font = hb.Font(hb.Face(raw.getvalue()))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {"kern": True, "liga": True})
    return sum(g.x_advance for g in buf.glyph_positions) / upm


def calibrate_fonts(cfg: dict) -> None:
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        raise BuildError("calibration needs fontTools + brotli:  pip install fonttools brotli")
    copy, headings = _site_copy(), _site_copy(headings=True)
    local_widths: dict[tuple[str, bool], float] = {}

    def measure(web_path: Path, local_name: str, display: bool) -> dict | None:
        corpus = headings if display else copy
        fb_path = next((p for p in _FALLBACK_FILES.get(local_name, []) if Path(p).exists()), None)
        if not fb_path:
            print(f"  skip: fallback font file for '{local_name}' not found on this machine")
            return None
        if (local_name, display) not in local_widths:
            local_widths[local_name, display] = _text_width(TTFont(fb_path), corpus)
        web = TTFont(web_path)
        ascent, descent, gap, _ = _vertical_metrics(web)
        size_adjust = _text_width(web, corpus) / local_widths[local_name, display]
        return {
            "size_adjust": f"{size_adjust * 100:.2f}%",
            "ascent_override": f"{ascent / size_adjust * 100:.2f}%",
            "descent_override": f"{descent / size_adjust * 100:.2f}%",
            "line_gap_override": f"{gap / size_adjust * 100:.2f}%",
        }

    changed = False
    for fam in cfg["families"]:
        fb = fam["fallback"]
        regular = next((f for f in fam["faces"] if f["style"] == "normal"), fam["faces"][0])
        path = face_dir(cfg, fam, regular) / cfg["file"]
        if not face_status(path)[1]:
            print(f"  skip {fam['family']}: {regular['style_name']} not installed yet")
            continue
        ascent, descent, gap, reason = _vertical_metrics(TTFont(path))
        if reason:
            fam["metrics"] = {"ascent_override": f"{ascent * 100:.2f}%", "descent_override": f"{descent * 100:.2f}%",
                              "line_gap_override": f"{gap * 100:.2f}%", "reason": reason}
            print(f"  {fam['family']}: {reason}")
        else:
            fam.pop("metrics", None)
        # Each weight and style sets its own width against the one local
        # fallback, so each real face gets its own fallback @font-face.
        fb.pop("italic", None)
        faces = {}
        for face in fam["faces"]:
            f = face_dir(cfg, fam, face) / cfg["file"]
            if not face_status(f)[1]:
                continue
            local = fb["local"][0] + (" Italic" if face["style"] == "italic" else "")
            m = measure(f, local, display=fam["token"] == "--font-display")
            if m:
                faces[f"{face['weight']}-{face['style']}"] = m
                print(f"  {fam['family']} {face['style_name']}: size-adjust {m['size_adjust']}, "
                      f"ascent {m['ascent_override']}, descent {m['descent_override']}")
        if not faces:
            continue
        fb["faces"] = faces
        # Width of "0" in em: what `ch` means in this font. Measures are set
        # with --ch-* tokens built from it, so they don't jump at the swap.
        web = TTFont(path)
        fam["zero_em"] = round(web["hmtx"][web.getBestCmap()[ord("0")]][0] / web["head"].unitsPerEm, 4)
        fb.update(faces.get(f"{regular['weight']}-normal") or next(iter(faces.values())), calibrated=True)
        changed = True
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

    # Studio portrait: 4:5 crop, a little desaturated, with a faint violet-to-
    # ink wash so it sits in the palette. Two sizes, AVIF + WebP + JPEG.
    portrait_src = ROOT / "assets/img/sam-portrait.jpg"
    if portrait_src.exists():
        from PIL import ImageEnhance
        sizes = (400, 720)
        rels = [f"assets/img/studio/sam-{w}.{ext}" for w in sizes for ext in ("avif", "webp", "jpg")]
        if not all(fresh(r, portrait_src) for r in rels):
            with Image.open(portrait_src) as im:
                im = im.convert("RGB")
                w, h = im.size
                cw = min(w, round(h * 4 / 5))
                ch = round(cw * 5 / 4)
                left, top = (w - cw) // 2, max(0, (h - ch) // 2)
                im = im.crop((left, top, left + cw, top + ch))
                im = ImageEnhance.Color(im).enhance(0.72)
                im = ImageEnhance.Brightness(im).enhance(0.93)
                # Vertical wash: violet at the top, ink towards the bottom
                wash = Image.new("RGBA", im.size)
                violet, ink = (103, 86, 185), (11, 11, 15)
                px = wash.load()
                for y in range(im.height):
                    k = y / (im.height - 1)
                    col = tuple(round(violet[i] + (ink[i] - violet[i]) * k) for i in range(3))
                    alpha = round(255 * (0.13 + 0.17 * k))
                    for x in range(im.width):
                        px[x, y] = (*col, alpha)
                im = Image.alpha_composite(im.convert("RGBA"), wash).convert("RGB")
                for size in sizes:
                    frame = im.resize((size, round(size * 5 / 4)), Image.LANCZOS)
                    frame.save(target(f"assets/img/studio/sam-{size}.avif"), "AVIF", quality=62)
                    frame.save(target(f"assets/img/studio/sam-{size}.webp"), "WEBP", quality=80, method=6)
                    frame.save(target(f"assets/img/studio/sam-{size}.jpg"), "JPEG", quality=82, optimize=True, progressive=True)
        for r in rels:
            out.keep(r)
        info["portrait"] = True

    # Digitora (studio timeline): the 2024 mobile screenshot, shown small in a
    # phone frame. Two widths for 1x and 2x of a 220-280 px frame.
    digitora_src = ROOT / "assets/img/digitora-2024.webp"
    if digitora_src.exists():
        with Image.open(digitora_src) as im:
            im = im.convert("RGB")
            ratio = im.height / im.width
            info["digitora"] = {"w": DIGITORA_SIZES[0], "h": round(DIGITORA_SIZES[0] * ratio)}
            for size in DIGITORA_SIZES:
                for fmt, ext, kw in (("AVIF", "avif", {"quality": 60}), ("WEBP", "webp", {"quality": 78, "method": 6})):
                    rel = f"assets/img/studio/digitora-{size}.{ext}"
                    if not fresh(rel, digitora_src):
                        im.resize((size, round(size * ratio)), Image.LANCZOS).save(target(rel), fmt, **kw)
                    out.keep(rel)
    return info


DIGITORA_SIZES = (280, 560)


def digitora_html(info: dict) -> str:
    """Lazy, with explicit dimensions; the frame is 220 px (phones) to 280 px wide."""
    b = "/assets/img/studio/digitora"
    small, large = DIGITORA_SIZES
    sizes = "(min-width: 64rem) 264px, 204px"
    return ('<picture>'
            f'<source type="image/avif" srcset="{b}-{small}.avif {small}w, {b}-{large}.avif {large}w" sizes="{sizes}">'
            f'<img class="phone__img" src="{b}-{small}.webp" srcset="{b}-{small}.webp {small}w, {b}-{large}.webp {large}w" '
            f'sizes="{sizes}" width="{info["w"]}" height="{info["h"]}" '
            'alt="Digitora\'s home page on mobile, 2024" loading="lazy" decoding="async">'
            '</picture>')


def portrait_html() -> str:
    # The frame is at most 24rem wide, and the page gutters bound it on phones
    b = "/assets/img/studio/sam"
    sizes = "(min-width: 64rem) 24rem, min(24rem, calc(100vw - 2.5rem))"
    return ('<picture>'
            f'<source type="image/avif" srcset="{b}-400.avif 400w, {b}-720.avif 720w" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{b}-400.webp 400w, {b}-720.webp 720w" sizes="{sizes}">'
            f'<img class="portrait__img" src="{b}-400.jpg" width="400" height="500" '
            'alt="Sameer Bhardwaj, founder of Vector Workflows" decoding="async" fetchpriority="high">'
            '</picture>')


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
RE_REPLAY = re.compile(r'{%\s*replay\s+"([\w\-]+)"(?:\s+id="([\w\-]+)")?(?:\s+view="(customer|owner|story)")?\s*%}')
RE_LOGREEL = re.compile(r'{%\s*logreel\s+"([\w\-, ]+)"\s*%}')


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


RE_RISE = re.compile(r"{%\s*rise\s*%}(.*?){%\s*endrise\s*%}", re.S)


def rise_words(src: str) -> str:
    """Wrap each word in a masking box for the CSS word-rise reveal:
    <span class="w"><span style="--i:n">word</span></span>. Words inside
    <em>…</em> keep their emphasis. Spaces between boxes stay real spaces."""
    out, italic = [], False
    for i, token in enumerate(src.split()):
        opens, closes = "<em>" in token, "</em>" in token
        word = token.replace("<em>", "").replace("</em>", "")
        italic = italic or opens
        inner = f"<em>{word}</em>" if italic else word
        out.append(f'<span class="w"><span style="--i:{i}">{inner}</span></span>')
        if closes:
            italic = False
    return " ".join(out)


RE_FOR_OPEN = re.compile(r"{%\s*for\s+(\w+)\s+in\s+([\w.]+)\s*%}")
RE_FOR_TAG = re.compile(r"{%\s*(for\s+\w+\s+in\s+[\w.]+|endfor)\s*%}")


def expand_loops(text: str, ctx: dict, icons: dict, used: set, where: str, depth: int) -> str:
    """{% for x in list %}…{% endfor %}, outermost first so nested loops can
    see the outer variable. Inside: {{ x }}, {{ x.key }}, loop.num (01, 02…),
    loop.index (1-based), loop.first, loop.last."""
    while (m := RE_FOR_OPEN.search(text)):
        level, pos = 1, m.end()
        while level:
            tag = RE_FOR_TAG.search(text, pos)
            if not tag:
                raise BuildError(f"{where}: unclosed {{% for %}}")
            level += -1 if tag.group(1) == "endfor" else 1
            pos = tag.end()
        body = text[m.end():tag.start()]
        items = lookup(ctx, m.group(2), where)
        out = []
        for i, item in enumerate(items):
            loop = {"index": i + 1, "num": f"{i + 1:02d}", "first": i == 0, "last": i == len(items) - 1}
            out.append(render(body, {**ctx, m.group(1): item, "loop": loop}, icons, used, where, depth + 1))
        text = text[:m.start()] + "".join(out) + text[pos:]
    return text


def render(text: str, ctx: dict, icons: dict, used: set, where: str, depth: int = 0) -> str:
    if depth > 8:
        raise BuildError(f"{where}: include depth exceeded (circular include?)")

    def include(m):
        p = SRC / "partials" / f"{m.group(1)}.html"
        if not p.exists():
            raise BuildError(f"{where}: missing partial '{m.group(1)}'")
        return render(p.read_text("utf-8"), ctx, icons, used, f"partials/{m.group(1)}.html", depth + 1)

    text = RE_INCLUDE.sub(include, text)
    text = RE_REPLAY.sub(lambda m: render_replay(m.group(1), where, m.group(2) or "", m.group(3) or ""), text)
    text = RE_LOGREEL.sub(lambda m: render_log_reel([s.strip() for s in m.group(1).split(",")], where), text)
    text = expand_loops(text, ctx, icons, used, where, depth)
    text = RE_RISE.sub(lambda m: rise_words(m.group(1)), text)

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
# Replays: data-driven re-enactments of one system handling one event.
#
# Each src/replays/<name>.json is a list of timestamped steps. The build
# renders the complete FINAL state as static HTML (so no-JS and reduced-motion
# visitors get a fully populated, readable replay, and crawlers see content).
# replay.js then resets it and plays it back. Values that later steps change
# (sheet status, calendar blocks) are "muts": they carry their whole value
# history in data-values, and the step that changes them carries data-apply.
# ---------------------------------------------------------------------------

_esc = lambda s: html.escape(str(s), quote=True)  # noqa: E731


def _secs(t: str) -> int:
    m, s = t.split(":")
    return int(m) * 60 + int(s)


def _wall(base: str, t: str) -> str:
    h, m, s = (int(x) for x in base.split(":"))
    total = h * 3600 + m * 60 + s + _secs(t)
    return f"{total // 3600 % 24:02d}:{total // 60 % 60:02d}:{total % 60:02d}"


def load_replay(name: str, where: str) -> dict:
    p = SRC / "replays" / f"{name}.json"
    if not p.exists():
        raise BuildError(f"{where}: unknown replay '{name}' (add src/replays/{name}.json)")
    data = json.loads(p.read_text("utf-8"))
    # Playback schedule (ms): real gaps compressed into a watchable rhythm
    at, prev = 700, None
    for step in data["steps"]:
        sec = _secs(step["t"])
        if prev is not None:
            gap = sec - prev
            at += 520 if gap == 0 else int(min(2400, max(1100, gap * 420)))
        step["_at"] = at
        prev = sec
    data["_duration"] = at
    return data


def _collect_muts(data: dict) -> dict[str, list]:
    """First pass: every mutable value's history, [[text, tone], ...]."""
    muts: dict[str, list] = {}
    for step in data["steps"]:
        kind, op = step["type"], step.get("op", "add")
        if kind == "sheet" and op == "add":
            for col in step["columns"]:
                muts[f'{step["id"]}.{col["key"]}'] = [[step["row"][col["key"]], step.get("tones", {}).get(col["key"], "")]]
        elif kind == "calendar" and op == "add":
            muts[f'{step["id"]}.template'] = [[step["template"], "ok"]]
            for i, (tm, label) in enumerate(step["blocks"]):
                muts[f'{step["id"]}.b{i}.time'] = [[tm, ""]]
                muts[f'{step["id"]}.b{i}.label'] = [[label, ""]]
        step["_apply"] = {}
        if kind == "sheet" and op == "update":
            for key, val in step["set"].items():
                mid = f'{step["target"]}.{key}'
                muts[mid].append([val, step.get("tones", {}).get(key, "")])
                step["_apply"][mid] = len(muts[mid]) - 1
        elif kind == "calendar" and op == "shift":
            updates = {f'{step["target"]}.template': [step["template"], "ok"]}
            for i, (tm, label) in enumerate(step["blocks"]):
                updates[f'{step["target"]}.b{i}.time'] = [tm, ""]
                updates[f'{step["target"]}.b{i}.label'] = [label, ""]
            for mid, val in updates.items():
                muts[mid].append(val)
                step["_apply"][mid] = len(muts[mid]) - 1
    return muts


def _mut(muts: dict, mid: str, cls: str = "") -> str:
    history = muts[mid]
    text, tone = history[-1]
    tone_cls = f" rp-pill rp-pill--{tone}" if tone else ""
    return (f'<span class="rp-mut{tone_cls}{(" " + cls) if cls else ""}" data-mut="{_esc(mid)}" '
            f"data-values='{_esc(json.dumps(history, ensure_ascii=False))}'>{_esc(text)}</span>")


def _artifact(step: dict, muts: dict, data: dict) -> str:
    """Owner-view markup for one step ('' for steps that only mutate)."""
    kind, op = step["type"], step.get("op", "add")
    at = f'data-at="{step["_at"]}"'
    wall = _wall(data["base"], step["t"])[:5]
    if kind == "call":
        return (f'<li class="rp-item" {at}><div class="rp-card rp-call">'
                f'<span class="rp-call__icon">{{% icon "phone-x" %}}</span>'
                f'<span class="rp-call__body"><span class="rp-kicker">{_esc(step.get("label", "Incoming call"))} · {wall}</span>'
                f'<span class="rp-call__num">{_esc(step["from"])}</span></span>'
                f'<span class="rp-pill rp-pill--warn">{_esc(step["status"])}</span></div></li>')
    if kind in ("sms", "whatsapp") or (kind == "telegram" and step.get("dir")):
        side = "out" if step["dir"] == "out" else "in"
        photo = ""
        if step.get("photo"):
            photo = ('<figure class="rp-photo" aria-label="Photo attachment">'
                     '<svg viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
                     '<rect width="160" height="110" fill="#1c1c24"/>'
                     '<g stroke="#2e2e38" stroke-width="1">' + "".join(
                         f'<path d="M{x} 0 L{x - 40} 110"/>' for x in range(20, 220, 14)) + '</g>'
                     '<rect x="28" y="18" width="104" height="74" rx="4" fill="#23232b" stroke="#3a3a46"/>'
                     '<path d="M70 18 L78 40 L72 52 L84 70 L80 92" fill="none" stroke="#bcb4f4" stroke-width="1.25"/>'
                     '</svg><figcaption class="rp-meta">IMG · site_photo.jpg</figcaption></figure>')
        fields = ""
        if step.get("fields"):
            rows = "".join(
                f'<div class="rp-field"><dt>{_esc(f["k"])}</dt><dd>{_esc(f["v"])}'
                + (f' <span class="rp-note">{_esc(f["note"])}</span>' if f.get("note") else "") + "</dd></div>"
                for f in step["fields"])
            fields = f'<dl class="rp-fields">{rows}</dl>'
        text = f'<p>{_esc(step["text"])}</p>' if step.get("text") else ""
        channel = {"sms": "SMS", "whatsapp": "WhatsApp", "telegram": "Telegram"}[kind]
        meta = step.get("meta", f"{channel} · {wall}")
        return (f'<li class="rp-item rp-msg rp-msg--{side} rp-msg--{kind}" {at}>'
                f'<div class="rp-bubble">{photo}{text}{fields}</div>'
                f'<span class="rp-meta">{_esc(meta)}</span></li>')
    if kind == "telegram":
        buttons = "".join(f"<span>{_esc(b)}</span>" for b in step.get("buttons", []))
        buttons = f'<div class="rp-tg__btns" role="group" aria-label="Inline buttons">{buttons}</div>' if buttons else ""
        return (f'<li class="rp-item" {at}><div class="rp-card rp-tg">'
                f'<div class="rp-tg__head"><span class="rp-avatar">{{% icon "telegram-logo" %}}</span>'
                f'<span class="rp-tg__name">{_esc(step["from"])}</span><span class="rp-tag">bot</span>'
                f'<span class="rp-meta">{wall}</span></div>'
                f'<p class="rp-tg__text">{_esc(step["text"])}</p>{buttons}</div></li>')
    if kind == "sheet" and op == "add":
        # A sheet with "before" rows is a running log (a ledger): the earlier
        # rows are there from the start and the new row lands below them a
        # beat after the sheet appears. Columns can ask to show only when the
        # sheet is mid-width or wide ("show"), so it stays a table on a phone.
        cols = step["columns"]
        show = lambda c: f' class="rp-col--{c["show"]}"' if c.get("show") else ""  # noqa: E731
        head = "".join(f'<th scope="col"{show(c)}>{_esc(c["label"])}</th>' for c in cols)

        def seed(row: dict) -> str:
            tones = row.get("_tones", {})
            return "<tr>" + "".join(
                f'<td data-label="{_esc(c["label"])}"{show(c)}>'
                + (f'<span class="rp-pill rp-pill--{tones[c["key"]]}">{_esc(row[c["key"]])}</span>'
                   if c["key"] in tones else _esc(row[c["key"]])) + "</td>"
                for c in cols) + "</tr>"

        before = step.get("before", [])
        cells = "".join(f'<td data-label="{_esc(c["label"])}"{show(c)}>{_mut(muts, step["id"] + "." + c["key"])}</td>'
                        for c in cols)
        new_row = (f'<tr class="rp-row--new" data-at="{step["_at"] + 650}">{cells}</tr>' if before
                   else f"<tr>{cells}</tr>")
        return (f'<li class="rp-item" {at}><div class="rp-card rp-sheet{" rp-sheet--ledger" if before else ""}">'
                f'<div class="rp-sheet__tab">{{% icon "table" %}}<span>{_esc(step["sheet"])}</span>'
                f'<span class="rp-meta">Google Sheets</span></div>'
                f'<table><thead><tr>{head}</tr></thead><tbody>{"".join(seed(r) for r in before)}{new_row}</tbody></table></div></li>')
    if kind == "calendar" and op == "add":
        blocks = "".join(
            f'<li class="rp-block" style="--i:{i}">{_mut(muts, f"{step["id"]}.b{i}.time", "rp-block__time")}'
            f'{_mut(muts, f"{step["id"]}.b{i}.label", "rp-block__label")}</li>'
            for i in range(len(step["blocks"])))
        return (f'<li class="rp-item" {at}><div class="rp-card rp-cal" data-cal="{_esc(step["id"])}">'
                f'<div class="rp-cal__head">{{% icon "calendar-blank" %}}<span>{_esc(step["title"])}</span>'
                f'{_mut(muts, step["id"] + ".template")}</div><ol class="rp-cal__list" role="list">{blocks}</ol></div></li>')
    if kind == "event":
        return f'<li class="rp-item rp-event" {at}><span aria-hidden="true">↳</span> {_esc(step["text"])}</li>'
    if kind == "consent":
        scopes = "".join(f'<li>{{% icon "check" %}}<span>{_esc(s)}</span></li>' for s in step["scopes"])
        return (f'<li class="rp-item" {at}><div class="rp-card rp-consent">'
                f'<p class="rp-kicker">Sign in with Google · {wall}</p>'
                f'<p class="rp-consent__title">{_esc(step["app"])} wants to access your Google Account</p>'
                f'<p class="rp-consent__acct"><span class="rp-avatar" aria-hidden="true">{_esc(step["initial"])}</span>'
                f'{_esc(step["account"])}</p>'
                f'<ul class="rp-consent__scopes" role="list">{scopes}</ul>'
                f'<div class="rp-consent__btns"><span>Cancel</span><span class="is-primary">Allow</span></div>'
                f'</div></li>')
    return ""


def _log_line(step: dict, data: dict, extra_cls: str = "") -> str:
    log = step["log"]
    kv = " ".join(
        f'<span class="k">{_esc(k)}</span>=<span class="v">{_esc(v if " " not in str(v) else chr(34) + str(v) + chr(34))}</span>'
        for k, v in log.get("kv", {}).items())
    apply = f" data-apply='{_esc(json.dumps(step['_apply']))}'" if step.get("_apply") else ""
    return (f'<li class="log-line{extra_cls}" data-at="{step["_at"]}" data-t="{step["t"]}"{apply}>'
            f'<span class="log-ts">{_wall(data["base"], step["t"])}</span>'
            f'<span class="log-sys">{_esc(log["sys"])}</span>'
            f'<span class="log-ev">{_esc(log["event"])}</span>'
            f'<span class="log-kv">{kv}</span></li>')


VIEW_NAMES = {"customer": "Customer", "owner": "Owner", "story": "Full"}


def render_replay(name: str, where: str, dom_id: str = "", compact: str = "") -> str:
    """Two synchronised views on one clock: the customer's own phone, and what
    the owner sees. Both sit in one grid cell, so the stage is as tall as the
    taller view and switching never moves the page. A hidden tick list carries
    the clock and the value changes for every step, visible or not. (The raw
    event log only appears in the home page's log reel.)

    compact="customer"|"owner": one view only, no toggle (the work index
    cards). It still has its clock and its pause control.
    compact="story": both lanes merged into one feed in step order, so a
    card can follow the event from the customer's phone to the owner's
    sheet (needs a "story" block in the replay: label, icon, height)."""
    data = load_replay(name, where)
    muts = _collect_muts(data)
    rid = dom_id or f"replay-{name}"
    if compact == "story":
        if "story" not in data:
            raise BuildError(f"{where}: replay '{name}' has no story block")
        lanes = [{**data["story"], "id": "*", "view": "story", "anchor": "bottom"}]
    else:
        lanes = [lane for lane in data["lanes"] if not compact or lane["view"] == compact]
    if not lanes:
        raise BuildError(f"{where}: replay '{name}' has no {compact} view")
    views = []
    for lane in lanes:
        items = "".join(_artifact(s, muts, data) for s in data["steps"]
                        if s.get("lane") and lane["id"] in ("*", s["lane"]))
        h = lane["height"]
        views.append(
            f'<section class="replay__view" data-panel="{lane["view"]}" id="{rid}-{lane["view"]}" '
            f'aria-label="{VIEW_NAMES[lane["view"]]} view: {_esc(lane["label"])}">'
            f'<p class="replay__lane-label">{{% icon "{lane.get("icon", "eye")}" %}}{_esc(lane["label"])}</p>'
            f'<ol class="replay__feed" role="list" data-anchor="{lane.get("anchor", "bottom")}" '
            f'style="--h-n:{h["narrow"]};--h-w:{h["wide"]}">{items}</ol></section>')
    ticks = "".join(
        f'<li data-at="{s["_at"]}" data-t="{s["t"]}"'
        + (f" data-apply='{_esc(json.dumps(s['_apply']))}'" if s.get("_apply") else "") + "></li>"
        for s in data["steps"])
    first = lanes[0]["view"]
    buttons = "".join(
        f'<button type="button" data-view-btn="{lane["view"]}" aria-controls="{rid}-{lane["view"]}" '
        f'aria-pressed="{str(lane["view"] == first).lower()}">{VIEW_NAMES[lane["view"]]}'
        f'<span class="replay__vw"> view</span></button>'
        for lane in lanes)
    toggle = "" if compact else f'<div class="replay__views" role="group" aria-label="Replay view">{buttons}</div>'
    final_t = data["steps"][-1]["t"]
    return f'''<figure class="replay{" replay--compact" if compact else ""}" id="{rid}" data-replay data-duration="{data["_duration"]}" data-view="{first}" aria-labelledby="{rid}-name">
  <div class="replay__core">
    <div class="replay__bar">
      <div class="replay__id">
        <span class="replay__name" id="{rid}-name">{_esc(data["title"])}{f'<span class="sr-only"> · {VIEW_NAMES[compact].lower()} view</span>' if compact else ""}</span>
        <span class="replay__sim">Simulated data · real system flow</span>
      </div>
      <span class="replay__clock" data-clock aria-hidden="true">{final_t}</span>
      {toggle}
      <button type="button" class="replay__play" data-play aria-label="Pause replay">
        <span class="replay__icon-pause">{{% icon "pause" %}}</span><span class="replay__icon-play">{{% icon "play" %}}</span>
      </button>
    </div>
    <div class="replay__stage">{"".join(views)}</div>
    <ol class="replay__ticks" hidden>{ticks}</ol>
  </div>
  <figcaption class="sr-only">{_esc(data["summary"])}</figcaption>
</figure>'''


def render_log_reel(names: list[str], where: str) -> str:
    """'Under the hood': every replay's raw event log, back to back, cycling."""
    lines = []
    for name in names:
        data = load_replay(name, where)
        _collect_muts(data)
        lines.append(f'<li class="log-line log-line--rule"><span class="log-sys">── {_esc(data["system"])}</span></li>')
        lines += [_log_line(s, data) for s in data["steps"]]
    return ('<div class="logreel" data-logreel><div class="logreel__bar"><span class="replay__sim">'
            'Simulated data · real system flows</span><button type="button" class="replay__play" data-play '
            'aria-label="Pause log">'
            '<span class="replay__icon-pause">{% icon "pause" %}</span><span class="replay__icon-play">{% icon "play" %}</span>'
            f'</button></div><ol class="logreel__list" role="list" tabindex="0" aria-label="Event log, all systems">{"".join(lines)}</ol></div>')


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def gz_size(data: str | bytes) -> int:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return len(gzip.compress(data, compresslevel=9))


def build() -> int:
    site = load_site()
    pricing = load_pricing(site)
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
    missing = len(font_report["installed"]) - n_inst
    print(f"  fonts: {n_inst}/{len(font_report['installed'])} faces installed"
          + (f" ({missing} placeholder(s) render the metric-matched fallback)" if missing else ""))

    # Images
    img = build_images(out, site)

    # Shared CSS and JS
    critical_base = minify_css(read_css(CRITICAL_CSS))
    deferred_site = minify_css(read_css(DEFERRED_CSS))
    deferred_site_url = emit_hashed(out, "css", "site", "css", deferred_site)
    vendor_map, vendor_bytes = {}, 0
    for key, fname in VENDOR_JS.items():
        code = (SRC / "js" / "vendor" / fname).read_text("utf-8")
        vendor_map[key] = emit_hashed(out, "js/vendor", Path(fname).stem, "js", code)
        vendor_bytes += gz_size(code)
    js_urls, js_bytes = {}, {}
    for name in SITE_JS + [p.name for p in (SRC / "js").glob("*.js") if p.name not in SITE_JS]:
        code = (SRC / "js" / name).read_text("utf-8").replace("__VENDOR_MAP__", json.dumps(vendor_map))
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

        og_rel = f"{OG_DIR}/{meta.get('og_image') or og_slug(meta['path'])}.png"
        if not (ROOT / og_rel).exists():
            og_rel = f"{OG_DIR}/default.png"
        ctx = {
            **meta,
            "site": site,
            "pricing": pricing,
            "canonical": site["url"] + meta["path"],
            "noindex": meta.get("robots", "index").startswith("noindex"),
            "og_type": meta.get("og_type", "website"),
            "og_image_url": f"{site['url']}/{og_rel}" if (ROOT / og_rel).exists() else "",
            "body_class": meta.get("body_class", ""),
            "preloads": preloads,
            "critical_css": crit,
            "deferred_css": deferred_tags,
            "brand_mark": brand_mark_html(img),
            "portrait": portrait_html() if img.get("portrait") else "",
            "digitora": digitora_html(img["digitora"]) if img.get("digitora") else "",
            "build_date": date.today().isoformat(),
        }
        # Case-study pages name their system; it arrives as {{ sys.* }},
        # with the following system (wrapping) as {{ next_sys.* }}
        if meta.get("system"):
            systems = site["systems"]
            idx = next((i for i, s in enumerate(systems) if s["slug"] == meta["system"]), None)
            if idx is None:
                raise BuildError(f"{where}: unknown system '{meta['system']}'")
            ctx["sys"] = systems[idx]
            ctx["next_sys"] = systems[(idx + 1) % len(systems)]
            ctx["title_html"] = rise_words(html.escape(systems[idx]["name"]))
        content = render(body, ctx, icons, used, where)
        ctx["content"] = content

        # Scripts are chosen after the body renders, so components pull in
        # their own behaviour (a page with a Replay gets replay.js).
        if ("data-replay" in content or "data-logreel" in content) and "replay.js" not in page_js:
            page_js.append("replay.js")
        for n in page_js:
            if n not in js_urls:
                raise BuildError(f"{where}: unknown script '{n}'")
        ctx["scripts"] = "\n".join(f'<script type="module" src="{js_urls[n]}"></script>' for n in page_js)
        ctx["jsonld"] = jsonld_for(meta, site, pricing)
        doc = render((SRC / "partials" / "layout.html").read_text("utf-8"), ctx, icons, used, "partials/layout.html")

        # Current-page marker on every nav link that points here
        if meta.get("nav"):
            doc = doc.replace(f'data-nav="{meta["nav"]}"', f'data-nav="{meta["nav"]}" aria-current="page"')

        # Per-page sprite: only the icons this page actually uses
        sprite = ('<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" '
                  'style="position:absolute;width:0;height:0;overflow:hidden">'
                  + "".join(icons[n] for n in sorted(used)) + "</svg>")
        doc = doc.replace("<!--SPRITE-->", sprite)

        # Honest page weight: HTML (with inlined critical CSS) + deferred CSS
        # + all JS including the on-demand motion libraries, gzipped
        weight = gz_size(doc) + sum(gz_size((ROOT / u.lstrip("/")).read_bytes()) for u in deferred_urls) \
            + sum(gz_size(js_bytes[js_urls[n]]) for n in page_js) + vendor_bytes
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


def jsonld_for(meta: dict, site: dict, pricing: dict) -> str:
    """Structured data named in front matter: `schema: organization, services`."""
    wanted = split_list(meta.get("schema"))
    if not wanted:
        return ""
    org = {
        "@type": "Organization",
        "@id": f"{site['url']}/#organization",
        "name": site["name"],
        "url": site["url"] + "/",
        "logo": f"{site['url']}/assets/img/brand/icon-192.png",
        "email": site["email"],
        "telephone": site["phone_tel"],
        "description": site["description"],
        "sameAs": list(site["social"].values()),
        "contactPoint": [{"@type": "ContactPoint", "contactType": "sales", "email": site["email"],
                          "telephone": site["phone_tel"], "availableLanguage": "English"}],
    }
    graph = []
    if "organization" in wanted:
        graph.append(org)
    if "services" in wanted:
        for group in site["service_groups"]:
            for svc in group["services"]:
                offer = {"@type": "Offer", "priceCurrency": "INR", "price": svc["price"]["value"]}
                if pricing["launch"]:
                    offer["priceValidUntil"] = pricing["launch_end"]
                graph.append({
                    "@type": "Service",
                    "name": svc["name"],
                    "serviceType": svc["name"],
                    "category": group["name"],
                    "description": svc["line"],
                    "provider": {"@id": org["@id"]},
                    "url": f"{site['url']}{site['routes']['services']}#{svc['slug']}",
                    "offers": offer,
                })
    payload = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return f'<script type="application/ld+json">\n{payload}\n</script>'


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
    out.write("robots.txt", f"User-agent: *\n{disallow}\n"
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
    """Local server that behaves like the production host (GitHub Pages):
    gzip for text responses and a short max-age, so local Lighthouse runs
    measure what visitors will actually get."""
    import functools
    import http.server
    import mimetypes
    mimetypes.add_type("font/woff2", ".woff2")
    mimetypes.add_type("image/avif", ".avif")
    mimetypes.add_type("text/javascript", ".js")
    text_types = (".html", ".css", ".js", ".json", ".svg", ".xml", ".txt", ".md")

    class Handler(http.server.SimpleHTTPRequestHandler):
        def send_head(self):
            path = Path(self.translate_path(self.path))
            if path.is_dir():
                path = path / "index.html"
            if (path.suffix in text_types and path.is_file()
                    and "gzip" in self.headers.get("Accept-Encoding", "")):
                body = gzip.compress(path.read_bytes(), compresslevel=6)
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "text/html")
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "max-age=600")
                self.end_headers()
                import io
                return io.BytesIO(body)
            return super().send_head()

        def end_headers(self):
            if "Cache-Control" not in "".join(h.decode("latin-1") for h in getattr(self, "_headers_buffer", [])):
                self.send_header("Cache-Control", "max-age=600")
            super().end_headers()

        def log_message(self, *args):
            pass

    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving {ROOT} at http://127.0.0.1:{port}/")
        httpd.serve_forever()


# ---------------------------------------------------------------------------
# Open Graph cards
# ---------------------------------------------------------------------------

OG_DIR = "assets/img/og"
_CHROME = [os.environ.get("CHROME_PATH", ""),
           "C:/Program Files/Google/Chrome/Application/chrome.exe",
           "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
           "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]


def og_slug(url_path: str) -> str:
    """/ → default, /work/site-fault-tracker/ → work-site-fault-tracker"""
    return url_path.strip("/").replace("/", "-").removesuffix(".html") or "default"


def og_card_html(headline: str, kicker: str, fonts_css: str, mark_uri: str) -> str:
    grain = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E"
             "%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E"
             "%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3C/filter%3E"
             "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{fonts_css}
:root {{ --ink:#0B0B0F; --bone:#EDE8E0; --bone2:#AFAAA3; --lilac:#BCB4F4; --violet:#6756B9; }}
* {{ margin:0; box-sizing:border-box; }}
html, body {{ width:1200px; height:630px; overflow:hidden; background:var(--ink); color:var(--bone); }}
body {{ position:relative; font-family:"ABC Whyte Inktrap","ABC Whyte Inktrap Fallback",Arial,sans-serif; }}
body::after {{ content:""; position:absolute; inset:0; opacity:.05; background:url("{grain}"); background-size:180px; }}
.rail {{ position:absolute; top:0; bottom:0; left:112px; width:1px; background:linear-gradient(180deg,transparent,rgba(237,232,224,.14) 20%,rgba(237,232,224,.14) 80%,transparent); }}
.top {{ position:absolute; top:64px; left:152px; right:72px; display:flex; align-items:center; justify-content:space-between; }}
.brand {{ display:flex; align-items:center; gap:18px; }}
.brand img {{ height:44px; }}
.wm {{ display:flex; align-items:baseline; gap:.4em; }}
.wm a {{ font-weight:500; font-size:17px; letter-spacing:.16em; text-transform:uppercase; }}
.wm i {{ width:6px; height:6px; border-radius:50%; background:var(--lilac); align-self:center; }}
.wm b {{ font-family:"GT Sectra Display","GT Sectra Display Fallback",Georgia,serif; font-style:italic; font-weight:400; font-size:30px; letter-spacing:-.015em; }}
.url {{ font-family:"GT America Mono","GT America Mono Fallback",monospace; font-size:17px; color:var(--bone2); letter-spacing:.02em; }}
.body {{ position:absolute; left:152px; right:96px; bottom:84px; }}
.kicker {{ display:flex; align-items:center; gap:16px; margin-bottom:30px; font-family:"GT America Mono","GT America Mono Fallback",monospace;
          font-size:18px; letter-spacing:.08em; text-transform:uppercase; color:var(--lilac); }}
.kicker::before {{ content:""; width:40px; height:1px; background:var(--lilac); }}
h1 {{ font-family:"GT Sectra Display","GT Sectra Display Fallback",Georgia,serif; font-weight:400; font-size:92px; line-height:1;
     letter-spacing:-.018em; text-wrap:balance; max-width:960px; }}
h1 em {{ font-style:italic; color:var(--lilac); letter-spacing:-.01em; }}
.tick {{ position:absolute; left:108px; bottom:120px; width:9px; height:9px; border-radius:50%; background:var(--violet); }}
</style></head><body>
<div class="rail"></div><div class="tick"></div>
<div class="top"><div class="brand"><img src="{mark_uri}" alt=""><span class="wm"><a>Vector</a><i></i><b>Workflows</b></span></div>
<span class="url">vectorworkflows.com</span></div>
<div class="body"><p class="kicker">{kicker}</p><h1>{headline}</h1></div>
</body></html>"""


def og_cards() -> int:
    """Render one card per indexable page from its built h1 and rail label.
    Fonts and the logo are embedded as data URIs so Chrome needs no server."""
    import base64
    import subprocess
    import tempfile
    chrome = next((c for c in _CHROME if c and Path(c).exists()), None)
    if not chrome:
        raise BuildError("og needs Chrome or Edge (set CHROME_PATH)")
    cfg = load_fonts()
    site = load_site()
    faces = []
    for fam in cfg["families"]:
        for face in fam["faces"]:
            f = face_dir(cfg, fam, face) / cfg["file"]
            if face_status(f)[1]:
                data = base64.b64encode(f.read_bytes()).decode()
                pin = fam.get("metrics")
                pinned = (f'ascent-override:{pin["ascent_override"]};descent-override:{pin["descent_override"]};'
                          f'line-gap-override:{pin["line_gap_override"]};') if pin else ""
                faces.append(f'@font-face{{font-family:"{fam["family"]}";src:url(data:font/woff2;base64,{data}) format("woff2");'
                             f'font-weight:{face["weight"]};font-style:{face["style"]};{pinned}}}')
    # Plus the metric-matched local() fallbacks, for faces not installed yet
    fallbacks = re.sub(r"@font-face\s*\{[^}]*url\([^}]*\}", "", render_font_css(cfg))
    fonts_css = "\n".join(faces) + "\n" + fallbacks
    mark = ROOT / "assets/img/brand/mark-84.png"
    if not mark.exists():
        raise BuildError("run `python build.py` first: the brand mark derivatives are missing")
    mark_uri = "data:image/png;base64," + base64.b64encode(mark.read_bytes()).decode()

    (ROOT / OG_DIR).mkdir(parents=True, exist_ok=True)
    made = 0
    with tempfile.TemporaryDirectory() as tmp:
        for page in sorted((SRC / "pages").rglob("*.html")):
            meta, _ = parse_page(page)
            if meta.get("robots", "index").startswith("noindex"):
                continue
            built = ROOT / out_path_for(meta["path"])
            if not built.exists():
                raise BuildError(f"{built.relative_to(ROOT)} not built yet: run `python build.py` first")
            doc = built.read_text("utf-8")
            h1 = re.search(r"<h1[^>]*>(.*?)</h1>", doc, re.S).group(1)
            headline = " ".join(re.sub(r"<(?!/?em\b)[^>]+>", "", h1).split())
            headline = headline.replace("</em> <em>", " ")
            if meta.get("system"):
                sys_ = next(s for s in site["systems"] if s["slug"] == meta["system"])
                kicker = f"Case study · {html.escape(sys_['status'])}"
            else:
                head = doc.split('class="frame page-head', 1)[-1] if "page-head" in doc else doc
                m = re.search(r'index-label__rule"></span>(.*?)</p>', head, re.S)
                kicker = m.group(1).strip() if m else html.escape(meta["title"].split(" · ")[0])
            src = Path(tmp) / f"{og_slug(meta['path'])}.html"
            src.write_text(og_card_html(headline, kicker, fonts_css, mark_uri), "utf-8")
            png = ROOT / OG_DIR / f"{og_slug(meta['path'])}.png"
            subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                            "--window-size=1200,630", "--virtual-time-budget=3000", f"--user-data-dir={Path(tmp) / 'profile'}",
                            f"--screenshot={png}", src.as_uri()],
                           check=True, capture_output=True, timeout=60)
            try:
                from PIL import Image
                with Image.open(png) as im:
                    im.convert("RGB").save(png, "PNG", optimize=True)
            except ImportError:
                pass
            made += 1
            print(f"  og: /{OG_DIR}/{png.name}  ({png.stat().st_size / 1024:.0f} kB)  {kicker} · {re.sub('<[^>]+>', '', headline)}")
    print(f"  {made} card(s) rendered; rebuilding to link them")
    return build()


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
        if cmd == "og":
            return og_cards()
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
