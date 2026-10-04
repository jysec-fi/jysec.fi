// Animated "JySec!" text-mode pattern behind the hero, drawn in the CGA palette.
(function () {
  const canvas = document.querySelector('.hero-bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const TEXT = 'JySec!';
  const FONT = '32px PS-55';
  const CELL_H = 32;
  const FPS = 12;
  const FADE = 8; // frames spent fading out
  const COLORS = [
    '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
    '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'
  ];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cols = 0, rows = 0, cellW = 8, target = 0;
  let tags = [];
  let timer = null;
  let onScreen = true;

  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (list) => list[rand(list.length)];

  // Grid areas covered by the hero title, subtitle and arrow
  let blocked = [];

  // Tags may touch but never overlap each other or the hero text
  function isFree(col, row) {
    const end = col + TEXT.length;
    if (col < 0 || end > cols || row < 0 || row >= rows) return false;
    for (const b of blocked) {
      if (row >= b.top && row <= b.bottom && end > b.left && col <= b.right) return false;
    }
    for (const t of tags) {
      if (t.row === row && end > t.col && col < t.col + TEXT.length) return false;
    }
    return true;
  }

  // Mostly grow off an existing tag so they form chains and clumps with empty space between
  function candidate() {
    if (tags.length && Math.random() < 0.65) {
      const t = pick(tags);
      if (Math.random() < 0.5) {
        return [t.col + (Math.random() < 0.5 ? TEXT.length : -TEXT.length), t.row];
      }
      return [t.col + rand(TEXT.length * 2 + 1) - TEXT.length, t.row + (Math.random() < 0.5 ? 1 : -1)];
    }
    return [rand(cols - TEXT.length + 1), rand(rows)];
  }

  function spawn(age) {
    // Give up quietly if no free spot turns up; the next frame will try again
    for (let tries = 0; tries < 20; tries++) {
      const [col, row] = candidate();
      if (!isFree(col, row)) continue;
      const fg = pick(COLORS);
      let bg = Math.random() < 0.55 ? pick(COLORS) : null;
      if (bg === fg) bg = null;
      tags.push({
        col: col,
        row: row,
        fg: fg,
        bg: bg,
        age: age || 0,
        life: 30 + rand(90)
      });
      return;
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    cellW = Math.ceil(ctx.measureText('M').width) || 8;
    cols = Math.floor(w / cellW);
    rows = Math.floor(h / CELL_H);

    const origin = canvas.getBoundingClientRect();
    blocked = Array.from(document.querySelectorAll('.hero h1, .hero p, .arrow'), function (el) {
      const r = el.getBoundingClientRect();
      return {
        left: Math.floor((r.left - origin.left) / cellW) - 1,
        right: Math.floor((r.right - origin.left) / cellW) + 1,
        top: Math.floor((r.top - origin.top) / CELL_H),
        bottom: Math.floor((r.bottom - origin.top) / CELL_H)
      };
    });
    target = Math.round((cols * rows) / 30);

    // Start already populated, with tags at random points in their lifetime
    tags = [];
    for (let i = 0; i < target; i++) spawn(rand(60));
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const t of tags) {
      const shown = Math.min(TEXT.length, t.age + 1);
      const x = t.col * cellW;
      const y = t.row * CELL_H;
      ctx.globalAlpha = reduceMotion ? 1 : Math.min(1, (t.life - t.age) / FADE);
      if (t.bg) {
        ctx.fillStyle = t.bg;
        ctx.fillRect(x, y, shown * cellW, CELL_H);
      }
      ctx.fillStyle = t.fg;
      ctx.fillText(TEXT.slice(0, shown), x, y);
    }
    ctx.globalAlpha = 1;
  }

  function step() {
    for (const t of tags) t.age++;
    tags = tags.filter((t) => t.age < t.life);
    // Top up a couple per frame so tags trickle in rather than appearing in bursts
    for (let i = 0; i < 2 && tags.length < target; i++) spawn(0);
    draw();
  }

  function update() {
    const run = !reduceMotion && onScreen && !document.hidden;
    if (run && !timer) timer = setInterval(step, 1000 / FPS);
    if (!run && timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  document.addEventListener('visibilitychange', update);
  new IntersectionObserver(function (entries) {
    onScreen = entries[0].isIntersecting;
    update();
  }).observe(canvas);

  // Wait for the DOS font so cell widths are measured correctly
  document.fonts.load(FONT).finally(function () {
    resize();
    update();
  });
})();
