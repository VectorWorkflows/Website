IMAGE FOLDERS
=============

gallery/    The main gallery. See the README inside it.

team/       Staff portraits. Name them to match data.js:
            emiliya.jpg  angelica.jpg  natalia.jpg  yvonne.jpg  carina.jpg
            alma.jpg  liza.jpg  donnalyn.jpg  jinky.jpg  fruity.jpg
            Portrait crop, roughly 3:4. Until these exist the page falls back
            to the portraits on the salon's current site, and if those are
            unreachable it draws a typographic placeholder instead.

editorial/  The large art-directed images on the home page and Houses page:
            salon.jpg  hair.jpg  skin.jpg  nails.jpg  products.jpg
            Same fallback behaviour as above.

brands/     Optional. Not currently referenced by the layout — the Houses page
            is set in type on purpose, because logo grids date badly.

NOTHING BREAKS IF THESE ARE EMPTY. Every image slot degrades to a designed
placeholder rather than a broken-image icon.
