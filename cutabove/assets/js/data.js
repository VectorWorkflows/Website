/* ============================================================================
   CUT ABOVE — CONTENT LAYER
   ---------------------------------------------------------------------------
   Every piece of copy, price and image reference the site renders lives here.
   Plain <script> (not JSON) on purpose: the site must run from a double-clicked
   index.html with no server, and fetch() is blocked on file:// URLs.

   TO UPDATE PRICES  → edit CA.services
   TO UPDATE TEAM    → edit CA.team
   TO ADD PHOTOS     → see CA.gallery at the bottom of this file
   ========================================================================= */

window.CA = {};

/* ---------------------------------------------------------------- business */
CA.biz = {
  name: 'Cut Above',
  full: 'Cut Above Hair & Beauty Salon',
  founded: 1992,
  address1: '1st Floor, Jumeirah Centre',
  address2: 'Jumeirah 1, Dubai, U.A.E.',
  phone: '+971 4 344 6444',
  phoneHref: '+97143446444',
  whatsapp: '+971 50 517 5311',
  whatsappHref: '971505175311',
  email: 'info@cutabove-salon.com',
  instagram: 'https://www.instagram.com/cutabovedubaisalon/',
  instagramHandle: '@cutabovedubaisalon',
  facebook: 'https://www.facebook.com/CutAboveSalonDubai/',
  // The salon's existing Fresha listing. Deliberately NOT used anywhere in the
  // site: every booking path here goes straight to the salon. Kept only so it
  // is one line away if they'd rather keep the platform in the loop.
  bookingPlatform: 'https://www.fresha.com/a/cut-above-ladies-salon-dubai-jumeirah-center-beach-road-c58lhqwi/all-offer?menu=true',
  maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3611.674509817682!2d55.26045831501339!3d25.23102758388457!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f4253c13f7157%3A0xfcb169270564209f!2sCut%20Above%20Hair%20%26%20Beauty%20Salon!5e0!3m2!1sen!2sae!4v1700000000000',
  mapsLink: 'https://maps.google.com/?q=Cut+Above+Hair+%26+Beauty+Salon+Jumeirah+Centre+Dubai',
  hours: [
    { d: 'Monday',    o: '09:00', c: '18:30' },
    { d: 'Tuesday',   o: '09:00', c: '18:30' },
    { d: 'Wednesday', o: '09:00', c: '19:30' },
    { d: 'Thursday',  o: '09:00', c: '18:30' },
    { d: 'Friday',    o: '09:00', c: '18:30' },
    { d: 'Saturday',  o: '09:00', c: '19:30' },
    { d: 'Sunday',    o: '09:00', c: '18:30' }
  ]
};

/* --------------------------------------------------------------- headlines */
CA.hero = {
  eyebrow: 'Jumeirah, Dubai — Est. 1992',
  lines: ['Thirty-four years', 'of never doing', 'the same head twice.'],
  sub: 'One of the first Western salons in the U.A.E. We have never mass produced a look. Every cut, every colour, every treatment is conceived around one face, one head of hair, one person.',
};

CA.manifesto = [
  { k: '1992', v: 'The year we opened on Jumeirah Beach Road — before most of this city existed.' },
  { k: '34', v: 'Years in the same building, with clients who have been coming for most of them.' },
  { k: '10', v: 'Specialists on the floor. Not one of them is new to this.' },
  { k: '8', v: 'Houses we are certified to work with, from Schwarzkopf to Guinot.' }
];

/* ------------------------------------------------------------- disciplines */
CA.disciplines = [
  {
    id: 'hair',
    n: '01',
    title: 'Hair',
    lead: 'Cut, colour and correction',
    body: 'Precision cutting, the curly method, thermal scissor work and colour that is engineered rather than guessed — airtouch, balayage, babylights, hand-free painting and the kind of colour correction other salons send people to us for.',
    tags: ['Precision cutting', 'Airtouch', 'Balayage', 'Colour correction', 'Curly method', 'Great Lengths extensions'],
    img: 'assets/img/editorial/hair.jpg'
  },
  {
    id: 'skin',
    n: '02',
    title: 'Skin',
    lead: 'Guinot & Dermalogica',
    body: 'A skin treatment is specific to the client it is designed for. Our therapists trained at the Guinot Institute in Paris and the Dermalogica Institute, and they read your skin before they touch it — not after.',
    tags: ['Hydradermie', 'Age Summum', 'Deep extraction', 'Vitamin C', 'Ultracalming', 'Bio-peeling'],
    img: 'assets/img/editorial/skin.jpg'
  },
  {
    id: 'nails',
    n: '03',
    title: 'Nails',
    lead: 'Luxio, Gelish & Shellac',
    body: 'Fourteen-day wear as a floor, not a ceiling. Vegan, hypoallergenic, solvent-free gel systems, spa manicures and pedicures, extensions, refills and nail art that survives a Dubai summer.',
    tags: ['Spa manicure', 'Gelish', 'Shellac', 'Extensions', 'Nail art', 'Luxio by Akzentz'],
    img: 'assets/img/editorial/nails.jpg'
  },
  {
    id: 'body',
    n: '04',
    title: 'Body',
    lead: 'Massage & wellness',
    body: 'Deep tissue, Swedish, Thai, lymphatic drainage with tools, pre- and post-natal, couples and four-hands. Reflexology, cupping, ear candling — sixty, ninety or a hundred and twenty minutes of properly trained hands.',
    tags: ['Deep tissue', 'Lymphatic drainage', 'Reflexology', 'Pre-natal', 'Four hands', 'Bellabaci cupping'],
    img: 'assets/img/editorial/body.jpg'
  }
];

/* ------------------------------------------------------------ price list */
/* group: the tab it appears under.  note: optional small print.            */
CA.services = [
  {
    group: 'Hair',
    cats: [
      {
        name: 'Cutting & Styling',
        note: 'Director-level pricing shown where applicable.',
        items: [
          ['Cut only', '270', 'Director 350'],
          ['Cut & blow dry', '360', 'Director 390'],
          ['Re-styling', '420', 'Director 450'],
          ['Thermal scissors cut', '420', 'Includes blow dry'],
          ['Curly method blow dry', '420–450', ''],
          ['Hair up', '410', ''],
          ['Blow dry', '190', ''],
          ['Tongs & curling', '190', ''],
          ['Child cut & blow dry', '170', 'Age 12 and under'],
          ['Hair wash', '60', ''],
          ['Blow dry package', '1,700', '10 sessions'],
          ['Bridal hair up', 'On consultation', '']
        ]
      },
      {
        name: 'Colour & Glossing',
        items: [
          ['Each foil', '60', ''],
          ['Semi glossing', '270–290', 'Short / Long'],
          ['Root retouch', '310', ''],
          ['T-bar', '375', ''],
          ['Half head highlights', '465', ''],
          ['Full head highlights', '665', ''],
          ['Full head tint', '450–550', 'Short / Long'],
          ['Root scalp bleach', 'from 460', ''],
          ['Face lifting + face frame', 'from 520', ''],
          ['Hair colour removal', '410', ''],
          ['Colour melting', 'from 600', ''],
          ['Airtouch natural touch-up', '620', ''],
          ['Ombré & balayage', 'from 900', ''],
          ['Hand-free painting', '900', ''],
          ['Babylights', 'from 900', ''],
          ['Colour correction', 'from 950', ''],
          ['Airtouch', 'from 1,200', '']
        ]
      },
      {
        name: 'Treatments',
        items: [
          ['Coconut oil treatment', '250', ''],
          ['Hydré hydration boost', '250', '20 minutes'],
          ['Olaplex treatment', '265', ''],
          ['K-18 treatment', '270', ''],
          ['Philip Martin’s conditioning', '320', ''],
          ['Caviar treatment', '320', ''],
          ['Perming', 'from 550', ''],
          ['Keratin, straightening, hair botox', 'from 870', ''],
          ['Brazilian blow cream', 'from 870', ''],
          ['Brazilian blow out', '1,200', ''],
          ['Hair extensions', 'On consultation', 'Great Lengths']
        ]
      }
    ]
  },
  {
    group: 'Skin',
    cats: [
      {
        name: 'Guinot Facials',
        note: 'Institut Guinot, Paris — trained therapists only.',
        items: [
          ['Teen age deep cleansing', '250', ''],
          ['Basic cleansing', '330', ''],
          ['Aromatic therapy', '380', ''],
          ['Deep cleansing', '390', ''],
          ['Eye age logic', '390', ''],
          ['Guinot signature facial', '400', ''],
          ['Eye logic lifting', '400', ''],
          ['Antibacterial treatment', '420', ''],
          ['Hydradermie facial', '450', ''],
          ['Liftsome pro collagen contouring', '520', ''],
          ['Hybrid peel PH', '550', ''],
          ['Hydradermie lift deluxe', '560', ''],
          ['Black re-surfacing facial', '680', ''],
          ['Signature deluxe', '750', ''],
          ['Age summum lifting', '850', ''],
          ['Hydra peel PH signature deluxe', '850', '']
        ]
      },
      {
        name: 'Dermalogica Facials',
        items: [
          ['Eye treatment', '260', ''],
          ['Mini face deep cleanse', '400', '45 minutes'],
          ['Black replenish', '400', ''],
          ['Dermalogica signature facial', '500', ''],
          ['Hydrating skin moisture boost', '535', ''],
          ['Ultracalming treatment', '550', 'Redness relief'],
          ['Deep extraction system', '600', ''],
          ['Combination skin treatment', '625', ''],
          ['Age smart up lifting', '625', ''],
          ['Vitamin C treatment', '640', '']
        ]
      },
      {
        name: 'Waxing',
        items: [
          ['Eyebrows', '30', ''], ['Upper lip', '30', ''], ['Chin', '30', ''],
          ['Under arm', '45', ''], ['Bikini line', '50', ''], ['Half arm', '75', ''],
          ['Half leg', '75', ''], ['Three-quarter leg', '85', ''], ['Full arm', '85', ''],
          ['Back', '90', ''], ['Stomach', '90', ''], ['Upper leg', '90', ''],
          ['Full face', '110', ''], ['Full bikini', '120', ''], ['Full leg', '160', ''],
          ['Full leg & bikini line', '180', ''], ['Full body', '500', '']
        ]
      },
      {
        name: 'Threading & Bleaching',
        items: [
          ['Threading — eyebrows', '30', ''],
          ['Threading — upper lip', '30', ''],
          ['Threading — chin', '30', ''],
          ['Threading — full face', '140', ''],
          ['Threading — full face & eyebrows', '150', ''],
          ['Bleaching — arms', '90', ''],
          ['Bleaching — face', '110', ''],
          ['Bleaching — full legs', '200', ''],
          ['Bleaching — full body', '500', '']
        ]
      },
      {
        name: 'Eyes & Lashes',
        items: [
          ['Eyebrow tint', '70', ''],
          ['Eyelash tint', '100', ''],
          ['Eyelash perming', '250', ''],
          ['Eyelash refill', '285', ''],
          ['Eyelash extensions', '500', 'JB Lashes']
        ]
      }
    ]
  },
  {
    group: 'Nails',
    cats: [
      {
        name: 'Manicure & Pedicure',
        note: 'Prices start from. Luxio by Akzentz — vegan, hypoallergenic, 14+ day wear.',
        items: [
          ['Nail art', '30', 'Per nail'],
          ['Classic shape & polish change', '45', ''],
          ['Gelish removal', '50', ''],
          ['French shape & polish change', '55', ''],
          ['Classic manicure', '90', ''],
          ['French manicure', '95', ''],
          ['Classic pedicure', '100', ''],
          ['Removal — extension', '100', ''],
          ['French pedicure', '105', ''],
          ['Spa manicure', '160', ''],
          ['Spa pedicure', '200', ''],
          ['Gelish / Shellac manicure', '200', ''],
          ['Gelish / Shellac pedicure', '210', '']
        ]
      },
      {
        name: 'Extensions & Refills',
        items: [
          ['Refill — normal', '220', ''],
          ['Natural overlay set', '280', ''],
          ['Refill — French', '280', ''],
          ['Refill & shape change', '315', ''],
          ['Nail extension full set', '325', ''],
          ['French extension', '380', '']
        ]
      }
    ]
  },
  {
    group: 'Body',
    cats: [
      {
        name: 'Massage',
        note: 'Durations shown as 60 / 90 / 120 minutes.',
        items: [
          ['Full back massage', '150', '30 minutes'],
          ['Head, neck & shoulder', '180', '30 minutes'],
          ['Foot massage', '180', '45 minutes'],
          ['Aromatherapy massage', '240 / 300 / 500', ''],
          ['Reflexology', '240 / 300 / 500', ''],
          ['Post-natal massage', '240 / 300 / 500', ''],
          ['Deep tissue massage', '260 / 320 / 500', ''],
          ['Swedish massage', '260 / 320 / 500', ''],
          ['Slimming massage', '260 / 320 / 500', ''],
          ['Thai massage', '260 / 320 / 500', ''],
          ['Pre-natal massage', '280 / 340 / 520', ''],
          ['Full body massage', '285', '30 minutes'],
          ['Bellabaci cupping massage', '300', '60 minutes'],
          ['Lymphatic massage', '380', '60 minutes'],
          ['Lymphatic drainage with tools', '350 / 400', ''],
          ['Four hands massage', '500 / 600 / 680', ''],
          ['Couples massage', '520 / 600 / 680', '']
        ]
      },
      {
        name: 'Packages & Other',
        items: [
          ['Ear candling', '170', ''],
          ['Swedish massage package', '1,820', '7 × 60 minutes'],
          ['Swedish massage package', '1,920', '6 × 90 minutes'],
          ['Madero therapy with tools', '2,100', '6 × 90 minutes'],
          ['Couples massage package', '3,000', '7 × 60 minutes'],
          ['Couples massage package', '3,800', '8 × 90 minutes'],
          ['Bridal make-up', 'On consultation', '']
        ]
      }
    ]
  }
];

/* ------------------------------------------------------------------- team */
CA.team = [
  { name: 'Emiliya Allahverdova', role: 'Certified Hair Artist', years: '20+ years',
    bio: 'Senior hair artist since 2004, trained at top academies and a winner of the Trend Vision award in 2005. Fashion shows, editorial and media work sit behind every consultation she gives.',
    spec: ['Editorial styling', 'Precision cutting', 'Creative colour'], img: 'assets/img/team/emiliya.jpg', fallback: 'https://www.cutabove-salon.com/images/emiliya.jpg' },
  { name: 'Angelica Aganova', role: 'Certified Stylist & Colorist', years: '12 years in Dubai',
    bio: 'A specialist in blondes, balayage and precision cutting. Advanced technique with an artistic approach — flawless, healthy, effortlessly stylish hair is the whole brief.',
    spec: ['Blondes', 'Balayage', 'Precision cutting'], img: 'assets/img/team/angelica.jpg', fallback: 'https://www.cutabove-salon.com/images/Angelica.jpg' },
  { name: 'Natalia Hosteva', role: 'Certified Stylist & Colorist', years: '17+ years',
    bio: 'Seventeen years across Dubai, Qatar and Ukraine. Advanced colouring, precision cuts, hair restoration and styling — with a focus on transformations built around the individual.',
    spec: ['Advanced colour', 'Hair restoration', 'Transformations'], img: 'assets/img/team/natalia.jpg', fallback: 'https://www.cutabove-salon.com/images/Natalia.jpg' },
  { name: 'Yvonne Fernandez', role: 'Dermalogica Skin Therapist', years: '35 years',
    bio: 'Studied at the Dermalogica Institute in 2001 and has been with Cut Above since 1992 — the year the salon opened. Waxing, nail care, threading, facials and bio-peeling.',
    spec: ['Facials', 'Bio-peeling', 'Threading'], img: 'assets/img/team/yvonne.jpg', fallback: 'https://www.cutabove-salon.com/images/rishi.jpg' },
  { name: 'Carina Queja', role: 'Skin Therapist & Nail Technician', years: '20+ years',
    bio: 'Certified skin therapist, nail technician and esthetician specialising in eyelash extensions, lash lifts and eyebrow lamination.',
    spec: ['Lash extensions', 'Brow lamination', 'Esthetics'], img: 'assets/img/team/carina.jpg', fallback: 'https://www.cutabove-salon.com/images/Carina.jpg' },
  { name: 'Alma Pasamonte', role: 'Skin Therapist & Nail Technician', years: '25+ years',
    bio: 'Joined the salon in 1997, close to its founding. A Guinot Institute graduate specialising in facials, manicures and pedicures, with a reputation for deep-cleansing pedicures.',
    spec: ['Guinot facials', 'Deep-cleanse pedicure', 'Manicure'], img: 'assets/img/team/alma.jpg', fallback: 'https://www.cutabove-salon.com/images/Alma.jpg' },
  { name: 'Liza Loren', role: 'Massage Therapist & Nail Technician', years: '17 years',
    bio: 'Seventeen years in U.A.E. wellness and beauty. Therapeutic massage, waxing and nail care — known for a gentle touch, precision, and a serious commitment to hygiene.',
    spec: ['Therapeutic massage', 'Waxing', 'Nail care'], img: 'assets/img/team/liza.jpg', fallback: 'https://www.cutabove-salon.com/images/Liza.jpg' },
  { name: 'Donnalyn Garcia', role: 'Nail Technician & Skin Therapist', years: '20 years',
    bio: 'Began in Dubai in 2006 and joined Cut Above in 2016. Nail care, eyelash and eyebrow lifts, and tinting.',
    spec: ['Nail care', 'Lash lifts', 'Tinting'], img: 'assets/img/team/donnalyn.jpg', fallback: 'https://www.cutabove-salon.com/images/Donnalyn.jpg' },
  { name: 'Jinky Bustos', role: 'Hair Assistant', years: '10+ years',
    bio: 'Supports the floor across shampooing, blow-drying, spa treatments, head massage and colour preparation. The reason a busy Saturday still feels calm.',
    spec: ['Spa treatments', 'Colour prep', 'Blow-dry'], img: 'assets/img/team/jinky.jpg', fallback: 'https://www.cutabove-salon.com/images/Jinky.jpg' },
  { name: 'Fruity', role: 'Assistant Stylist', years: '15+ years',
    bio: 'Fifteen years at Cut Above. Head massages and spa treatments designed to relieve stress and nourish the scalp — regulars book her by name.',
    spec: ['Head massage', 'Scalp care', 'Spa treatments'], img: 'assets/img/team/fruity.jpg', fallback: 'https://www.cutabove-salon.com/images/Fruity.jpg' }
];

/* ----------------------------------------------------------------- houses */
CA.brands = [
  { name: 'Schwarzkopf Professional', origin: 'Germany · 1898', cat: 'Hair',
    body: 'The German chemist and pharmacist Hans Schwarzkopf laid the foundations for a brand that has stood at the forefront of hair innovation for more than a century.',
    img: 'assets/img/brands/schwarzkopf.jpg', fallback: 'https://www.cutabove-salon.com/images/skp.jpg' },
  { name: 'Olaplex', origin: 'United States', cat: 'Hair',
    body: 'Free of silicone, sulfates, phthalates, DEA and aldehydes. Reconnects the broken disulfide sulfur bonds inside the hair rather than coating the outside of it.',
    img: 'assets/img/brands/olaplex.jpg', fallback: 'https://www.cutabove-salon.com/images/olapex.jpg' },
  { name: 'Great Lengths', origin: 'Italy', cat: 'Hair',
    body: '100% human hair, molecularly bonded to your own. The extension standard the industry measures itself against.',
    img: 'assets/img/brands/greatlengths.jpg', fallback: 'https://www.cutabove-salon.com/images/great.jpg' },
  { name: 'Philip Martin’s', origin: 'Vicenza, Italy · 2010', cat: 'Hair',
    body: 'Organic ingredients and green chemistry, made in Vicenza. Conditioning treatments that read as skincare for the scalp.',
    img: 'assets/img/brands/philipmartins.jpg', fallback: 'https://www.cutabove-salon.com/images/philip.jpg' },
  { name: 'Guinot', origin: 'Paris, France', cat: 'Skin',
    body: 'Founded in France over forty years ago and home to the legendary Hydradermie treatment. Our therapists are Institute-trained.',
    img: 'assets/img/brands/guinot.jpg', fallback: 'https://www.cutabove-salon.com/images/guinott.jpg' },
  { name: 'Dermalogica', origin: 'United States', cat: 'Skin',
    body: 'Trains more than 75,000 professional skin therapists a year. Prescriptive, never one-size-fits-all.',
    img: 'assets/img/brands/dermalogica.jpg', fallback: 'https://www.cutabove-salon.com/images/derma.jpg' },
  { name: 'JB Lashes', origin: 'United States', cat: 'Eyes',
    body: 'The original eyelash extension exporters of America, and the system our lash specialists are certified in.',
    img: 'assets/img/brands/jblashes.jpg', fallback: 'https://www.cutabove-salon.com/images/jb.jpg' },
  { name: 'Luxio by Akzentz', origin: 'Canada', cat: 'Nails',
    body: 'Vegan, hypoallergenic, alcohol and solvent-free gel polish with 14+ day wear as the baseline.',
    img: 'assets/img/brands/luxio.jpg', fallback: 'https://www.cutabove-salon.com/images/Luxio.jpg' },
  { name: 'K-18', origin: 'United States', cat: 'Hair',
    body: 'Molecular repair at the keratin chain. Four minutes, and the hair behaves like it did before the bleach.',
    img: 'assets/img/brands/k18.jpg', fallback: 'https://www.cutabove-salon.com/images/k-18.jpg' },
  { name: 'Malibu C', origin: 'United States', cat: 'Hair',
    body: 'Vitamin-based wellness treatments that lift hard-water minerals and chlorine out of the hair before colour goes in.',
    img: 'assets/img/brands/malibu.jpg', fallback: 'https://www.cutabove-salon.com/images/Malibu.jpg' }
];

/* ----------------------------------------------------------- testimonials */
/* REAL reviews, from the salon's public Google Maps listing.
   Quotes are verbatim apart from trimming, marked with an ellipsis. Names are
   the reviewers' own public Google display names. Verify before publishing —
   and see NOTE at the bottom of this block. */
CA.testimonials = [
  {
    q: 'I have been going to Cut Above for over 30 years now, it’s my second home! A huge shout out to all the ladies there, the service is so professional and you leave feeling amazing every time!!',
    n: 'Amanda Wilding', c: 'Google review'
  },
  {
    q: 'I reached there with a mess — I had bleached my hair myself, with orange colour at the roots and oxidised hair at the ends. The service is amazing and they fixed my hair colour to an amazing brown ombré. Love it.',
    n: 'Irtiqa Qureshi', c: 'Google review'
  },
  {
    q: 'Emiliya was amazing. She fixed my hair, as it was done elsewhere. She’s very experienced, was very gentle on my hair and she gave me what I wanted. Suits me perfectly. So happy.',
    n: 'L. H.', c: 'Google review'
  },
  {
    q: 'No one could match her level of talent and understanding of my hair — thick and frizzy Latino hair. I couldn’t say enough good things about her… and Fruity gives the best head massages!',
    n: 'On Angelica', c: 'Google review'
  },
  {
    q: 'I have been coming to Yvonne for my facial four, five years now… she is so into details, unlike the others.',
    n: 'Venus Xiaofeng Xu', c: 'Google review'
  },
  {
    q: 'Amazing colour — exactly what I asked for. Then one of the best haircuts and blow dries I have had. I will not be going to anyone else.',
    n: 'Heidi Godinho', c: 'Google review'
  },
  {
    q: 'I’ve loved all my haircuts, colours, blow drys and nails that I’ve had done here. All the hairdressers and assistants are super talented and helpful and sweet. Highly recommend!',
    n: 'Hiba Abu Al-Robb', c: 'Google review'
  }
];

/* NOTE ON THE ABOVE — read before this goes live.
   These are the strongest reviews from a public listing that also contains
   criticism. Showing only praise is what every business does, but the salon
   should be the one to choose, and reviewers should ideally be asked before
   their names are reproduced on a website.
   Two of the quotes name people: Emiliya, Angelica, Fruity and Yvonne are all
   on the current team. The colour-correction review originally named a stylist
   who is not on the published team list, so the name has been dropped rather
   than printed. */

/* -------------------------------------------------------------- GALLERY --
   HOW TO ADD PHOTOS
   -----------------
   1. Drop image files into  assets/img/gallery/
   2. Name them  01.jpg, 02.jpg, 03.jpg …  (or .webp / .png — see EXT below)
   3. Set COUNT to how many you dropped in. That's it.

   Any file that fails to load removes its own tile — so an over-estimate on
   COUNT is harmless, and you can drop in 12 today and 40 tomorrow.

   Want captions or categories? Fill in CA.galleryMeta below, keyed by number.
   Anything not listed gets the default caption and shows in "All".
   Categories available: Hair · Colour · Nails · Skin · Salon
   ------------------------------------------------------------------------ */
CA.galleryConfig = {
  COUNT: 38,
  EXT: 'jpg',
  PATH: 'assets/img/gallery/',
  PAD: 2
};

CA.galleryMeta = {
  // number: { cat, cap } — edit freely, or blank a cap to use the default.
  1:  { cat: 'Colour', cap: 'Blonde balayage, long waves', big: true, w: 1120, h: 1400 },
  2:  { cat: 'Hair', cap: 'Curly cut, natural texture', w: 1400, h: 1400 },
  3:  { cat: 'Nails', cap: 'Red gel, almond shape', w: 864, h: 1296 },
  4:  { cat: 'Colour', cap: 'Caramel balayage', w: 1050, h: 1400 },
  5:  { cat: 'Hair', cap: 'Blunt bob, one length', w: 1051, h: 1400 },
  6:  { cat: 'Colour', cap: 'Copper red, glossed', w: 1051, h: 1400 },
  7:  { cat: 'Colour', cap: 'Ash blonde, long layers', w: 1120, h: 1400 },
  8:  { cat: 'Hair', cap: 'Platinum crop', w: 1156, h: 1400 },
  9:  { cat: 'Colour', cap: 'Brunette, wave texture', w: 1133, h: 1400 },
  10: { cat: 'Salon', cap: 'On the shelf', big: true, w: 1126, h: 1400 },
  11: { cat: 'Colour', cap: 'Blonde, deep waves', w: 1122, h: 1400 },
  12: { cat: 'Hair', cap: 'Short bob, blown out', w: 1051, h: 1400 },
  13: { cat: 'Hair', cap: 'Occasion styling', w: 1050, h: 1400 },
  14: { cat: 'Colour', cap: 'Platinum blonde', w: 1120, h: 1400 },
  15: { cat: 'Salon', cap: 'Extensions, being fitted', big: true, w: 1120, h: 1400 },
  16: { cat: 'Colour', cap: 'Blonde bob, soft wave', w: 1120, h: 1400 },
  17: { cat: 'Hair', cap: 'Perm, defined curl', w: 1050, h: 1400 },
  18: { cat: 'Colour', cap: 'Magenta', w: 783, h: 1294 },
  19: { cat: 'Colour', cap: 'Bronde, lived-in', w: 1050, h: 1400 },
  20: { cat: 'Colour', cap: 'Silver ash, long', w: 1120, h: 1400 },
  21: { cat: 'Hair', cap: 'Shoulder length, blonde', w: 1120, h: 1400 },
  22: { cat: 'Salon', cap: 'Great Lengths weft', big: true, w: 1120, h: 1400 },
  23: { cat: 'Colour', cap: 'Brunette, long layers', w: 1050, h: 1400 },
  24: { cat: 'Colour', cap: 'Lilac panel', w: 895, h: 1198 },
  25: { cat: 'Colour', cap: 'Lived-in brunette', big: true, w: 1120, h: 1400 },
  26: { cat: 'Hair', cap: 'Dark ponytail, sleek', w: 1120, h: 1400 },
  27: { cat: 'Colour', cap: 'Blonde balayage', w: 1051, h: 1400 },
  28: { cat: 'Hair', cap: 'Cut and finish', w: 1050, h: 1400 },
  29: { cat: 'Colour', cap: 'Rich brunette, gloss', w: 1122, h: 1400 },
  30: { cat: 'Hair', cap: 'Blonde bob', w: 1050, h: 1400 },
  31: { cat: 'Colour', cap: 'Blonde, back view', w: 1120, h: 1400 },
  32: { cat: 'Colour', cap: 'Balayage, flower wall', w: 1045, h: 1400 },
  33: { cat: 'Colour', cap: 'Long balayage', big: true, w: 1120, h: 1400 },
  34: { cat: 'Hair', cap: 'Dark bob', w: 1052, h: 1400 },
  35: { cat: 'Hair', cap: 'Half-up, braided', w: 1120, h: 1400 },
  36: { cat: 'Colour', cap: 'Golden lengths', w: 1120, h: 1400 },
  37: { cat: 'Colour', cap: 'Brunette, front', w: 1133, h: 1400 },
  38: { cat: 'Colour', cap: 'Straight platinum', w: 1050, h: 1400 },
};

CA.galleryDefaults = ['Hair', 'Colour', 'Nails', 'Skin', 'Salon'];
