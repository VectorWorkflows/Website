# Cut Above — concept site

Upload this folder as-is. Every path is relative, so it works at a domain root
or under a long path like `yoursite.com/work/cut-above-concept/`.

Static HTML, CSS and JavaScript. No build step, no dependencies, no back end.
Open `index.html` locally and it runs.

```
index.html          Home
services.html       Full price list — tabbed, searchable
team.html           The ten specialists
houses.html         Product houses
gallery.html        Masonry gallery + lightbox
contact.html        Address, hours, map

legal/              The "this is a concept" disclaimer, on a long slug.
                    Linked from the notice bar on every page. Keep it.

images/             Everything, flat and prefixed:
                      hero-*        the four rotating hero plates
                      gallery-*     the 38 gallery photographs
                      team-*        staff portraits
                      editorial-*   the monochrome home/houses images

resources/
  content.js        ALL CONTENT. Prices, team bios, hours, brands, the
                    gallery manifest, the availability rota. Edit this.
  site.css          Every stylesheet, in load order.
  site.js           Every script, in load order.
```

---

## Changing things

**Prices, team, hours, phone numbers, the rota** — `resources/content.js`.
Nothing is hardcoded in the pages; change a price there and it updates on the
price list, in the booking flow, and anywhere else it appears.

**Colours and type** — the top of `resources/site.css`. The whole palette is
about fifteen custom properties; changing `--champagne` restyles the site.

**Gallery photos** — drop files into `images/` named `gallery-01.jpg`,
`gallery-02.jpg` … and set `COUNT` in `content.js`. Any file that isn't there
removes its own tile, so an over-estimate is harmless.

**Hero photos** — replace `images/hero-01.jpg` and its `-800` pair, then edit
the `data-cap` on that slide in `index.html`. Sources are 3:4.

---

## Before this goes in front of the client

- [ ] **Opening hours** came from their Fresha listing, not their own site.
      Confirm them.
- [ ] **The rota** in `content.js` (`CA.availability`) is invented, to
      demonstrate the mechanism. Get the real one, or delete the block — the
      flow falls back to opening hours alone without it.
- [ ] **"Thirty-four years"** is calculated from the 1992 founding date on
      their site. Their Instagram has said 35. Pick one.
- [ ] **Prices** were transcribed in September 2026. Spot-check a few.
- [ ] **Reviews** are real, from their public Google listing, and the listing
      also contains criticism that isn't shown. The salon should choose which
      appear, and reviewers haven't been asked.
- [ ] Keep the disclaimer reachable and the notice bar in place. It's what
      makes an unsolicited redesign read as flattery rather than a liberty.

The working files — the page generator, the scheduling write-up, the gallery
selection notes — stay in the `Demo Site` folder. None of it belongs on a
server.
