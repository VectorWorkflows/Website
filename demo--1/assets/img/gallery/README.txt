GALLERY PHOTOS GO HERE
======================

1. Drop image files into this folder.
2. Name them  01.jpg  02.jpg  03.jpg  …  (two digits, in the order you want
   them to appear).
3. Open  assets/js/data.js  and set  COUNT  to however many you added.

That's it. The page builds the masonry grid, the filters, the counter and the
lightbox from whatever is actually here.

NOTES
-----
* Any file that isn't present removes its own tile, so COUNT can be a generous
  over-estimate — set it to 40 and drop in 12 today, 28 more tomorrow.
* .webp or .png work too — change EXT in data.js to match.
* Portrait, landscape and square all work; the layout is a true masonry column
  flow, so mixed shapes look intentional rather than ragged.
* Around 1400px on the long edge, saved at ~75% quality, is the sweet spot.
  Much larger and the page gets heavy for no visible gain.

CAPTIONS AND CATEGORIES (optional)
----------------------------------
In data.js, fill in CA.galleryMeta:

    CA.galleryMeta = {
      1:  { cat: 'Colour', cap: 'Airtouch blonde, four sittings' },
      2:  { cat: 'Hair',   cap: 'Curly method, dry cut' },
      7:  { cat: 'Nails',  cap: 'Chrome ombre, Luxio' },
    };

Anything you don't list gets a default caption and still shows under "All".
Categories available: Hair · Colour · Nails · Skin · Salon
