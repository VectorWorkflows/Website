#!/usr/bin/env python3
"""
Static page assembler for the Cut Above concept site.

Every page is written out as plain, complete HTML — this script exists only so
the shared chrome (head, nav, menu, footer) stays identical across pages while
it is being authored. The deliverable does not need it at runtime.

    python3 build.py
"""
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))

NAV_ITEMS = [
    ("The Salon",  "index.html#salon"),
    ("Treatments", "services.html"),
    ("The Team",   "team.html"),
    ("Houses",     "houses.html"),
    ("Gallery",    "gallery.html"),
    ("Find us",    "contact.html"),
]

CA_MAPS = "https://maps.google.com/?q=Cut+Above+Hair+%26+Beauty+Salon+Jumeirah+Centre+Dubai"
CA_EMBED = ("https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3611.674509817682!2d55.26045831501339"
            "!3d25.23102758388457!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2"
            "!1s0x3e5f4253c13f7157%3A0xfcb169270564209f!2sCut%20Above%20Hair%20%26%20Beauty%20Salon"
            "!5e0!3m2!1sen!2sae!4v1700000000000")

LEGAL = "concept-demonstration-not-affiliated-with-cut-above-hair-and-beauty-salon.html"

ICON_ARROW = ('<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" '
              'stroke-width="1.2" aria-hidden="true"><path d="M1 6.5h10M7 2.5l4 4-4 4"/></svg>')
ICON_SEARCH = ('<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" '
               'stroke-width="1.2" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.8"/><path d="M10.2 10.2L14 14"/></svg>')
ICON_UP = ('<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" '
           'stroke-width="1.2" aria-hidden="true"><path d="M6.5 12V1M2.5 5l4-4 4 4"/></svg>')
ICON_X = ('<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" '
          'stroke-width="1.2" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13"/></svg>')
ICON_L = ('<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" '
          'stroke-width="1.2" aria-hidden="true"><path d="M9.5 2l-5 5.5 5 5.5"/></svg>')
ICON_PIN = ('<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" '
            'stroke-width="1.2" aria-hidden="true"><path d="M6.5 12s4.2-4.2 4.2-7a4.2 4.2 0 10-8.4 0c0 2.8 4.2 7 4.2 7z"/>'
            '<circle cx="6.5" cy="5" r="1.5"/></svg>')
ICON_R = ('<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" '
          'stroke-width="1.2" aria-hidden="true"><path d="M5.5 2l5 5.5-5 5.5"/></svg>')


def head(title, desc, extra_css=""):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#0A0908">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400&display=swap" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230A0908'/%3E%3Ctext x='16' y='23' font-family='Georgia,serif' font-size='19' fill='%23D8C3A5' text-anchor='middle'%3EC%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/base.css">
<link rel="stylesheet" href="assets/css/components.css">
<link rel="stylesheet" href="assets/css/pages.css">{extra_css}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<div class="preload" aria-hidden="true">
  <div class="preload__inner">
    <div class="preload__mark"><span>CUT ABOVE</span></div>
    <div class="preload__bar"><i></i></div>
    <div class="preload__pct">0</div>
  </div>
</div>
"""


def topbar_open():
    return '<div class="topbar">'


def topbar_close():
    return '</div>'


def nav():
    links = "\n".join(
        f'        <a class="nav__link" href="{href}">{label}</a>'
        for label, href in NAV_ITEMS
    )
    menu = "\n".join(
        f'        <li><a href="{href}"><i>0{i+1}</i>{label}</a></li>'
        for i, (label, href) in enumerate(NAV_ITEMS)
    )
    return f"""
<header class="nav">
  <div class="nav__in">
    <a class="brand" href="index.html" aria-label="Cut Above — home">
      <span>
        <span class="brand__word">Cut Above</span>
        <span class="brand__sub">Hair &amp; Beauty · Dubai</span>
      </span>
    </a>
    <nav class="nav__links" aria-label="Primary">
{links}
    </nav>
    <div class="nav__right">
      <button class="btn btn--sm btn--solid" data-book="true" data-magnet="0.2">Book</button>
      <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu">
        <span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="menu" id="menu">
  <nav aria-label="Mobile">
    <ul class="menu__list">
{menu}
      <li><a href="#" data-book="true"><i>07</i>Book</a></li>
    </ul>
  </nav>
  <div class="menu__foot">
    <a data-biz-phone href="#"></a>
    <a data-biz-email href="#"></a>
    <a data-biz-ig href="#" target="_blank" rel="noopener">Instagram</a>
    <span>1st Floor, Jumeirah Centre, Dubai</span>
  </div>
</div>
"""


def footer():
    nav_links = "\n".join(
        f'            <li><a href="{href}">{label}</a></li>' for label, href in NAV_ITEMS
    )
    return f"""
<section class="cta">
  <div class="shell">
    <p class="label" data-reveal>Jumeirah 1, Dubai</p>
    <h2 class="cta__word" data-reveal style="--rd:90ms">Come and <em>sit down.</em></h2>
    <p class="lead" data-reveal style="--rd:180ms; margin:2rem auto 0; max-width:44ch; text-align:center">
      Thirty minutes on the phone, or two minutes here. Either way somebody who knows what
      they are doing will be waiting for you.
    </p>
    <div data-reveal style="--rd:260ms;display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center;margin-top:2.5rem">
      <button class="btn btn--solid btn--lg" data-book="true" data-magnet="0.25">Request an appointment</button>
      <a class="btn btn--lg" data-biz-wa href="#" target="_blank" rel="noopener">WhatsApp</a>
    </div>
  </div>
</section>

<footer class="foot">
  <div class="shell foot__top">
    <div class="foot__grid">
      <div>
        <div class="brand__word" style="font-size:1.5rem">Cut Above</div>
        <p class="body-copy" style="margin-top:1.25rem;max-width:30ch">
          Hair, beauty and nails on Jumeirah Beach Road since 1992 — one of the first
          Western salons in the U.A.E.
        </p>
        <div class="pill" data-open-pill style="margin-top:1.5rem"></div>
      </div>
      <div>
        <h3 class="foot__h">Explore</h3>
        <ul class="foot__list">
{nav_links}
        </ul>
      </div>
      <div>
        <h3 class="foot__h">Find us</h3>
        <ul class="foot__list">
          <li><span>1st Floor, Jumeirah Centre</span></li>
          <li><span>Jumeirah 1, Dubai, U.A.E.</span></li>
          <li><a data-biz-phone href="#"></a></li>
          <li><a data-biz-wa href="#" target="_blank" rel="noopener"></a></li>
          <li><a data-biz-email href="#"></a></li>
        </ul>
        <div style="display:flex;gap:1rem;margin-top:1.25rem">
          <a class="tlink" data-biz-ig href="#" target="_blank" rel="noopener">Instagram</a>
          <a class="tlink" data-biz-fb href="#" target="_blank" rel="noopener">Facebook</a>
        </div>
      </div>
      <div>
        <h3 class="foot__h">Hours</h3>
        <dl data-hours style="margin:0"></dl>
      </div>
    </div>
  </div>
  <div class="shell">
    <div class="foot__bar">
      <span>© <span data-year></span> Cut Above Hair &amp; Beauty Salon — content belongs to the salon</span>
      <span>Concept design by <a href="https://vectorworkflows.com" target="_blank" rel="noopener">Vector Workflows</a>
        · <a href="{LEGAL}">unaffiliated demonstration</a></span>
    </div>
  </div>
</footer>

<button class="totop" aria-label="Back to top">{ICON_UP}</button>
"""


def scripts(extra=(), inline=""):
    """External scripts first, then any page-specific inline block.

    Order matters: the inline blocks read window.CA, which data.js defines.
    """
    s = ['<script src="assets/js/data.js"></script>',
         '<script src="assets/js/app.js"></script>']
    s += [f'<script src="assets/js/{f}"></script>' for f in extra]
    s.append('<script src="assets/js/booking.js"></script>')
    out = "\n".join(s)
    if inline:
        out += "\n" + inline
    return out + "\n</body>\n</html>\n"


def notice():
    return (
        '<div class="notice">'
        '<span class="notice__long">This is <b>not</b> the Cut Above website — it is an unaffiliated '
        'concept redesign, built by <a href="https://vectorworkflows.com" target="_blank" '
        'rel="noopener">Vector Workflows</a>. </span>'
        '<span class="notice__short">Not the real site — a concept by '
        '<a href="https://vectorworkflows.com" target="_blank" rel="noopener">Vector Workflows</a>. </span>'
        f'<a href="{LEGAL}">What this is</a>'
        '</div>'
    )


def lightbox():
    return f"""
<div class="lb" role="dialog" aria-modal="true" aria-label="Gallery">
  <div class="lb__bar">
    <span data-lb-index>1 / 1</span>
    <button class="lb__close" aria-label="Close gallery">{ICON_X}</button>
  </div>
  <div class="lb__stage">
    <button class="lb__nav lb__nav--prev" aria-label="Previous">{ICON_L}</button>
    <img class="lb__img" src="" alt="" data-no-ph>
    <button class="lb__nav lb__nav--next" aria-label="Next">{ICON_R}</button>
  </div>
  <div class="lb__foot"></div>
</div>
"""


def phead(crumb, title, sub):
    return f"""
<header class="phead">
  <div class="shell">
    <p class="phead__crumb" data-reveal><a href="index.html">Cut Above</a> — {crumb}</p>
    <h1 class="phead__t" data-split data-reveal="fade">{title}</h1>
    <p class="phead__sub" data-reveal style="--rd:220ms">{sub}</p>
  </div>
</header>
"""


def frame(path, alt, ratio="3x4", fallback=None, ph=None, sub=None, para=None):
    fb = f' data-fallback="{fallback}"' if fallback else ""
    p = f' data-ph="{ph}"' if ph else ""
    s = f' data-ph-sub="{sub}"' if sub else ""
    pa = f' data-para="{para}"' if para else ""
    return (f'<div class="frame frame--{ratio} rv-img">'
            f'<img src="{path}" alt="{alt}" loading="lazy" decoding="async"{fb}{p}{s}{pa}>'
            f'</div>')


# ============================================================== INDEX =======
def page_index():
    disciplines = ""
    for d in [
        ("01", "Hair", "Cut, colour and correction",
         "Precision cutting, the curly method, thermal scissor work and colour that is engineered "
         "rather than guessed — airtouch, balayage, babylights, hand-free painting, and the kind of "
         "colour correction other salons send people to us for.",
         ["Precision cutting", "Airtouch", "Balayage", "Colour correction", "Curly method"], "Hair"),
        ("02", "Skin", "Guinot &amp; Dermalogica",
         "A skin treatment is specific to the client it was designed for. Our therapists trained at "
         "the Guinot Institute in Paris and the Dermalogica Institute, and they read your skin before "
         "they touch it — not after.",
         ["Hydradermie", "Age Summum", "Deep extraction", "Vitamin C", "Ultracalming"], "Skin"),
        ("03", "Nails", "Luxio, Gelish &amp; Shellac",
         "Fourteen-day wear as a floor, not a ceiling. Vegan, hypoallergenic, solvent-free gel "
         "systems, spa manicures and pedicures, extensions and nail art that survives a Dubai summer.",
         ["Spa manicure", "Gelish", "Shellac", "Extensions", "Nail art"], "Nails"),
        ("04", "Body", "Massage &amp; wellness",
         "Deep tissue, Swedish, Thai, lymphatic drainage with tools, pre- and post-natal, couples and "
         "four-hands. Reflexology, cupping, ear candling — sixty, ninety or a hundred and twenty "
         "minutes of properly trained hands.",
         ["Deep tissue", "Lymphatic drainage", "Reflexology", "Pre-natal", "Four hands"], "Body"),
    ]:
        n, title, lead, body, tags, area = d
        tagged = "".join(f'<span class="tag">{t}</span>' for t in tags)
        disciplines += f"""
      <article class="disc" data-reveal>
        <div class="disc__row">
          <div class="disc__n">{n}</div>
          <div class="disc__head">
            <h3 class="disc__title">{title}</h3>
            <p class="disc__lead">{lead}</p>
          </div>
          <div class="disc__text">
            <p class="disc__body">{body}</p>
            <div class="disc__tags">{tagged}</div>
          </div>
          <div class="disc__cta">
            <button class="btn btn--sm btn--ghost" data-book="{area}">Book {title.lower()}</button>
          </div>
        </div>
      </article>"""

    marquee_items = ["Schwarzkopf Professional", "Guinot Paris", "Dermalogica", "Olaplex",
                     "Great Lengths", "Philip Martin’s", "K-18", "Luxio by Akzentz",
                     "JB Lashes", "Malibu C"]
    marq = "".join(f'<a class="marq__item" href="houses.html">{m}</a>' for m in marquee_items)

    team_preview = ""
    for name, role, img, fb in [
        ("Emiliya Allahverdova", "Certified Hair Artist", "assets/img/team/emiliya.jpg",
         "https://www.cutabove-salon.com/images/emiliya.jpg"),
        ("Angelica Aganova", "Stylist &amp; Colorist", "assets/img/team/angelica.jpg",
         "https://www.cutabove-salon.com/images/Angelica.jpg"),
        ("Natalia Hosteva", "Stylist &amp; Colorist", "assets/img/team/natalia.jpg",
         "https://www.cutabove-salon.com/images/Natalia.jpg"),
        ("Yvonne Fernandez", "Dermalogica Therapist", "assets/img/team/yvonne.jpg",
         "https://www.cutabove-salon.com/images/rishi.jpg"),
    ]:
        short = name.split()[0]
        team_preview += f"""
        <a class="person card-link" href="team.html">
          <div class="person__media frame frame--3x4 rv-img">
            <img src="{img}" alt="{name}" loading="lazy" decoding="async" data-fallback="{fb}" data-ph="{short}" data-ph-sub="Portrait to follow">
            <span class="person__veil">
              <span class="person__name">{name}</span>
              <span class="person__role">{role}</span>
            </span>
          </div>
        </a>"""

    return (
        head("Cut Above — Hair, Beauty &amp; Nails in Jumeirah, Dubai since 1992",
             "One of the first Western salons in the U.A.E. Precision cutting, engineered colour, "
             "Guinot and Dermalogica facials, nails and massage. 1st Floor, Jumeirah Centre, Dubai.")
        + topbar_open() + notice() + nav() + topbar_close()
        + f"""
<main id="main">

  <!-- ============================================================ HERO -->
  <section class="hero">
    <div class="hero__stage" aria-hidden="true">
      <figure class="hero__slide" data-cap="Balayage, long waves">
        <img src="assets/img/hero/hero-01.jpg"
             srcset="assets/img/hero/hero-01-800.jpg 800w, assets/img/hero/hero-01.jpg 1400w"
             sizes="(max-width: 62rem) 100vw, 52vw" alt="" fetchpriority="high" decoding="async" data-no-ph>
      </figure>
      <figure class="hero__slide" data-cap="Copper red, glossed" data-hold="11500">
        <img src="assets/img/hero/hero-02.jpg"
             srcset="assets/img/hero/hero-02-800.jpg 800w, assets/img/hero/hero-02.jpg 1400w"
             sizes="(max-width: 62rem) 100vw, 52vw" alt="" loading="lazy" decoding="async" data-no-ph>
      </figure>
      <figure class="hero__slide" data-cap="A blunt bob, one length">
        <img src="assets/img/hero/hero-03.jpg"
             srcset="assets/img/hero/hero-03-800.jpg 800w, assets/img/hero/hero-03.jpg 1400w"
             sizes="(max-width: 62rem) 100vw, 52vw" alt="" loading="lazy" decoding="async" data-no-ph>
      </figure>
      <figure class="hero__slide" data-cap="Bronde, long layers">
        <img src="assets/img/hero/hero-04.jpg"
             srcset="assets/img/hero/hero-04-800.jpg 800w, assets/img/hero/hero-04.jpg 1400w"
             sizes="(max-width: 62rem) 100vw, 52vw" alt="" loading="lazy" decoding="async" data-no-ph>
      </figure>
    </div>
    <div class="hero__veil" aria-hidden="true"></div>
    <div class="hero__in">
      <div>
        <p class="label"><span class="rv-line"><span>Jumeirah, Dubai — Established 1992</span></span></p>
        <h1 class="hero__title" data-split>Thirty-four years<br>of never doing<br>the same <em>head twice.</em></h1>
        <p class="hero__sub" data-reveal style="--rd:900ms">
          One of the first Western salons in the U.A.E. We have never mass produced a look —
          every cut, every colour, every treatment is conceived around one face, one head of
          hair, one person.
        </p>
        <div class="hero__acts" data-reveal style="--rd:1020ms">
          <button class="btn btn--solid btn--lg" data-book="true" data-magnet="0.25">Request an appointment</button>
          <a class="btn btn--lg btn--ghost" href="services.html">See the price list {ICON_ARROW}</a>
        </div>
      </div>
      <dl class="hero__side" data-reveal style="--rd:1140ms">
        <div class="hero__sideItem"><dt>Today</dt><dd><span class="pill" data-open-pill></span></dd></div>
        <div class="hero__sideItem"><dt>Where</dt><dd>1st Floor, Jumeirah Centre<br>Jumeirah 1, Dubai</dd></div>
        <div class="hero__sideItem"><dt>Call</dt><dd><a data-biz-phone href="#"></a></dd></div>
      </dl>
    </div>
    <div class="scrollcue"><span>Scroll</span><i></i></div>

    <button class="hero__meta" data-hero-next aria-label="Next photograph">
      <span class="hero__cap" data-hero-cap></span>
      <span class="hero__count"><b data-hero-index>01</b> / 04</span>
      <span class="hero__bar"><i data-hero-bar></i></span>
    </button>
  </section>

  <!-- ========================================================= MARQUEE -->
  <div class="marq" aria-label="Brand partners">
    <div class="marq__track">{marq}{marq}</div>
  </div>

  <!-- =========================================================== SALON -->
  <section class="section" id="salon">
    <div class="shell">
      <div class="split">
        <div class="split__media">
          {frame("assets/img/editorial/salon.jpg", "Inside the salon at Jumeirah Centre", "4x5",
                 "https://www.cutabove-salon.com/images/sliders/003.jpg", "The Salon", "Interior photograph", "0.06")}
        </div>
        <div class="split__text">
          <p class="label" data-reveal>01 — The salon</p>
          <h2 class="quote quote--big" data-reveal style="--rd:100ms">
            We never mass produce. We <em style="color:var(--champagne)">tailor the look</em> —
            around the features and the needs of the person in the chair.
          </h2>
          <p class="body-copy" data-reveal style="--rd:200ms;margin-top:2rem">
            Cut Above opened on Jumeirah Beach Road in 1992, when there was not much else on it.
            More than three decades later we are still on the first floor of Jumeirah Centre, with
            some of the same clients and several of the same team.
          </p>
          <p class="body-copy" data-reveal style="--rd:260ms">
            What has changed is everything technical: the colour systems, the bond builders, the
            skin diagnostics, the gel chemistry. What has not changed is that somebody looks at you
            properly before they pick up a pair of scissors.
          </p>
          <p data-reveal style="--rd:320ms;margin-top:2rem">
            <a class="tlink" href="team.html">Meet the people who do it {ICON_ARROW}</a>
          </p>
        </div>
      </div>

      <div class="stats" style="margin-top:var(--s-10)" data-stagger="120">
        <div class="stat" data-reveal><div class="stat__k"><span data-count="1992">1992</span></div><div class="stat__v">The year we opened on Jumeirah Beach Road — before most of this city existed.</div></div>
        <div class="stat" data-reveal><div class="stat__k"><span data-count="34">34</span></div><div class="stat__v">Years in the same building, with clients who have been coming for most of them.</div></div>
        <div class="stat" data-reveal><div class="stat__k"><span data-count="10">10</span></div><div class="stat__v">Specialists on the floor. Not one of them is new to this.</div></div>
        <div class="stat" data-reveal><div class="stat__k"><span data-count="10">10</span></div><div class="stat__v">Professional houses we are certified to work with, from Schwarzkopf to Guinot.</div></div>
      </div>
    </div>
  </section>

  <!-- ===================================================== DISCIPLINES -->
  <section class="section" id="treatments">
    <div class="shell">
      <div class="sec-head">
        <span class="sec-head__n">02 — What we do</span>
        <h2 class="sec-head__t display display--1">Four disciplines,<br>one floor.</h2>
        <p class="sec-head__aside">Hair, skin, nails and body — under one roof, by people who
          only do the thing they are certified in. Full pricing is published, in full, on the
          treatments page.</p>
      </div>
      {disciplines}
      <p style="margin-top:2.5rem" data-reveal>
        <a class="tlink" href="services.html">Every treatment and every price {ICON_ARROW}</a>
      </p>
    </div>
  </section>

  <!-- ======================================================== SHOWCASE -->
  <section class="section section--tight">
    <div class="shell">
      <div class="showcase">
        <figure class="showcase__a" style="margin:0">
          {frame("assets/img/editorial/work-01.jpg", "A sharp one-length bob, finished", "4x5",
                 None, "Cut", "Photograph to follow")}
          <figcaption class="cap"><b>01</b> Cut &amp; finish</figcaption>
        </figure>
        <figure class="showcase__b" style="margin:0">
          <div class="frame frame--4x5 swatch" data-reveal="scale" tabindex="0" role="button"
               aria-label="Reveal the colour version of this photograph">
            <img class="swatch__colour" src="assets/img/editorial/work-02-colour.jpg"
                 alt="Long layered colour work, in colour" loading="lazy" decoding="async" data-no-ph>
            <img class="swatch__mono" src="assets/img/editorial/work-02.jpg"
                 alt="Long layered colour work" loading="lazy" decoding="async"
                 data-ph="Colour" data-ph-sub="Photograph to follow">
            <span class="swatch__hint"><i></i>Hold to see the colour</span>
          </div>
          <figcaption class="cap"><b>02</b> Colour</figcaption>
        </figure>
        <figure class="showcase__c" style="margin:0">
          {frame("assets/img/editorial/work-03.jpg", "Natural curl, cut dry", "1x1",
                 None, "Texture", "Photograph to follow")}
          <figcaption class="cap"><b>03</b> Texture</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <!-- ==================================================== TESTIMONIALS -->
  <section class="section">
    <div class="shell shell--narrow">
      <div class="sec-head">
        <span class="sec-head__n">03 — In their words</span>
        <h2 class="sec-head__t display display--2">Regulars, mostly.</h2>
      </div>
      <div class="testi" data-testi data-reveal></div>
      <div class="testi__dots" data-testi-dots></div>
    </div>
  </section>

  <!-- ============================================================ TEAM -->
  <section class="section">
    <div class="shell">
      <div class="sec-head">
        <span class="sec-head__n">04 — The team</span>
        <h2 class="sec-head__t display display--1">Ten specialists.<br>No juniors on your colour.</h2>
        <p class="sec-head__aside">Between them: award-winning hair artists, Guinot and Dermalogica
          institute graduates, and a therapist who has been here since the year the salon opened.</p>
      </div>
      <div class="team-grid" data-stagger="110">{team_preview}</div>
      <p style="margin-top:2.5rem" data-reveal><a class="tlink" href="team.html">All ten, with their specialisms {ICON_ARROW}</a></p>
    </div>
  </section>

  <!-- ========================================================= GALLERY -->
  <section class="section section--tight">
    <div class="shell">
      <div class="sec-head">
        <span class="sec-head__n">05 — The work</span>
        <h2 class="sec-head__t display display--2">Lately.</h2>
        <p class="sec-head__aside">A fraction of it. More on <a class="tlink" data-biz-ig href="#" target="_blank" rel="noopener">Instagram</a>.</p>
      </div>
      <div class="ig-strip" data-reveal>
        {"".join(f'<a class="ig-tile" data-biz-ig href="#" target="_blank" rel="noopener" data-cursor="View"><img src="assets/img/gallery/0{i}.jpg" alt="Recent work" loading="lazy" data-ph="Cut Above" data-ph-sub="0{i}.jpg"></a>' for i in range(1, 7))}
      </div>
      <p style="margin-top:2.5rem" data-reveal><a class="tlink" href="gallery.html">Open the gallery {ICON_ARROW}</a></p>
    </div>
  </section>

  <!-- ========================================================= FIND US -->
  <section class="section" id="find-us">
    <div class="shell">
      <div class="sec-head">
        <span class="sec-head__n">06 — Find us</span>
        <h2 class="sec-head__t display display--1">First floor,<br>Jumeirah Centre.</h2>
        <p class="sec-head__aside">On Jumeirah Beach Road, with parking on site. Walk-ins are
          welcome, but Saturdays book out.</p>
      </div>

      <div class="findus">
        <div class="findus__text">
          <span class="pill" data-open-pill></span>
          <p class="display display--3" style="margin-top:var(--s-5)">
            1st Floor, Jumeirah Centre<br>Jumeirah 1, Dubai, U.A.E.
          </p>
          <dl data-hours style="margin:var(--s-6) 0 0;max-width:22rem"></dl>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:var(--s-6)">
            <a class="btn btn--solid" href="{CA_MAPS}" target="_blank" rel="noopener" data-magnet="0.2">
              Get directions {ICON_PIN}
            </a>
            <a class="btn" data-biz-phone href="#"></a>
          </div>
        </div>
        <div class="findus__map" data-reveal>
          <iframe title="Map to Cut Above, Jumeirah Centre" loading="lazy" allowfullscreen
            referrerpolicy="no-referrer-when-downgrade"
            src="{CA_EMBED}"></iframe>
          <a class="findus__badge" href="{CA_MAPS}" target="_blank" rel="noopener">
            Open in Google Maps {ICON_ARROW}
          </a>
        </div>
      </div>
    </div>
  </section>

</main>
"""
        + footer()
        + scripts(["hero.js"])
    )


# ============================================================ SERVICES =====
def page_services():
    return (
        head("Treatments &amp; Prices — Cut Above, Dubai",
             "The complete Cut Above price list: hair cutting and colour, Guinot and Dermalogica "
             "facials, waxing, threading, nails, massage and packages. Jumeirah 1, Dubai.")
        + topbar_open() + notice() + nav() + topbar_close()
        + f"""
<main id="main">
{phead("Treatments", "Everything we do,<br>and what <em>it costs.</em>",
       "The full list, published in full. Prices are in U.A.E. dirhams and were last reviewed for "
       "this concept in September 2026 — the salon confirms on booking.")}

  <div class="price-bar">
    <div class="shell">
      <div class="price-bar__in">
        <div class="tabs" data-price-tabs></div>
        <label class="search">
          {ICON_SEARCH}
          <input type="search" placeholder="Search treatments — balayage, facial, pedicure…" data-price-search aria-label="Search treatments">
        </label>
        <span class="label label--dim" data-price-count></span>
      </div>
    </div>
  </div>

  <div class="shell">
    <div data-price-root></div>

    <div style="border-top:1px solid var(--line-soft);padding-top:var(--s-6);margin-top:var(--s-7);display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:var(--s-6)">
      <div>
        <h3 class="foot__h">Consultations</h3>
        <p class="body-copy">Colour correction, extensions and bridal work are always quoted after a
          consultation. There is no charge for it.</p>
      </div>
      <div>
        <h3 class="foot__h">Director pricing</h3>
        <p class="body-copy">Where two figures are shown, the second is for a director-level stylist.
          Ask when you book and we will tell you who is free.</p>
      </div>
      <div>
        <h3 class="foot__h">Packages</h3>
        <p class="body-copy">Blow-dry and massage courses are pre-paid and transferable within the
          household. See the Body tab.</p>
      </div>
    </div>

    <div style="margin-top:var(--s-9);display:flex;gap:.75rem;flex-wrap:wrap">
      <button class="btn btn--solid btn--lg" data-book="true" data-magnet="0.25">Request an appointment</button>
      <a class="btn btn--lg" data-biz-wa href="#" target="_blank" rel="noopener">Ask on WhatsApp</a>
    </div>
  </div>
</main>
"""
        + footer() + scripts(["pricing.js"])
    )


# ================================================================ TEAM =====
TEAM_SCRIPT = """<script>
(function () {
  var g = document.querySelector('[data-team-grid]');
  if (!g || !window.CA) return;
  g.innerHTML = CA.team.map(function (m) {
    var first = m.name.split(' ')[0];
    return '<article class="person" data-reveal>' +
      '<div class="person__media frame frame--3x4 rv-img">' +
        '<img src="' + m.img + '" alt="' + m.name + '" loading="lazy" decoding="async" ' +
        'data-fallback="' + m.fallback + '" data-ph="' + first + '" data-ph-sub="Portrait to follow">' +
      '</div>' +
      '<h2 class="person__name" style="margin-top:1.25rem">' + m.name + '</h2>' +
      '<p class="person__role">' + m.role + '</p>' +
      '<p class="person__years">' + m.years + '</p>' +
      '<p class="person__bio">' + m.bio + '</p>' +
      '<div class="person__spec">' +
        m.spec.map(function (x) { return '<span class="tag">' + x + '</span>'; }).join('') +
      '</div>' +
      '<p style="margin-top:1.25rem"><button class="btn btn--sm btn--ghost" data-book="true">' +
        'Book with ' + first + '</button></p>' +
    '</article>';
  }).join('');
  if (window.caObserve) window.caObserve(g);
  if (window.caImageFallback) window.caImageFallback();
  window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: g } }));
})();
</script>"""


def page_team():
    return (
        head("The Team — Cut Above, Dubai",
             "Ten certified specialists: award-winning hair artists, Guinot and Dermalogica "
             "institute graduates, nail technicians and massage therapists.")
        + topbar_open() + notice() + nav() + topbar_close()
        + f"""
<main id="main">
{phead("The Team", "The people who<br>actually <em>do the work.</em>",
       "Between them, more than two hundred years on the floor. Several have been at Cut Above "
       "since the nineties, and a great many clients book by name rather than by treatment.")}

  <section class="section--tight" style="padding-top:0">
    <div class="shell">
      <figure class="team-quote" data-reveal>
        <blockquote class="quote quote--big">
          “No one could match her level of talent and understanding of my hair… and
          <em style="color:var(--champagne)">Fruity gives the best head massages.</em>”
        </blockquote>
        <figcaption class="testi__who">A client, on Angelica — Google review</figcaption>
      </figure>
      <div class="stats" data-stagger="110">
        <div class="stat" data-reveal><div class="stat__k"><span data-count="10">10</span></div><div class="stat__v">Specialists on the floor, across hair, skin, nails and massage.</div></div>
        <div class="stat" data-reveal><div class="stat__k"><span data-count="200">200</span>+</div><div class="stat__v">Years of combined experience between them.</div></div>
        <div class="stat" data-reveal><div class="stat__k"><span data-count="1992">1992</span></div><div class="stat__v">The year our longest-serving therapist joined — the year we opened.</div></div>
        <div class="stat" data-reveal><div class="stat__k">0</div><div class="stat__v">Juniors let loose on your colour. Assistants assist; specialists do the work.</div></div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:var(--s-7)">
    <div class="shell">
      <div class="sec-head">
        <span class="sec-head__n">The floor</span>
        <h2 class="sec-head__t display display--2">Ask for them by name.</h2>
        <p class="sec-head__aside">Certifications from Schwarzkopf, the Guinot Institute in Paris
          and the Dermalogica Institute. Request anyone directly when you book.</p>
      </div>
      <div class="team-grid" data-team-grid data-stagger="90"></div>
    </div>
  </section>
</main>
"""
        + footer() + scripts(inline=TEAM_SCRIPT)
    )


# ============================================================== HOUSES =====
HOUSES_SCRIPT = """<script>
(function () {
  var h = document.querySelector('[data-houses]');
  if (!h || !window.CA) return;
  h.innerHTML = CA.brands.map(function (b) {
    return '<article class="house" data-reveal>' +
      '<span class="house__cat">' + b.cat + '</span>' +
      '<h2 class="house__n">' + b.name + '</h2>' +
      '<p class="house__o">' + b.origin + '</p>' +
      '<p class="house__b">' + b.body + '</p>' +
    '</article>';
  }).join('');
  if (window.caObserve) window.caObserve(h);
  window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: h } }));
})();
</script>"""


def page_houses():
    return (
        head("The Houses — Products &amp; Partners — Cut Above, Dubai",
             "Schwarzkopf Professional, Guinot Paris, Dermalogica, Olaplex, Great Lengths, "
             "Philip Martin's, K-18, Malibu C, Luxio by Akzentz and JB Lashes.")
        + topbar_open() + notice() + nav() + topbar_close()
        + f"""
<main id="main">
{phead("Houses", "We only work with<br>what <em>we trust.</em>",
       "Ten professional houses, every one of them chosen because the result still holds up in "
       "the fourth week, not just on the day.")}

  <section class="section--tight" style="padding-top:0">
    <div class="shell">
      <div class="split split--flip">
        <div class="split__text">
          <p class="label" data-reveal>How we choose</p>
          <h2 class="quote" data-reveal style="--rd:100ms;margin-top:1rem">
            A product earns its place on our shelf by <em style="color:var(--champagne)">surviving
            a Dubai summer</em> — not by winning an award.
          </h2>
        </div>
        <div class="split__media">
          <div class="frame frame--16x9 rv-img" style="margin-bottom:var(--s-5)">
            <img src="assets/img/editorial/houses-lead.jpg" alt="Colour work in progress"
                 loading="lazy" decoding="async" data-ph="On the floor" data-ph-sub="Photograph to follow">
          </div>
          <p class="body-copy" data-reveal style="--rd:160ms">
            Hard water, chlorine, air conditioning and forty-five degrees do things to hair and
            skin that a European product range was never tested against. Everything here has been
            through that on our own clients before it was offered to anyone.
          </p>
          <p class="body-copy" data-reveal style="--rd:220ms">
            Our colourists are Schwarzkopf-certified. Our skin therapists trained at the Guinot
            Institute in Paris and the Dermalogica Institute. Our lash specialists are certified
            in the JB Lashes system. That is not marketing — it is why the results are repeatable.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:var(--s-7)">
    <div class="shell">
      <div class="sec-head">
        <span class="sec-head__n">Ten houses</span>
        <h2 class="sec-head__t display display--2">What we put on you.</h2>
        <p class="sec-head__aside">Hair, skin, nails and lashes. Retail is limited to what we
          actually use on the floor.</p>
      </div>
      <div class="houses" data-houses></div>

      <div class="split" style="margin-top:var(--s-10)">
        <div class="split__media">
          {frame("assets/img/editorial/products.jpg", "Professional products on the shelf", "4x5",
                 "https://www.cutabove-salon.com/images/sliders/006.jpg", "Retail", "Product photograph")}
        </div>
        <div class="split__text">
          <p class="label" data-reveal>Take it home</p>
          <h2 class="display display--2" data-reveal style="--rd:100ms;margin-top:1rem">
            The shelf is not an upsell.
          </h2>
          <p class="body-copy" data-reveal style="--rd:180ms;margin-top:1.5rem">
            Everything we retail is something we use in the chair. If your colour needs a bond
            builder to get through the summer we will tell you which one and why — and if it
            does not, we will tell you that too.
          </p>
          <p class="body-copy" data-reveal style="--rd:230ms">
            Nothing is recommended that a therapist here has not used on a client. That is the
            whole policy.
          </p>
          <p data-reveal style="--rd:280ms;margin-top:2rem">
            <a class="tlink" href="services.html">See what each one is used for {ICON_ARROW}</a>
          </p>
        </div>
      </div>
    </div>
  </section>
</main>
"""
        + footer() + scripts(inline=HOUSES_SCRIPT)
    )


# ============================================================= GALLERY =====
def page_gallery():
    return (
        head("Gallery — Cut Above, Dubai",
             "Recent work from the floor at Cut Above: colour, cutting, nails and skin.")
        + topbar_open() + notice() + nav() + topbar_close()
        + f"""
<main id="main">
{phead("Gallery", "The work,<br>not the <em>stock photos.</em>",
       "Colour, cutting, nails and skin — shot on the floor at Jumeirah Centre.")}

  <section class="section" style="padding-top:0">
    <div class="shell">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem">
        <div class="gal-filters" data-gallery-filters></div>
        <span class="label label--dim" data-gallery-count></span>
      </div>

      <div class="gal" data-gallery></div>
      <div class="gal u-hide" data-gallery-ph></div>

      <div class="gal-empty u-hide" data-gallery-empty>
        <p class="label">Gallery is empty</p>
        <h2 class="display display--3" style="margin-top:1rem">Drop the photographs in and this fills itself.</h2>
        <p class="body-copy" style="margin:1.5rem auto 0;text-align:left;max-width:34rem">
          Put image files into <code>assets/img/gallery/</code> named
          <code>01.jpg</code>, <code>02.jpg</code>, <code>03.jpg</code> and so on, then set
          <code>COUNT</code> in <code>assets/js/data.js</code> to however many you added.
          Anything missing removes its own tile, so an over-estimate is harmless.
        </p>
        <p class="body-copy" style="margin:1rem auto 0;text-align:left;max-width:34rem">
          Captions and categories are optional — fill in <code>CA.galleryMeta</code> to add them.
        </p>
      </div>

      <div style="margin-top:var(--s-9);display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
        <a class="btn" data-biz-ig href="#" target="_blank" rel="noopener">More on Instagram {ICON_ARROW}</a>
        <button class="btn btn--solid" data-book="true">Book the same</button>
      </div>
    </div>
  </section>
</main>
{lightbox()}
"""
        + footer() + scripts(["gallery.js"])
    )


# ============================================================= CONTACT =====
def page_contact():
    return (
        head("Contact &amp; Find Us — Cut Above, Jumeirah Centre, Dubai",
             "1st Floor, Jumeirah Centre, Jumeirah 1, Dubai. Call +971 4 344 6444 or "
             "WhatsApp +971 50 517 5311.")
        + topbar_open() + notice() + nav() + topbar_close()
        + f"""
<main id="main">
{phead("Contact", "First floor,<br><em>Jumeirah Centre.</em>",
       "On Jumeirah Beach Road, with parking on site. Walk-ins are welcome but Saturdays book out.")}

  <section class="section" style="padding-top:0">
    <div class="shell">
      <div class="contact-grid">
        <div class="contact-grid__a">
          <dl style="margin:0">
            <div class="contact-line" data-reveal><dt>Address</dt><dd>1st Floor, Jumeirah Centre<br>Jumeirah 1, Dubai, U.A.E.</dd></div>
            <div class="contact-line" data-reveal><dt>Telephone</dt><dd><a data-biz-phone href="#"></a></dd></div>
            <div class="contact-line" data-reveal><dt>WhatsApp</dt><dd><a data-biz-wa href="#" target="_blank" rel="noopener"></a></dd></div>
            <div class="contact-line" data-reveal><dt>Email</dt><dd><a data-biz-email href="#"></a></dd></div>
          </dl>

          <div style="margin-top:2rem" data-reveal>
            <span class="pill" data-open-pill></span>
          </div>

          <h3 class="foot__h" style="margin-top:2.5rem">Opening hours</h3>
          <dl data-hours style="margin:0"></dl>

          <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:2.5rem">
            <button class="btn btn--solid" data-book="true" data-magnet="0.25">Request an appointment</button>
            <a class="btn" data-biz-phone href="#"></a>
          </div>
        </div>

        <div class="contact-grid__b">
          <div class="map-frame" data-reveal>
            <iframe title="Map to Cut Above, Jumeirah Centre" loading="lazy"
              referrerpolicy="no-referrer-when-downgrade" allowfullscreen
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3611.674509817682!2d55.26045831501339!3d25.23102758388457!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f4253c13f7157%3A0xfcb169270564209f!2sCut%20Above%20Hair%20%26%20Beauty%20Salon!5e0!3m2!1sen!2sae!4v1700000000000"></iframe>
          </div>
          <p style="margin-top:1.25rem" data-reveal>
            <a class="tlink" href="https://maps.google.com/?q=Cut+Above+Hair+%26+Beauty+Salon+Jumeirah+Centre+Dubai" target="_blank" rel="noopener">Open in Google Maps {ICON_ARROW}</a>
          </p>

          <div style="margin-top:2.5rem;display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))">
            <div data-reveal>
              <h3 class="foot__h">Parking</h3>
              <p class="body-copy">On-site parking at Jumeirah Centre, plus street parking along the
                Beach Road side.</p>
            </div>
            <div data-reveal>
              <h3 class="foot__h">Payment</h3>
              <p class="body-copy">Cash and card. Packages are pre-paid and transferable within the
                household.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>
"""
        + footer() + scripts()
    )


# =============================================================== LEGAL =====
def page_legal():
    return (
        head("This is a concept — not the Cut Above website",
             "An unaffiliated design concept for Cut Above Hair & Beauty Salon, built by "
             "Vector Workflows. Not endorsed by or connected to the salon.")
        .replace('<link rel="stylesheet" href="assets/css/tokens.css">',
                 '<meta name="robots" content="noindex, nofollow">\n<link rel="stylesheet" href="assets/css/tokens.css">')
        + topbar_open() + nav() + topbar_close()
        + f"""
<main id="main">
{phead("What this is", "This is not<br>the <em>real website.</em>",
       "Please read this before you read anything else here.")}

  <section class="section" style="padding-top:0">
    <div class="shell">
      <div class="prose">
        <p><strong>This site is a concept. It is not the website of Cut Above Hair &amp; Beauty
        Salon, and the salon has nothing to do with it.</strong> Nobody at Cut Above commissioned
        it, approved it, reviewed it, or paid for it. It is not affiliated with, endorsed by, or
        connected to the salon, its owners, its staff, or any of the brands named on it.</p>

        <p>The salon's actual website is
        <a href="https://www.cutabove-salon.com/" target="_blank" rel="noopener nofollow">cutabove-salon.com</a>.
        For anything real — bookings, prices, availability — please go there, or call the salon
        on <a data-biz-phone href="#"></a>.</p>

        <p>Everything on these pages, including every price and every opening time, should be
        treated as possibly wrong. Nothing here is an offer, a quotation, or a commitment of any
        kind, and no appointment made through this site is real.</p>

        <h2>Who built it, and why</h2>
        <p>It was built by <a href="https://vectorworkflows.com" target="_blank" rel="noopener">Vector
        Workflows</a>, unbuilt and unasked, as a proposal. The salon has been in Jumeirah since 1992
        and its website has not been updated since 2015. Rather than send a pitch describing what a
        redesign could look like, we built the redesign and sent that instead.</p>

        <p>If you are from Cut Above and are reading this because a link arrived in your inbox: the
        email came from the same people who made this page. That is the only connection between us,
        and there is no obligation attached to any of it.</p>

        <h2>About the content on these pages</h2>
        <ul>
          <li><strong>Text, service names and prices</strong> are taken from the salon's own public
          website, purely to show how a real page would sit in this layout. They may be out of
          date or mistranscribed.</li>
          <li><strong>Photographs</strong> are the salon's own, posted publicly on their Instagram,
          used here at low resolution only to demonstrate how a gallery would present them. They
          remain the property of their owners, are used for non-commercial demonstration only, and
          any or all of them will be removed immediately on request.</li>
          <li><strong>Reviews</strong> quoted here are real, from the salon's public Google listing,
          reproduced with the reviewers' public display names and trimmed for length. The listing
          also contains criticism, which is not shown — this page is a design demonstration, not a
          fair summary of the salon's reputation.</li>
          <li><strong>Brand names</strong> — Schwarzkopf, Guinot, Dermalogica, Olaplex, Great
          Lengths, Philip Martin's, K-18, Malibu C, Luxio by Akzentz, JB Lashes — belong to their
          respective owners and appear here descriptively, because the salon names them. No
          endorsement by any of them is claimed or implied.</li>
          <li><strong>The booking flow</strong> is a front-end demonstration. It has no back end.
          It stores nothing and sends nothing anywhere; it only composes a message that you could
          then choose to send yourself.</li>
        </ul>

        <h2>Taking it down</h2>
        <p>If you represent Cut Above Hair &amp; Beauty Salon, or you hold rights in anything shown
        here, or you are one of the reviewers quoted and would rather not be — say so and it comes
        down. No argument, no delay, no questions. Reach us through
        <a href="https://vectorworkflows.com" target="_blank" rel="noopener">vectorworkflows.com</a>
        or just reply to the email this link came from.</p>

        <h2>Nothing is collected</h2>
        <p>This page has no analytics, no tracking pixels, no cookies of its own and no server. The
        map is embedded from Google and the fonts are served by Google Fonts; those two requests are
        subject to Google's own policies.</p>

        <p style="margin-top:3rem"><a class="tlink" href="index.html">Back to the concept {ICON_ARROW}</a></p>
      </div>
    </div>
  </section>
</main>
"""
        + footer() + scripts()
    )


PAGES = {
    "index.html": page_index,
    "services.html": page_services,
    "team.html": page_team,
    "houses.html": page_houses,
    "gallery.html": page_gallery,
    "contact.html": page_contact,
    LEGAL: page_legal,
}

if __name__ == "__main__":
    for name, fn in PAGES.items():
        html = fn()
        with open(os.path.join(ROOT, name), "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  wrote {name:<80} {len(html):>7,} bytes")
    print("\nDone.")
