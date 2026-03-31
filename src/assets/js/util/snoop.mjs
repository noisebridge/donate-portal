// @ts-check

import { ledClear, ledSnoop } from "./led_effects.mjs";

const CANNABIS_SRC = "/assets/image/cannabis.svg";
const SCROLL_TEXT = "SMOKE WEED EVERY DAY";

const LEAF_ROTATE_DURATION = 1000;
const SNOOP_ENTER_DURATION = 3000;
const TEXT_SCROLL_DURATION = 6000;
const SNOOP_EXIT_DURATION = 3000;
const LEAF_SIZE_MIN = 84;
const LEAF_SIZE_MAX = 120;
const LEAF_SPACING_MIN = 60;
const LEAF_SPACING_MAX = 100;
const LEAF_OFFSET_JITTER = 15;
const LEAF_ANGLE_JITTER = 0.4;
const TEXT_FONT_SIZE = 250;

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
/** @type {HTMLImageElement} */
let snoopEl;

/** @type {HTMLImageElement | null} */
let cannabisImg = null;

let animating = false;

/**
 * @typedef {'entering' | 'text_scroll' | 'exiting' | 'idle'} SnoopPhase
 */

/** @type {SnoopPhase} */
let snoopPhase = "idle";
/** @type {number} */
let phaseStart = 0;

/** @type {boolean} */
let leavesVisible = false;
/** @type {number} */
let leafEnterStart = 0;
/** @type {boolean} */
let leavesRotatingOut = false;
/** @type {number} */
let leafExitStart = 0;

/**
 * Initialize the snoop system with a canvas element.
 * @param {HTMLCanvasElement} canvasEl
 */
export function initSnoop(canvasEl) {
  canvas = canvasEl;
  ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  snoopEl = /** @type {HTMLImageElement} */ (
    document.getElementById("snoop-img")
  );

  cannabisImg = new Image();
  cannabisImg.src = CANNABIS_SRC;
}

/**
 * Ease-out cubic.
 * @param {number} t - Progress 0..1
 * @returns {number}
 */
function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * Ease-in cubic.
 * @param {number} t - Progress 0..1
 * @returns {number}
 */
function easeIn(t) {
  return t * t * t;
}

/**
 * @typedef {object} LeafPos
 * @property {number} x - Final resting x
 * @property {number} y - Final resting y
 * @property {number} offX - Starting x (off-screen)
 * @property {number} offY - Starting y (off-screen)
 * @property {number} baseAngle - The angle the leaf rotates in from
 * @property {number} restAngle - Small random rotation at rest
 * @property {number} size
 */

/** @type {LeafPos[]} */
let cachedLeafPositions = [];
/** @type {number} */
let cachedLeafW = 0;
/** @type {number} */
let cachedLeafH = 0;

/**
 * Seeded-ish random for stable jitter per leaf index.
 * @param {number} i
 * @param {number} salt
 * @returns {number} 0..1
 */
function leafRandom(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Build leaf positions around the border with organic variation.
 * Cached until the canvas size changes.
 * @returns {LeafPos[]}
 */
function getLeafPositions() {
  const w = canvas.width;
  const h = canvas.height;
  if (
    cachedLeafPositions.length > 0 &&
    cachedLeafW === w &&
    cachedLeafH === h
  ) {
    return cachedLeafPositions;
  }

  cachedLeafW = w;
  cachedLeafH = h;
  /** @type {LeafPos[]} */
  const positions = [];
  let idx = 0;

  const offDist = LEAF_SIZE_MAX * 1.5;

  /**
   * @param {number} startX
   * @param {number} startY
   * @param {number} dx - Direction to walk along the edge
   * @param {number} dy
   * @param {number} nx - Outward normal x (points off-screen)
   * @param {number} ny - Outward normal y (points off-screen)
   * @param {number} length - Total length of this edge
   * @param {number} baseAngle - Angle the leaf rotates in from
   * @param {number} jitterAxis - 0 = jitter Y, 1 = jitter X
   */
  function walkEdge(
    startX,
    startY,
    dx,
    dy,
    nx,
    ny,
    length,
    baseAngle,
    jitterAxis,
  ) {
    let traveled = LEAF_SIZE_MIN / 2;
    while (traveled < length - LEAF_SIZE_MIN / 2) {
      const size =
        LEAF_SIZE_MIN + leafRandom(idx, 1) * (LEAF_SIZE_MAX - LEAF_SIZE_MIN);
      const jitter = (leafRandom(idx, 2) - 0.5) * 2 * LEAF_OFFSET_JITTER;
      const restAngle = (leafRandom(idx, 3) - 0.5) * 2 * LEAF_ANGLE_JITTER;

      let x = startX + dx * traveled;
      let y = startY + dy * traveled;

      if (jitterAxis === 0) {
        y += jitter;
      } else {
        x += jitter;
      }

      // Off-screen origin: push outward along the edge normal
      const offX = x + nx * (offDist + size);
      const offY = y + ny * (offDist + size);

      positions.push({ x, y, offX, offY, baseAngle, restAngle, size });

      const spacing =
        LEAF_SPACING_MIN +
        leafRandom(idx, 4) * (LEAF_SPACING_MAX - LEAF_SPACING_MIN);
      traveled += spacing;
      idx++;
    }
  }

  const margin = LEAF_SIZE_MAX / 2;

  // Top edge (left to right), normal points up
  walkEdge(0, margin, 1, 0, 0, -1, w, 0, 0);
  // Right edge (top to bottom), normal points right
  walkEdge(w - margin, 0, 0, 1, 1, 0, h, Math.PI / 2, 1);
  // Bottom edge (right to left), normal points down
  walkEdge(w, h - margin, -1, 0, 0, 1, w, Math.PI, 0);
  // Left edge (bottom to top), normal points left
  walkEdge(margin, h, 0, -1, -1, 0, h, -Math.PI / 2, 1);

  cachedLeafPositions = positions;
  return positions;
}

/**
 * Draw cannabis leaves around the border.
 * @param {number} now
 */
function drawLeaves(now) {
  if (!cannabisImg || !cannabisImg.complete) return;

  let rotateProgress = 1;

  if (leavesRotatingOut) {
    const elapsed = now - leafExitStart;
    rotateProgress = 1 - Math.min(1, elapsed / LEAF_ROTATE_DURATION);
    if (rotateProgress <= 0) {
      leavesVisible = false;
      leavesRotatingOut = false;
      return;
    }
  } else if (leavesVisible) {
    const elapsed = now - leafEnterStart;
    rotateProgress = Math.min(1, elapsed / LEAF_ROTATE_DURATION);
  }

  const positions = getLeafPositions();
  const easedProgress = easeOut(rotateProgress);

  for (const pos of positions) {
    ctx.save();
    // Interpolate position from off-screen origin to final resting spot
    const drawX = pos.offX + (pos.x - pos.offX) * easedProgress;
    const drawY = pos.offY + (pos.y - pos.offY) * easedProgress;
    ctx.translate(drawX, drawY);
    // Rotate from a full turn away to the rest angle
    const startRotation = pos.restAngle - Math.PI * 2;
    const endRotation = pos.restAngle;
    const rotation =
      startRotation + (endRotation - startRotation) * easedProgress;
    ctx.rotate(rotation);
    const half = pos.size / 2;
    ctx.drawImage(cannabisImg, -half, -half, pos.size, pos.size);
    ctx.restore();
  }
}

/**
 * Position the snoop DOM image element.
 * @param {number} yCenter - Desired vertical center of the image in viewport pixels
 */
function positionSnoop(yCenter) {
  const imgAspect = snoopEl.naturalWidth / snoopEl.naturalHeight;
  const drawWidth = window.innerWidth;
  const drawHeight = drawWidth / imgAspect;
  const top = yCenter - drawHeight / 2;

  snoopEl.style.display = "block";
  snoopEl.style.top = `${top}px`;
}

/**
 * Hide the snoop DOM image element.
 */
function hideSnoop() {
  snoopEl.style.display = "none";
}

/**
 * Get the Y position where snoop is fully off-screen (below).
 * @returns {number}
 */
function snoopOffscreenY() {
  const imgAspect = snoopEl.naturalWidth / snoopEl.naturalHeight;
  if (!imgAspect) return window.innerHeight + 200;
  const drawHeight = window.innerWidth / imgAspect;
  return window.innerHeight + drawHeight / 2;
}

/**
 * Draw scrolling text on the canvas.
 * @param {number} progress - 0..1 progress through text scroll
 */
function drawText(progress) {
  ctx.save();
  ctx.font = `bold ${TEXT_FONT_SIZE}px Impact, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 8;
  ctx.textBaseline = "middle";

  const textWidth = ctx.measureText(SCROLL_TEXT).width;
  const startX = canvas.width;
  const endX = -textWidth;
  const x = startX + (endX - startX) * progress;
  const y = canvas.height / 2;

  ctx.strokeText(SCROLL_TEXT, x, y);
  ctx.fillText(SCROLL_TEXT, x, y);
  ctx.restore();
}

/**
 * Main animation loop.
 * @param {number} now
 */
function animate(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerY = window.innerHeight / 2;
  const offscreenY = snoopOffscreenY();

  // Draw leaves first (behind text, snoop is a DOM element so always on top)
  if (leavesVisible) {
    drawLeaves(now);
  }

  if (snoopPhase === "entering") {
    const elapsed = now - phaseStart;
    const progress = Math.min(1, elapsed / SNOOP_ENTER_DURATION);
    const y = offscreenY + (centerY - offscreenY) * easeOut(progress);
    positionSnoop(y);

    if (progress >= 1) {
      snoopPhase = "text_scroll";
      phaseStart = now;
    }
  } else if (snoopPhase === "text_scroll") {
    const elapsed = now - phaseStart;
    const progress = Math.min(1, elapsed / TEXT_SCROLL_DURATION);

    positionSnoop(centerY);
    drawText(progress);

    if (progress >= 1) {
      snoopPhase = "exiting";
      phaseStart = now;
    }
  } else if (snoopPhase === "exiting") {
    const elapsed = now - phaseStart;
    const progress = Math.min(1, elapsed / SNOOP_EXIT_DURATION);
    const y = centerY + (offscreenY - centerY) * easeIn(progress);
    positionSnoop(y);

    if (progress >= 1) {
      snoopPhase = "idle";
      hideSnoop();
    }
  }

  // Keep animating if snoop is active or leaves are still rotating
  const snoopActive = snoopPhase !== "idle";
  const leavesAnimating =
    leavesVisible &&
    (leavesRotatingOut || now - leafEnterStart < LEAF_ROTATE_DURATION);

  if (snoopActive || leavesAnimating) {
    requestAnimationFrame(animate);
  } else {
    animating = false;
    // If leaves are still visible (not rotating out), draw them one last time
    if (leavesVisible) {
      drawLeaves(now);
    }
  }
}

/**
 * Start the animation loop if not already running.
 */
function ensureAnimating() {
  if (!animating) {
    animating = true;
    requestAnimationFrame(animate);
  }
}

/**
 * Draw leaves at full progress (no animation). Waits for the image if needed.
 */
function drawLeavesStatic() {
  if (!cannabisImg) return;

  if (cannabisImg.complete) {
    drawLeaves(LEAF_ROTATE_DURATION + 1);
  } else {
    cannabisImg.addEventListener("load", () => {
      drawLeaves(LEAF_ROTATE_DURATION + 1);
    });
  }
}

/**
 * Show leaves immediately at their final positions (no animation).
 * Used when the page loads and the most recent donation was a snoop amount.
 */
export function showSnoopLeaves() {
  leavesVisible = true;
  leavesRotatingOut = false;
  leafEnterStart = 0;
  cachedLeafPositions = [];
  drawLeavesStatic();
}

/**
 * Launch the snoop dogg takeover effect.
 */
export function showSnoop() {
  const now = performance.now();

  // Start leaves rotating in
  if (!leavesVisible) {
    leavesVisible = true;
    leafEnterStart = now;
    leavesRotatingOut = false;
    cachedLeafPositions = [];
  }

  // Start snoop entering from bottom
  snoopPhase = "entering";
  phaseStart = now;

  ensureAnimating();
  ledSnoop();
}

/**
 * Stop the snoop effect and rotate out leaves.
 */
export function stopSnoop() {
  const now = performance.now();

  // Stop snoop immediately
  snoopPhase = "idle";
  hideSnoop();
  ledClear();

  // Rotate leaves out
  if (leavesVisible && !leavesRotatingOut) {
    leavesRotatingOut = true;
    leafExitStart = now;
    ensureAnimating();
  }

  if (!leavesVisible) {
    animating = false;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}
