// @ts-check

import { sendErrorReport } from "./error-reporting.mjs";

/** @typedef {{ r: number, g: number, b: number }} RGB */

/**
 * @typedef {object} BurstPixel
 * @property {-1 | 1} dir - Expansion direction (-1 = CCW, 1 = CW)
 * @property {number} speed - LED positions per second
 * @property {number} r
 * @property {number} g
 * @property {number} b
 */

/**
 * @typedef {object} LedRocket
 * @property {number} launch - Launch time offset in ms from effect start
 * @property {number} travel - Travel duration in ms
 * @property {number} wraps - Number of times the rocket wraps around the strip
 * @property {BurstPixel[]} burst - Pre-computed explosion particles
 */

/**
 * @typedef {object} ConfettiLedData
 * @property {LedRocket[]} rockets
 * @property {number} [_t0] - Set on first call for timestamp calibration
 */

/**
 * @typedef {object} TimestampedLedData
 * @property {number} [_t0] - Set on first call for timestamp calibration
 */

/**
 * @typedef {object} HyperdriveRotation
 * @property {number} startTime - ms from effect start
 * @property {number} endTime - ms from effect start
 * @property {number} speed - rotations per second
 */

/**
 * @typedef {object} HyperdriveParticle
 * @property {number} pos - Fractional position on strip (0-1)
 * @property {number} spawnTime - ms from effect start
 * @property {number} fadeDuration - ms to fade out to black
 * @property {number} r
 * @property {number} g
 * @property {number} b
 */

/**
 * @typedef {object} HyperdriveLedData
 * @property {HyperdriveRotation[]} rotations
 * @property {HyperdriveParticle[]} particles
 * @property {number} spinDuration - Total spin phase duration in ms
 * @property {number} explosionPos - Fractional position (0-1) where explosion occurs
 * @property {number} expandDuration - ms for rainbow to cover full strip
 * @property {number} [_t0]
 */

const LED_API = "http://localhost:3000";

const IS_LOCAL_DEV =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

/**
 * Send a LED effect function to the controller.
 * @param {Function} fn - Self-contained function to serialize via .toString()
 * @param {unknown} [data] - Arbitrary JSON passed as the `data` parameter
 * @param {number} [timeout] - Auto-expire after this many ms
 */
async function sendLedEffect(fn, data, timeout) {
  if (IS_LOCAL_DEV) return;

  /** @type {Record<string, unknown>} */
  const body = { function: fn.toString() };
  if (data !== undefined) body["data"] = data;
  if (timeout !== undefined) body["timeout"] = timeout;

  try {
    await fetch(`${LED_API}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof Error) {
      sendErrorReport(e);
    }

    console.warn("LED effect update failed:", e);
  }
}

/**
 * Convert HSV to RGB.
 * @param {number} h - Hue 0-360
 * @param {number} s - Saturation 0-1
 * @param {number} v - Value 0-1
 * @returns {RGB}
 */
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// ---------------------------------------------------------------------------
// Self-contained LED functions — no closures, no module-scope references.
// Each is serialized via .toString() and eval'd on the LED controller.
// ---------------------------------------------------------------------------

/**
 * Confetti: white rocket pixels spinning clockwise, exploding into rainbow.
 * @param {number} index
 * @param {number} num_leds
 * @param {number} timestamp
 * @param {ConfettiLedData} data
 * @returns {RGB}
 */
function confettiLedFn(index, num_leds, timestamp, data) {
  if (!data._t0) data._t0 = timestamp;
  const t = timestamp - data._t0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i < data.rockets.length; i++) {
    const rocket = /** @type {LedRocket} */ (data.rockets[i]);
    if (t < rocket.launch) continue;
    const rt = t - rocket.launch;

    if (rt < rocket.travel * 3) {
      const progress = rt / (rocket.travel * 3);
      const ledPos = Math.floor(progress * rocket.wraps * num_leds) % num_leds;
      if (index === ledPos) {
        return { r: 255, g: 255, b: 255 };
      }
    } else {
      const et = rt - rocket.travel;
      if (et > 2000) continue;

      const brightness = 1 - et / 2000;
      const center = Math.floor(rocket.wraps * num_leds) % num_leds;

      for (let j = 0; j < rocket.burst.length; j++) {
        const bp = /** @type {BurstPixel} */ (rocket.burst[j]);
        const offset = Math.round(bp.dir * bp.speed * (et / 1000));
        const pos = (((center + offset) % num_leds) + num_leds) % num_leds;
        if (index === pos) {
          r = Math.max(r, Math.round(bp.r * brightness));
          g = Math.max(g, Math.round(bp.g * brightness));
          b = Math.max(b, Math.round(bp.b * brightness));
        }
      }
    }
  }

  return { r, g, b };
}

/**
 * Matrix: two white heads with green fading trails looping clockwise.
 * @param {number} index
 * @param {number} num_leds
 * @param {number} timestamp
 * @param {TimestampedLedData} data
 * @returns {RGB}
 */
function matrixLedFn(index, num_leds, timestamp, data) {
  if (!data._t0) data._t0 = timestamp;
  const t = (timestamp - data._t0) / 1000;
  const speed = num_leds / 3;
  const trailLen = 8;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let h = 0; h < 2; h++) {
    const headFloat = t * speed + h * (num_leds / 2);
    let headIdx = Math.floor(headFloat) % num_leds;
    if (headIdx < 0) headIdx += num_leds;

    if (index === headIdx) {
      r = 255;
      g = 255;
      b = 255;
    } else {
      for (let k = 1; k <= trailLen; k++) {
        const trailIdx = (headIdx - k + num_leds) % num_leds;
        if (index === trailIdx) {
          const gb = Math.round(255 * (1 - k / trailLen));
          g = Math.max(g, gb);
        }
      }
    }
  }

  return { r, g, b };
}

/**
 * Merica: alternating bands of red, white, red, white, blue x 4, spinning slowly.
 * @param {number} index
 * @param {number} num_leds
 * @param {number} timestamp
 * @returns {RGB}
 */
function mericaLedFn(index, num_leds, timestamp) {
  const shift = (timestamp / 10000) * 0.1;
  const pos = ((index / num_leds + shift) * 4) % 1;
  if (pos < 0.2) return { r: 255, g: 0, b: 0 };
  if (pos < 0.4) return { r: 255, g: 255, b: 255 };
  if (pos < 0.6) return { r: 255, g: 0, b: 0 };
  if (pos < 0.8) return { r: 255, g: 255, b: 255 };
  return { r: 0, g: 0, b: 255 };
}

/**
 * Hyperdrive: accelerating white pixel leaves sparks, explodes into rainbow.
 * @param {number} index
 * @param {number} num_leds
 * @param {number} timestamp
 * @param {HyperdriveLedData} data
 * @returns {RGB}
 */
function hyperdriveLedFn(index, num_leds, timestamp, data) {
  if (!data._t0) data._t0 = timestamp;
  const t = timestamp - data._t0;
  const fracPos = index / num_leds;

  // --- Phase 1: spinning white pixel with fading particles ---
  if (t < data.spinDuration) {
    let pixelPos = 0;
    for (let i = 0; i < data.rotations.length; i++) {
      const rot = /** @type {HyperdriveRotation} */ (data.rotations[i]);
      if (t < rot.startTime) break;
      if (t < rot.endTime) {
        const elapsed = (t - rot.startTime) / 1000;
        pixelPos = (elapsed * rot.speed) % 1;
        break;
      }
    }

    const pixelIdx = Math.floor(pixelPos * num_leds) % num_leds;
    if (index === pixelIdx) {
      return { r: 255, g: 255, b: 255 };
    }

    let pr = 0;
    let pg = 0;
    let pb = 0;
    for (let j = 0; j < data.particles.length; j++) {
      const p = /** @type {HyperdriveParticle} */ (data.particles[j]);
      if (t < p.spawnTime) continue;
      const age = t - p.spawnTime;
      if (age > p.fadeDuration) continue;
      const pIdx = Math.floor(p.pos * num_leds) % num_leds;
      if (index === pIdx) {
        const bright = 1 - age / p.fadeDuration;
        pr = Math.max(pr, Math.round(p.r * bright));
        pg = Math.max(pg, Math.round(p.g * bright));
        pb = Math.max(pb, Math.round(p.b * bright));
      }
    }
    return { r: pr, g: pg, b: pb };
  }

  // --- Phase 2 & 3: rainbow expansion then rotation ---
  const rainbowT = t - data.spinDuration;
  let expandProgress = rainbowT / data.expandDuration;
  if (expandProgress > 1) expandProgress = 1;

  const expPos = data.explosionPos;
  let dist = fracPos - expPos;
  if (dist < 0) dist = -dist;
  if (dist > 0.5) dist = 1 - dist;
  const normalizedDist = dist * 2;

  if (normalizedDist > expandProgress) {
    return { r: 0, g: 0, b: 0 };
  }

  const rotationOffset =
    rainbowT > data.expandDuration
      ? (rainbowT - data.expandDuration) / 2000
      : 0;
  const huePos = (((fracPos - expPos + rotationOffset) % 1) + 1) % 1;
  const hue = (huePos * 720) % 360;

  const c = 1;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  let hr = 0;
  let hg = 0;
  let hb = 0;
  if (hue < 60) {
    hr = c;
    hg = x;
  } else if (hue < 120) {
    hr = x;
    hg = c;
  } else if (hue < 180) {
    hg = c;
    hb = x;
  } else if (hue < 240) {
    hg = x;
    hb = c;
  } else if (hue < 300) {
    hr = x;
    hb = c;
  } else {
    hr = c;
    hb = x;
  }

  return {
    r: Math.round(hr * 255),
    g: Math.round(hg * 255),
    b: Math.round(hb * 255),
  };
}

/**
 * Snoop: entire strip fades in and out bright green.
 * @param {number} _index
 * @param {number} _num_leds
 * @param {number} timestamp
 * @param {TimestampedLedData} data
 * @returns {RGB}
 */
function snoopLedFn(_index, _num_leds, timestamp, data) {
  if (!data._t0) data._t0 = timestamp;
  const t = timestamp - data._t0;
  const brightness = Math.floor(255 * (0.5 + 0.5 * Math.sin(t / 500)));
  return { r: 0, g: brightness, b: 0 };
}

// ---------------------------------------------------------------------------
// Exported trigger functions
// ---------------------------------------------------------------------------

/**
 * Send confetti LED effect with pre-computed rocket schedule.
 * @param {number} rocketCount
 */
export async function ledConfetti(rocketCount) {
  /** @type {LedRocket[]} */
  const rockets = [];
  for (let i = 0; i < rocketCount; i++) {
    const delay = i * 300 + Math.random() * 200;
    const travel = 1500 + Math.random() * 2000;
    const wraps = (0.55 + Math.random() * 0.35) * 4;

    /** @type {BurstPixel[]} */
    const burst = [];
    for (let j = 0; j < 6; j++) {
      const hue = (j / 6) * 360;
      const rgb = hsvToRgb(hue, 1, 1);
      burst.push({
        dir: j < 3 ? -1 : 1,
        speed: 5 + Math.random() * 10,
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
      });
    }

    rockets.push({
      launch: Math.round(delay),
      travel: Math.round(travel),
      wraps,
      burst,
    });
  }

  /** @type {ConfettiLedData} */
  const data = { rockets };
  await sendLedEffect(confettiLedFn, data, 30000);
}

/** Send matrix LED effect. */
export async function ledMatrix() {
  /** @type {TimestampedLedData} */
  const data = {};
  await sendLedEffect(matrixLedFn, data);
}

/** Send merica LED effect. */
export async function ledMerica() {
  await sendLedEffect(mericaLedFn);
}

/** Send snoop LED effect. */
export async function ledSnoop() {
  /** @type {TimestampedLedData} */
  const data = {};
  await sendLedEffect(snoopLedFn, data);
}

/** Send hyperdrive LED effect. */
export async function ledHyperdrive() {
  /** @type {HyperdriveRotation[]} */
  const rotations = [];
  /** @type {HyperdriveParticle[]} */
  const particles = [];
  let cumTime = 0;

  for (let i = 0; i < 8; i++) {
    const speed = 1.05 ** i;
    const duration = 1000 / speed;

    rotations.push({
      startTime: Math.round(cumTime),
      endTime: Math.round(cumTime + duration),
      speed,
    });

    const numParticles = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < numParticles; j++) {
      const spawnFrac = Math.random();
      const spawnTime = cumTime + spawnFrac * duration;
      const pixelPos = (((spawnFrac * duration) / 1000) * speed) % 1;
      const rgb = hsvToRgb(Math.random() * 360, 1, 1);
      particles.push({
        pos: pixelPos,
        spawnTime: Math.round(spawnTime),
        fadeDuration: 2000 + Math.random() * 1000,
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
      });
    }

    cumTime += duration;
  }

  const lastRot = /** @type {HyperdriveRotation} */ (
    rotations[rotations.length - 1]
  );
  const finalElapsed = (lastRot.endTime - lastRot.startTime) / 1000;
  const finalPos = (finalElapsed * lastRot.speed) % 1;

  /** @type {HyperdriveLedData} */
  const data = {
    rotations,
    particles,
    spinDuration: Math.round(cumTime),
    explosionPos: finalPos,
    expandDuration: 1500,
  };

  await sendLedEffect(hyperdriveLedFn, data);
}

/** Turn off all LEDs. */
export async function ledClear() {
  if (IS_LOCAL_DEV) return;

  try {
    await fetch(`${LED_API}/reset`, {
      method: "POST",
    });
  } catch (e) {
    if (e instanceof Error) {
      sendErrorReport(e);
    }

    console.warn("LED reset failed:", e);
  }
}
