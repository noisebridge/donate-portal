// @ts-check

import { launchConfetti } from "./confetti.mjs";
import { ledClear, ledMerica } from "./led_effects.mjs";

/** @typedef {import("~/money").Cents} Cents */

const FLAG_SRC = "/assets/image/flag-us.svg";

const ARNOLD_ENTER_DURATION = 2000;
const ARNOLD_HOLD_DURATION = 4000;
const EAGLE_SWOOP_DURATION = 3000;
const ARNOLD_EXIT_DURATION = 2000;

const FLAG_DROP_DURATION = 1000;
const FLAG_RETRACT_DURATION = 1000;
const FLAG_RIPPLE_PERIOD = 2.5;
const FLAG_RIPPLE_AMPLITUDE = 8;
const FLAG_WAVE_COUNT = 3;

/**
 * @typedef {'idle' | 'arnold_enter' | 'arnold_hold' | 'eagle_swoop' | 'arnold_exit'} MericaPhase
 */

/** @type {MericaPhase} */
let phase = "idle";
/** @type {number} */
let phaseStart = 0;
/** @type {boolean} */
let animating = false;

/** @type {HTMLImageElement} */
let arnoldEl;
/** @type {HTMLImageElement} */
let eagleEl;
/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;

/** @type {HTMLImageElement | null} */
let flagImg = null;
/** @type {OffscreenCanvas | null} */
let flagBuffer = null;
/** @type {number} */
let flagBufferW = 0;
/** @type {number} */
let flagBufferH = 0;

/** @type {boolean} */
let flagVisible = false;
/** @type {boolean} */
let flagDropping = false;
/** @type {boolean} */
let flagRetracting = false;
/** @type {number} */
let flagEnterStart = 0;
/** @type {number} */
let flagExitStart = 0;

/**
 * Initialize the merica system.
 * @param {HTMLCanvasElement} canvasEl
 */
export function initMerica(canvasEl) {
  arnoldEl = /** @type {HTMLImageElement} */ (
    document.getElementById("arnold-img")
  );
  eagleEl = /** @type {HTMLImageElement} */ (
    document.getElementById("eagle-img")
  );
  canvas = canvasEl;
  ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

  flagImg = new Image();
  flagImg.src = FLAG_SRC;

  window.addEventListener("resize", () => {
    flagBuffer = null;
  });
}

/**
 * Ease-out cubic.
 * @param {number} t
 * @returns {number}
 */
function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * Ease-in cubic.
 * @param {number} t
 * @returns {number}
 */
function easeIn(t) {
  return t * t * t;
}

/**
 * Evaluate a cubic bezier curve at parameter t.
 * Returns {x, y} in viewport coordinates.
 *
 * The eagle swoops from off-screen left, arcs up through the middle,
 * then exits off-screen right.
 *
 * @param {number} t - Progress 0..1
 * @returns {{ x: number, y: number }}
 */
function eagleBezierPath(t) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Control points: enter high-left, swoop down to center, exit high-right
  const p0x = -400;
  const p0y = h * 0.05;
  const p1x = w * 0.25;
  const p1y = h * 0.85;
  const p2x = w * 0.75;
  const p2y = h * 0.85;
  const p3x = w + 400;
  const p3y = h * 0.05;

  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x;
  const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y;

  return { x, y };
}

/**
 * Get the tangent angle of the bezier path at parameter t.
 * Used to tilt the eagle along its flight path.
 *
 * @param {number} t
 * @returns {number} angle in radians
 */
function eagleBezierAngle(t) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const p0x = -400;
  const p0y = h * 0.05;
  const p1x = w * 0.25;
  const p1y = h * 0.85;
  const p2x = w * 0.75;
  const p2y = h * 0.85;
  const p3x = w + 400;
  const p3y = h * 0.05;

  const mt = 1 - t;

  // First derivative of cubic bezier
  const dx =
    3 * mt * mt * (p1x - p0x) +
    6 * mt * t * (p2x - p1x) +
    3 * t * t * (p3x - p2x);
  const dy =
    3 * mt * mt * (p1y - p0y) +
    6 * mt * t * (p2y - p1y) +
    3 * t * t * (p3y - p2y);

  return Math.atan2(dy, dx);
}

/**
 * Position Arnold by setting how far below the viewport bottom the image sits.
 * 0 = bottom edge flush with viewport, positive = pushed down off-screen.
 * @param {number} belowViewport - Pixels below the viewport bottom
 */
function positionArnold(belowViewport) {
  arnoldEl.style.display = "block";
  arnoldEl.style.top = "auto";
  arnoldEl.style.bottom = `${-belowViewport}px`;
}

/** Hide the Arnold DOM image element. */
function hideArnold() {
  arnoldEl.style.display = "none";
}

/**
 * Get the distance below viewport where Arnold is fully off-screen.
 * @returns {number}
 */
function arnoldOffscreenDist() {
  const imgAspect = arnoldEl.naturalWidth / arnoldEl.naturalHeight;
  if (!imgAspect) return window.innerHeight;
  return window.innerWidth / imgAspect;
}

/**
 * Position the eagle along the bezier path.
 * @param {number} t - Progress 0..1
 */
function positionEagle(t) {
  const { x, y } = eagleBezierPath(t);
  const angle = eagleBezierAngle(t);

  const eagleSize = Math.min(window.innerWidth, window.innerHeight) * 1.1;

  eagleEl.style.display = "block";
  eagleEl.style.width = `${eagleSize}px`;
  eagleEl.style.height = "auto";
  eagleEl.style.left = `${x - eagleSize / 2}px`;
  eagleEl.style.top = `${y - eagleSize / 2}px`;
  eagleEl.style.transform = `rotate(${angle}rad)`;
}

/** Hide the eagle DOM image element. */
function hideEagle() {
  eagleEl.style.display = "none";
}

/**
 * Pre-render the flag SVG to an offscreen canvas at the target size.
 * This avoids fractional-pixel sampling artifacts when slicing columns.
 * @param {number} w - Target width
 * @param {number} h - Target height
 */
function ensureFlagBuffer(w, h) {
  if (!flagImg || !flagImg.complete) return;
  const iw = Math.round(w);
  const ih = Math.round(h);
  if (flagBuffer && flagBufferW === iw && flagBufferH === ih) return;

  flagBuffer = new OffscreenCanvas(iw, ih);
  flagBufferW = iw;
  flagBufferH = ih;
  const bctx = /** @type {OffscreenCanvasRenderingContext2D} */ (
    flagBuffer.getContext("2d")
  );
  bctx.drawImage(flagImg, 0, 0, iw, ih);
}

/**
 * Draw the flag SVG to the canvas with a per-column ripple effect.
 * Each 1px-wide column is drawn at a sine-wave Y offset.
 * Does NOT clear the canvas — draws additively on top of existing content.
 * @param {number} now - Timestamp from requestAnimationFrame
 * @param {number} flagY - Top Y position of the flag
 */
function drawFlag(now, flagY) {
  if (!flagImg || !flagImg.complete) return;

  const cw = canvas.width;
  const flagWidth = Math.round(cw * 0.6);
  const flagHeight = Math.round(flagWidth / 1.9);
  const flagX = (cw - flagWidth) / 2;
  const timeSeconds = now / 1000;

  ensureFlagBuffer(flagWidth, flagHeight);
  if (!flagBuffer) return;

  ctx.clearRect(0, 0, cw, canvas.height);

  for (let col = 0; col < flagWidth; col++) {
    const xFrac = col / flagWidth;
    const offset =
      Math.sin(
        xFrac * FLAG_WAVE_COUNT * Math.PI * 2 +
          timeSeconds * ((Math.PI * 2) / FLAG_RIPPLE_PERIOD),
      ) * FLAG_RIPPLE_AMPLITUDE;

    ctx.drawImage(
      flagBuffer,
      col,
      0,
      1,
      flagHeight,
      flagX + col,
      flagY + offset,
      1,
      flagHeight,
    );
  }

  // Darken the flag with a uniform tint plus a bottom gradient
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const overlayRect = /** @type {const} */ ([
    flagX - FLAG_RIPPLE_AMPLITUDE,
    flagY - FLAG_RIPPLE_AMPLITUDE,
    flagWidth + FLAG_RIPPLE_AMPLITUDE * 2,
    flagHeight + FLAG_RIPPLE_AMPLITUDE * 2,
  ]);
  // Uniform darkening
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(...overlayRect);
  // Additional bottom gradient
  const grad = ctx.createLinearGradient(0, flagY, 0, flagY + flagHeight);
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(...overlayRect);
  ctx.restore();
}

/**
 * Main animation loop.
 * @param {number} now
 */
function animate(now) {
  const elapsed = now - phaseStart;

  // --- Flag rendering ---
  if (flagVisible) {
    const flagWidth = canvas.width * 0.6;
    const flagHeight = flagWidth / 1.9;
    const flagRestY = 20;
    const flagOffY = -flagHeight - 20;

    let flagY = flagRestY;

    if (flagDropping) {
      const fp = Math.min(1, (now - flagEnterStart) / FLAG_DROP_DURATION);
      flagY = flagOffY + (flagRestY - flagOffY) * easeOut(fp);
      if (fp >= 1) flagDropping = false;
    } else if (flagRetracting) {
      const fp = Math.min(1, (now - flagExitStart) / FLAG_RETRACT_DURATION);
      flagY = flagRestY + (flagOffY - flagRestY) * easeIn(fp);
      if (fp >= 1) {
        flagRetracting = false;
        flagVisible = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (flagVisible) {
      drawFlag(now, flagY);
    }
  }

  // --- Arnold / Eagle phases ---
  // belowViewport: 0 = flush with bottom, positive = off-screen below
  const offscreenDist = arnoldOffscreenDist();

  if (phase === "arnold_enter") {
    const progress = Math.min(1, elapsed / ARNOLD_ENTER_DURATION);
    const dist = offscreenDist * (1 - easeOut(progress));
    positionArnold(dist);

    if (progress >= 1) {
      phase = "arnold_hold";
      phaseStart = now;
    }
  } else if (phase === "arnold_hold") {
    positionArnold(0);

    // Start eagle swoop partway through the hold
    const eagleDelay = 500;
    const eagleElapsed = elapsed - eagleDelay;
    if (eagleElapsed > 0) {
      const eagleProgress = Math.min(1, eagleElapsed / EAGLE_SWOOP_DURATION);
      positionEagle(eagleProgress);

      if (eagleProgress >= 1) {
        hideEagle();
      }
    }

    if (elapsed >= ARNOLD_HOLD_DURATION) {
      phase = "arnold_exit";
      phaseStart = now;
      hideEagle();
    }
  } else if (phase === "arnold_exit") {
    const progress = Math.min(1, elapsed / ARNOLD_EXIT_DURATION);
    const dist = offscreenDist * easeIn(progress);
    positionArnold(dist);

    if (progress >= 1) {
      phase = "idle";
      hideArnold();
    }
  }

  if (phase !== "idle" || flagVisible) {
    requestAnimationFrame(animate);
  } else {
    animating = false;
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
 * Launch the 'MERICA takeover effect.
 * Sequence: Arnold rises, holds, eagle swoops, Arnold retracts. Flag drops in and ripples.
 * @param {Cents} amount
 */
export function showMerica(amount) {
  phase = "arnold_enter";
  phaseStart = performance.now();

  flagVisible = true;
  flagDropping = true;
  flagRetracting = false;
  flagEnterStart = performance.now();

  launchConfetti(amount);
  ensureAnimating();
  ledMerica();
}

/**
 * Show the flag immediately at its resting position (no drop animation).
 * Used on page load when the most recent donation is a merica amount.
 */
export function showMericaFlag() {
  flagVisible = true;
  flagDropping = false;
  flagRetracting = false;
  ensureAnimating();
}

/**
 * Stop the merica effect immediately.
 */
export function stopMerica() {
  phase = "idle";
  hideArnold();
  hideEagle();
  ledClear();

  if (flagVisible && !flagRetracting) {
    flagRetracting = true;
    flagDropping = false;
    flagExitStart = performance.now();
    ensureAnimating();
  } else if (!flagVisible) {
    animating = false;
  }
}
