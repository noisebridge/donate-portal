// @ts-check

const CHAR_SET =
  "\u{FF66}\u{FF67}\u{FF68}\u{FF69}\u{FF6A}\u{FF6B}\u{FF6C}\u{FF6D}\u{FF6E}\u{FF6F}" +
  "\u{FF70}\u{FF71}\u{FF72}\u{FF73}\u{FF74}\u{FF75}\u{FF76}\u{FF77}\u{FF78}\u{FF79}" +
  "\u{FF7A}\u{FF7B}\u{FF7C}\u{FF7D}\u{FF7E}\u{FF7F}\u{FF80}\u{FF81}\u{FF82}\u{FF83}" +
  "\u{FF84}\u{FF85}\u{FF86}\u{FF87}\u{FF88}\u{FF89}\u{FF8A}\u{FF8B}\u{FF8C}\u{FF8D}" +
  "\u{FF8E}\u{FF8F}\u{FF90}\u{FF91}\u{FF92}\u{FF93}\u{FF94}\u{FF95}\u{FF96}\u{FF97}" +
  "\u{FF98}\u{FF99}\u{FF9A}\u{FF9B}\u{FF9C}\u{FF9D}" +
  "0123456789";

const FONT_SIZE = 24;
const COLOR = "#0c0";
const HEAD_COLOR = "#fff";
const FADE_ALPHA = 0.05;
const STEP_INTERVAL_MIN = 60;
const STEP_INTERVAL_MAX = 150;
const WAVE_DURATION = 10000;

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
let animating = false;

/**
 * @typedef {object} Drop
 * @property {number} x
 * @property {number} row - Current row (integer), multiplied by FONT_SIZE for y position
 * @property {number} interval - Milliseconds between each row step
 * @property {number} accumulator - Time accumulated toward next step
 */

/** @type {Drop[]} */
let drops = [];

/** @type {number} */
let waveStart = 0;

/** @type {number} */
let lastFrameTime = 0;

/**
 * Initialize the matrix system with a canvas element.
 * @param {HTMLCanvasElement} canvasEl
 */
export function initMatrix(canvasEl) {
  canvas = canvasEl;
  ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
}

/**
 * Get a random character from the character set.
 * @returns {string}
 */
function randomChar() {
  return /** @type {string} */ (
    CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]
  );
}

/**
 * Launch a wave of matrix rain down the screen.
 */
export function showMatrix() {
  const columns = Math.ceil(canvas.width / FONT_SIZE);
  const maxRows = Math.ceil(canvas.height / FONT_SIZE);
  drops = [];

  for (let i = 0; i < columns; i++) {
    const startRow = -Math.floor(Math.random() * maxRows);
    drops.push({
      x: i * FONT_SIZE,
      row: startRow,
      interval:
        STEP_INTERVAL_MIN +
        Math.random() * (STEP_INTERVAL_MAX - STEP_INTERVAL_MIN),
      accumulator: 0,
    });
  }

  waveStart = performance.now();
  lastFrameTime = waveStart;

  if (!animating) {
    animating = true;
    requestAnimationFrame(animate);
  }
}

/**
 * Stop all matrix animations and clear the canvas.
 */
export function stopMatrix() {
  drops = [];
  animating = false;
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * @param {number} now
 */
function animate(now) {
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  // Fade the canvas slightly to create trailing effect
  ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = `${FONT_SIZE}px monospace`;

  let alive = false;
  const elapsed = now - waveStart;
  const waveOver = elapsed > WAVE_DURATION;
  const maxRow = Math.ceil(canvas.height / FONT_SIZE);

  for (const drop of drops) {
    drop.accumulator += dt;

    // Step down one row each time the interval elapses
    while (drop.accumulator >= drop.interval) {
      drop.accumulator -= drop.interval;
      drop.row++;
    }

    if (drop.row < maxRow) {
      alive = true;
    }

    const y = drop.row * FONT_SIZE;

    if (y >= 0 && y < canvas.height) {
      // Draw head character (bright white)
      ctx.fillStyle = HEAD_COLOR;
      ctx.fillText(randomChar(), drop.x, y);

      // Draw trailing character one row above (green)
      const trailY = y - FONT_SIZE;
      if (trailY >= 0) {
        ctx.fillStyle = COLOR;
        ctx.fillText(randomChar(), drop.x, trailY);
      }
    }
  }

  // After wave duration, let remaining drops finish falling then stop
  if (waveOver && !alive) {
    animating = false;
    // Final clear to remove fade residue
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (animating) {
    requestAnimationFrame(animate);
  }
}
