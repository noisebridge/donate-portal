// @ts-check

const ARNOLD_ENTER_DURATION = 2000;
const ARNOLD_HOLD_DURATION = 4000;
const EAGLE_SWOOP_DURATION = 3000;
const ARNOLD_EXIT_DURATION = 2000;

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

/**
 * Initialize the merica system.
 */
export function initMerica() {
  arnoldEl = /** @type {HTMLImageElement} */ (
    document.getElementById("arnold-img")
  );
  eagleEl = /** @type {HTMLImageElement} */ (
    document.getElementById("eagle-img")
  );
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
 * Position Arnold rising from the bottom of the screen.
 * @param {number} yBottom - Desired bottom edge of the image in viewport px
 */
function positionArnold(yBottom) {
  const imgAspect = arnoldEl.naturalWidth / arnoldEl.naturalHeight;
  const drawWidth = window.innerWidth;
  const drawHeight = drawWidth / imgAspect;
  const top = yBottom - drawHeight;

  arnoldEl.style.display = "block";
  arnoldEl.style.top = `${top}px`;
}

/** Hide the Arnold DOM image element. */
function hideArnold() {
  arnoldEl.style.display = "none";
}

/**
 * Get the Y-bottom value where Arnold is fully off-screen (below).
 * @returns {number}
 */
function arnoldOffscreenY() {
  const imgAspect = arnoldEl.naturalWidth / arnoldEl.naturalHeight;
  if (!imgAspect) return window.innerHeight * 2;
  const drawHeight = window.innerWidth / imgAspect;
  return window.innerHeight + drawHeight;
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
 * Main animation loop.
 * @param {number} now
 */
function animate(now) {
  const elapsed = now - phaseStart;
  const restingY = window.innerHeight;
  const offscreenY = arnoldOffscreenY();

  if (phase === "arnold_enter") {
    const progress = Math.min(1, elapsed / ARNOLD_ENTER_DURATION);
    const y = offscreenY + (restingY - offscreenY) * easeOut(progress);
    positionArnold(y);

    if (progress >= 1) {
      phase = "arnold_hold";
      phaseStart = now;
    }
  } else if (phase === "arnold_hold") {
    positionArnold(restingY);

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
    const y = restingY + (offscreenY - restingY) * easeIn(progress);
    positionArnold(y);

    if (progress >= 1) {
      phase = "idle";
      hideArnold();
    }
  }

  if (phase !== "idle") {
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
 * Sequence: Arnold rises, holds, eagle swoops, Arnold retracts.
 */
export function showMerica() {
  phase = "arnold_enter";
  phaseStart = performance.now();
  ensureAnimating();
}

/**
 * Stop the merica effect immediately.
 */
export function stopMerica() {
  phase = "idle";
  hideArnold();
  hideEagle();
  animating = false;
}
