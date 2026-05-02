// @ts-check

import { ledClear, ledDolphin, ledHyperdrive } from "./led_effects.mjs";

const DOLPHIN_LEFT_SRC = "/assets/image/dolphin-left.png";
const DOLPHIN_RIGHT_SRC = "/assets/image/dolphin-right.png";

const SPIN_GROW_DURATION = 2000;
const SPIN_ROTATIONS = 3;
const FLY_DURATION = 4000;
const BANNER_DOLPHIN_WIDTH = 280;
const BANNER_DOLPHIN_MARGIN = 60;
const FLYING_DOLPHIN_COUNT = 4;
const FLYING_DOLPHIN_HEIGHT = 480;
const FLY_Y_JITTER_MAX = 240;
const TYPEWRITER_DELAY_MS = 90;
const TYPEWRITER_HOLD_MS = 1000;
const TYPEWRITER_TEXT = "SO LONG AND\nTHANKS FOR\nALL THE FISH";

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
let animating = false;

/** @type {HTMLImageElement | null} */
let dolphinLeftImg = null;
/** @type {HTMLImageElement | null} */
let dolphinRightImg = null;

/** @type {boolean} */
let bannerVisible = false;
/** @type {number} */
let bannerEnterStart = 0;
/** @type {boolean} */
let bannerAnimating = false;

/** @type {boolean} */
let flyingActive = false;
/** @type {number} */
let flyStart = 0;

/** @type {HTMLImageElement[]} */
let flyingEls = [];

/** @type {number[]} */
let flyYOffsets = [];

/** @type {HTMLDivElement | null} */
let typewriterEl = null;

/** @type {boolean} */
let typewriterCancelled = false;

/**
 * Ease-out cubic.
 * @param {number} t
 * @returns {number}
 */
function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * Initialize the dolphin system.
 * @param {HTMLCanvasElement} canvasEl
 */
export function initDolphin(canvasEl) {
  canvas = canvasEl;
  ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

  dolphinLeftImg = new Image();
  dolphinLeftImg.src = DOLPHIN_LEFT_SRC;

  dolphinRightImg = new Image();
  dolphinRightImg.src = DOLPHIN_RIGHT_SRC;

  flyingEls = [];
  for (let i = 0; i < FLYING_DOLPHIN_COUNT; i++) {
    const el = /** @type {HTMLImageElement} */ (
      document.getElementById(`dolphin-fly-${i}`)
    );
    flyingEls.push(el);
  }
}

/**
 * Get the center position of the alert amount element.
 * @returns {{ x: number, y: number }}
 */
function getAmountCenter() {
  const el = document.getElementById("alert-amount");
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Draw the banner dolphins (left and right of the donation text) on the canvas.
 * @param {number} progress - 0..1
 */
function drawBannerDolphins(progress) {
  if (!dolphinLeftImg?.complete || !dolphinRightImg?.complete) return;

  const center = getAmountCenter();
  const easedProgress = easeOut(progress);

  const finalWidth = BANNER_DOLPHIN_WIDTH;
  const currentWidth = 1 + (finalWidth - 1) * easedProgress;
  const rotation = SPIN_ROTATIONS * Math.PI * 2 * (1 - easedProgress);

  const leftAspect = dolphinLeftImg.naturalHeight / dolphinLeftImg.naturalWidth;
  const rightAspect =
    dolphinRightImg.naturalHeight / dolphinRightImg.naturalWidth;

  const leftHeight = currentWidth * leftAspect;
  const rightHeight = currentWidth * rightAspect;

  const leftX = center.x - BANNER_DOLPHIN_MARGIN - finalWidth / 2;
  const rightX = center.x + BANNER_DOLPHIN_MARGIN + finalWidth / 2;

  ctx.save();
  ctx.translate(leftX, center.y);
  ctx.rotate(-rotation);
  ctx.drawImage(
    dolphinLeftImg,
    -currentWidth / 2,
    -leftHeight / 2,
    currentWidth,
    leftHeight,
  );
  ctx.restore();

  ctx.save();
  ctx.translate(rightX, center.y);
  ctx.rotate(rotation);
  ctx.drawImage(
    dolphinRightImg,
    -currentWidth / 2,
    -rightHeight / 2,
    currentWidth,
    rightHeight,
  );
  ctx.restore();
}

/**
 * Position the flying dolphins based on progress.
 * @param {number} progress - 0..1
 */
function positionFlyingDolphins(progress) {
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const viewH = window.innerHeight / zoom;
  const viewW = window.innerWidth / zoom;
  const spacing = viewW / (FLYING_DOLPHIN_COUNT + 1);

  for (let i = 0; i < FLYING_DOLPHIN_COUNT; i++) {
    const el = flyingEls[i];
    if (!el) continue;

    const aspect = el.naturalWidth / el.naturalHeight || 0.4;
    const drawHeight = FLYING_DOLPHIN_HEIGHT;
    const drawWidth = drawHeight * aspect;

    const x = spacing * (i + 1) - drawWidth / 2;
    const totalTravel = viewH + drawHeight * 2;
    const startY = viewH + drawHeight;
    const y = startY - totalTravel * progress + (flyYOffsets[i] ?? 0);

    el.style.display = "block";
    el.style.height = `${drawHeight}px`;
    el.style.width = `${drawWidth}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = "none";
  }
}

/** Hide all flying dolphins. */
function hideFlyingDolphins() {
  for (const el of flyingEls) {
    if (el) el.style.display = "none";
  }
}

/**
 * Main animation loop.
 * @param {number} now
 */
function animate(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let needsFrame = false;

  if (bannerVisible) {
    if (bannerAnimating) {
      const elapsed = now - bannerEnterStart;
      const progress = Math.min(1, elapsed / SPIN_GROW_DURATION);
      drawBannerDolphins(progress);
      if (progress >= 1) {
        bannerAnimating = false;
      } else {
        needsFrame = true;
      }
    } else {
      drawBannerDolphins(1);
    }
  }

  if (flyingActive) {
    const elapsed = now - flyStart;
    const progress = Math.min(1, elapsed / FLY_DURATION);
    positionFlyingDolphins(progress);

    if (progress >= 1) {
      flyingActive = false;
      hideFlyingDolphins();
    } else {
      needsFrame = true;
    }
  }

  if (needsFrame) {
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
 * Show the banner dolphins immediately at full size (no animation).
 */
export function showDolphinStatic() {
  bannerVisible = true;
  bannerAnimating = false;

  function draw() {
    drawBannerDolphins(1);
  }

  const leftReady = dolphinLeftImg?.complete;
  const rightReady = dolphinRightImg?.complete;

  if (leftReady && rightReady) {
    draw();
  } else {
    if (!leftReady) {
      dolphinLeftImg?.addEventListener("load", () => {
        if (dolphinRightImg?.complete) draw();
      });
    }
    if (!rightReady) {
      dolphinRightImg?.addEventListener("load", () => {
        if (dolphinLeftImg?.complete) draw();
      });
    }
  }
}

/**
 * Show the typewriter text overlay, revealing one character at a time.
 * Returns a promise that resolves after the hold period, or rejects if cancelled.
 * @returns {Promise<void>}
 */
function showTypewriterText() {
  return new Promise((resolve) => {
    typewriterCancelled = false;

    typewriterEl = document.createElement("div");
    typewriterEl.className = "dolphin-typewriter";

    const lines = TYPEWRITER_TEXT.split("\n");
    /** @type {HTMLSpanElement[]} */
    const charSpans = [];

    for (const line of lines) {
      const lineDiv = document.createElement("div");
      for (const ch of line) {
        const span = document.createElement("span");
        span.textContent = ch;
        span.classList.add("dolphin-typewriter-char");
        lineDiv.appendChild(span);
        charSpans.push(span);
      }
      typewriterEl.appendChild(lineDiv);
    }

    document.body.appendChild(typewriterEl);

    let i = 0;
    const interval = setInterval(() => {
      if (typewriterCancelled) {
        clearInterval(interval);
        removeTypewriterText();
        resolve();
        return;
      }

      if (i < charSpans.length) {
        /** @type {HTMLSpanElement} */ (charSpans[i]).classList.remove(
          "dolphin-typewriter-char",
        );
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          removeTypewriterText();
          resolve();
        }, TYPEWRITER_HOLD_MS);
      }
    }, TYPEWRITER_DELAY_MS);
  });
}

/** Remove the typewriter overlay from the DOM. */
function removeTypewriterText() {
  if (typewriterEl) {
    typewriterEl.remove();
    typewriterEl = null;
  }
}

/**
 * Launch the dolphin takeover effect.
 * @param {boolean} showHyperdrive
 */
export async function showDolphin(showHyperdrive) {
  const now = performance.now();

  bannerVisible = true;
  bannerAnimating = true;
  bannerEnterStart = now;

  ensureAnimating();

  await showTypewriterText();

  if (typewriterCancelled) return;

  flyingActive = true;
  flyStart = performance.now();
  flyYOffsets = [];
  for (let i = 0; i < FLYING_DOLPHIN_COUNT; i++) {
    flyYOffsets.push((Math.random() - 0.5) * 2 * FLY_Y_JITTER_MAX);
  }

  ensureAnimating();

  if (showHyperdrive) {
    await ledHyperdrive();
  } else {
    await ledDolphin();
  }
}

/**
 * Stop the dolphin effect and clean up.
 */
export async function stopDolphin() {
  typewriterCancelled = true;
  removeTypewriterText();

  bannerVisible = false;
  bannerAnimating = false;
  flyingActive = false;
  animating = false;

  hideFlyingDolphins();
  await ledClear();

  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/** @typedef {import("~/types/cents").Cents} Cents */

export const dolphinEffect = {
  init: initDolphin,
  show: (/** @type {Cents} */ _amount, /** @type {boolean} */ showHyperdrive) =>
    showDolphin(showHyperdrive),
  stop: stopDolphin,
  showStatic: showDolphinStatic,
  ledEffect: ledDolphin,
};
