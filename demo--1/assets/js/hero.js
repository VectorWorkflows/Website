/* ==========================================================================
   HERO CANVAS — "Strands"
   A field of slow, hair-like filaments drifting across the canvas. Reacts
   gently to the pointer. Pauses when off-screen or when the tab is hidden.
   Falls back to a static CSS gradient under prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.querySelector('.hero__canvas');
  if (!canvas || !canvas.getContext) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = canvas.getContext('2d', { alpha: true });
  var W = 0, H = 0, DPR = 1;
  var strands = [];
  var t = 0;
  var mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  var running = true;
  var rafId = null;

  var PALETTE = [
    'rgba(216,195,165,',   // champagne
    'rgba(184,149,106,',   // gold
    'rgba(201,148,143,',   // rose
    'rgba(242,235,225,'    // bone
  ];

  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    var r = canvas.getBoundingClientRect();
    W = Math.max(r.width, 1);
    H = Math.max(r.height, 1);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function build() {
    strands = [];
    var count = W < 700 ? 26 : W < 1200 ? 40 : 58;
    for (var i = 0; i < count; i++) {
      strands.push({
        x0: (Math.random() * 1.5 - 0.28) * W,
        amp: 34 + Math.random() * 190,
        freq: 0.0016 + Math.random() * 0.0042,
        speed: 0.0016 + Math.random() * 0.0055,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.22,
        width: 0.35 + Math.random() * 1.5,
        alpha: 0.035 + Math.random() * 0.15,
        hue: PALETTE[(Math.random() * PALETTE.length) | 0],
        tilt: (Math.random() - 0.5) * 0.55,
        depth: Math.random()
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // soft warm bloom behind the strands
    var g = ctx.createRadialGradient(W * 0.22, H * 0.26, 0, W * 0.22, H * 0.26, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(184,149,106,0.14)');
    g.addColorStop(0.45, 'rgba(184,149,106,0.03)');
    g.addColorStop(1, 'rgba(6,5,5,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var mdx = (mouse.x - 0.5) * 90;
    var mdy = (mouse.y - 0.5) * 50;
    var step = H / 22;

    ctx.lineCap = 'round';

    for (var i = 0; i < strands.length; i++) {
      var s = strands[i];
      var px = s.x0 + t * s.drift + mdx * (0.25 + s.depth * 0.9);
      ctx.beginPath();
      for (var y = -step; y <= H + step; y += step) {
        var n =
          Math.sin(y * s.freq + t * s.speed + s.phase) * s.amp +
          Math.sin(y * s.freq * 2.35 + t * s.speed * 1.6 + s.phase * 1.7) * s.amp * 0.32;
        var x = px + n + y * s.tilt + mdy * s.depth * 0.35;
        if (y <= -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = s.hue + s.alpha.toFixed(3) + ')';
      ctx.lineWidth = s.width;
      ctx.stroke();
    }
  }

  function loop() {
    if (!running) { rafId = null; return; }
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    t += 1;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running && rafId !== null) return;
    running = true;
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  function init() {
    size();
    build();
    if (REDUCED) { draw(); return; }
    start();
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { size(); build(); if (REDUCED) draw(); }, 180);
  });

  window.addEventListener('mousemove', function (e) {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = e.clientY / window.innerHeight;
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (!REDUCED) start();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { if (!REDUCED) start(); }
      else stop();
    }, { threshold: 0.01 }).observe(canvas);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
