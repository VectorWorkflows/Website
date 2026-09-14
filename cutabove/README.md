# Cut Above — concept redesign

A speculative redesign of **cutabove-salon.com**, built as a pitch. Static HTML,
CSS and JavaScript. No build step, no dependencies, no back end. Double-click
`index.html` and it runs; drop the folder on any host and it runs there too.

---

## Run it

**Locally** — open `index.html`. Everything works from `file://` on purpose:
all content is loaded as a plain `<script>` rather than `fetch()`ed JSON, which
browsers block on local files.

**Hosted** — upload the whole folder. Every link is relative, so it works at a
domain root or buried under a long path like
`yoursite.com/work/cut-above-concept-2026/`.

Two things need the internet: the Google Fonts link and the Google Maps embed on
the contact page. Both degrade cleanly without it.

---

## Where everything lives

```
index.html          Home
services.html       Full price list — tabbed, searchable
team.html           All ten specialists
houses.html         Product houses / brand partners
gallery.html        Masonry gallery + lightbox
contact.html        Address, hours, map
concept-demonstration-not-affiliated-…html    The disclaimer page

assets/css/
  tokens.css        Colour, type scale, spacing, motion. Start here.
  base.css          Reset, typography, the reveal system
  components.css    Nav, buttons, cards, lightbox, booking modal, footer
  pages.css         Hero, home sections, pricing, gallery, team, contact

assets/js/
  data.js           ALL CONTENT. Prices, team, brands, hours, gallery config.
  app.js            Preloader, cursor, nav, reveals, parallax, chrome
  hero.js           The hero photographic plate (cross-dissolve + parallax)
  pricing.js        Price list rendering, tabs, live search
  gallery.js        Masonry build, self-healing image probe, lightbox
  booking.js        Five-step appointment request flow

build.py            Authoring helper that regenerates the HTML from shared
                    partials. Not needed to run or host the site — but if you
                    edit shared chrome (nav/footer), edit build.py and re-run
                    `python3 build.py` rather than editing seven files.
```

---

## Changing things

**Prices, team, brands, hours, phone numbers** — all in `assets/js/data.js`.
Nothing is hardcoded in the HTML. Change a price there and it updates on the
price list, in the booking flow, and anywhere else it appears.

**Colours and type** — `assets/css/tokens.css`. The whole palette is about
fifteen custom properties. Changing `--champagne` restyles the entire site.

**Photos** — see `assets/img/README.txt`.

**Hero images** — `assets/img/hero/`. Four plates at 1400x1867 plus 800w
variants. To swap one, replace the pair and edit the `data-cap` on its
`.hero__slide` in `build.py`. Sources are 3:4, which every phone photo already
is, so nothing distorts.

**The colour reveal** on the home page (panel 02) is a `.swatch`: a monochrome
image stacked over its colour original, lifted on hover, keyboard focus or tap.
To add another, copy the markup in `build.py` and drop in the two files.

**Shared nav/footer** — `build.py`, then re-run it.

---

## What's actually built

- **Hero** — a full-height photographic plate of the salon's own work sitting
  behind the headline. Four images cross-dissolve on a ~7s hold, each with a
  slow continuous push-in so it never reads as a static crop; the plate rises
  on load, lags the page on scroll, and its scrim deepens as you leave. Its
  inner edge is masked so it dissolves into the ink rather than butting against
  it. Counter, caption and progress bar bottom right, click to step.
  Responsive `srcset` (800w / 1400w). Pauses off-screen and when the tab is
  hidden; holds a single still frame under reduced-motion.

  There is deliberately no generative/canvas background. An abstract animation
  is what you reach for when you have no photography — this salon has plenty,
  and the work is more persuasive than any effect.
- **Custom cursor** — dot and ring with lag, expanding on links, a "VIEW" disc
  over gallery tiles, a caret over text fields. The native pointer is hidden
  (`html.has-cursor`), and that class is only added once ours is on screen, so
  a failure can never leave the page with no pointer. Off on touch and under
  reduced-motion, where the native cursor stays.
- **Reveal system** — IntersectionObserver, line-by-line masked text, staggered
  children via `data-stagger`, image clip reveals.
- **Price list** — four tabs, live search across all four at once, match
  highlighting, deep-linkable (`services.html#skin`).
- **Gallery** — CSS-grid masonry with double-width feature tiles, laid out from
  dimensions recorded in the manifest so it settles before any image loads.
  Category filters, keyboard and swipe lightbox.
- **Booking flow** — five steps, generates real date and time slots from the
  opening hours in `data.js`, ends by composing a complete WhatsApp message or
  placing a call. No third-party platform, no back end, stores nothing.
- **Opening-hours logic** — computed live from `CA.biz.hours` in **Asia/Dubai**,
  so a viewer in London sees the salon's clock, not their own. Shows
  "Closing in 20 min" / "Closed — opens in 3 hours", and reveals a directions
  card on hover, tap or keyboard focus.
- **Page transitions**, magnetic buttons, parallax, animated counters.

### Degradation

Everything above is progressive enhancement. With JavaScript disabled the pages
are still readable documents. Under `prefers-reduced-motion` the canvas renders
one static frame, the cursor is removed, transitions are dropped and all
reveals resolve immediately. Every image slot falls back — first to the
photograph on the salon's current site, then to a designed typographic
placeholder. There are no broken-image icons anywhere.

---

## Before this goes in front of the client

- [x] **Gallery photos.** 38 curated from the 80 downloaded Instagram stills.
      Selection notes in `assets/img/gallery/SELECTION.txt`.
- [x] **Editorial images** — monochrome conversions in `assets/img/editorial/`.
- [x] **Team portraits** — all ten, supplied by the client folder. Sources are
      only 170x233, upscaled 2x with a light unsharp; the monochrome treatment
      hides it well, but larger originals would be better if they exist.
- [x] **Testimonials** — seven real reviews from the salon's public Google
      listing, trimmed for length. See the NOTE in `data.js`: the listing also
      contains criticism, and reviewers have not been asked.
- [ ] **Opening hours** came from the salon's Fresha listing, not their own
      site, which doesn't publish them. Worth confirming.
- [ ] **"Thirty-four years"** is calculated from the 1992 founding date on their
      site. Their Instagram has said 35. Pick one.
- [ ] **Prices** were transcribed from their site in September 2026. Spot-check
      a few before the meeting.
- [ ] Keep the disclaimer page reachable, and keep the notice bar. It's the
      thing that makes an unsolicited redesign read as flattery rather than
      as a liberty.
