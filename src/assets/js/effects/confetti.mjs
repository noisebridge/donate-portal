// @ts-check

import { ledClear, ledConfetti, ledHyperdrive } from "./led_effects.mjs";

/** @typedef {import("~/types/cents").Cents} Cents */

/**
 * @typedef {object} ConfettiParticle
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} size
 * @property {string} color
 * @property {number} rotation
 * @property {number} rotationSpeed
 * @property {number} opacity
 * @property {boolean} settled
 * @property {number} fadeStart
 * @property {number} contactStart
 * @property {string | null} emoji
 */

/**
 * @typedef {object} TrailPoint
 * @property {number} x
 * @property {number} y
 * @property {number} opacity
 */

/**
 * @typedef {object} Rocket
 * @property {number} x
 * @property {number} y
 * @property {number} targetY
 * @property {number} vy
 * @property {number} sparklePhase
 * @property {boolean} exploded
 * @property {Cents} amount
 * @property {TrailPoint[]} trail
 */

const COLORS = [
  "#ff6b6b",
  "#feca57",
  "#48dbfb",
  "#ff9ff3",
  "#54a0ff",
  "#5f27cd",
  "#01a3a4",
  "#f368e0",
  "#ff9f43",
  "#00d2d3",
];
/** @type {Record<number, string[]>} */
const EMOJI_MAP = {
  6900: ["\u{1F346}", "\u{1F351}"],
  6969: ["\u{1F346}", "\u{1F351}"],

  670: ["\u{1F450}"],
  6700: ["\u{1F450}"],
  6767: ["\u{1F450}"],

  314: ["\u{1F967}"],
  3141: ["\u{1F967}"],
  3142: ["\u{1F967}"],
  31415: ["\u{1F967}"],
  31416: ["\u{1F967}"],
  314159: ["\u{1F967}"], // Let a man dream.
};
const PARTICLES_DEFAULT = 80;
const PARTICLES_EMOJI = 20;
const GRAVITY = 0.15;
const DRAG = 0.98;
const TRAIL_FADE_RATE = 0.03;
const ROCKET_SPEED = 3;
const BOUNCE_DAMPING = 0.3;
const FRICTION = 0.95;
const SETTLED_THRESHOLD = 0.5;
const FADE_AFTER_MIN = 60000;
const FADE_AFTER_MAX = 90000;
const FADE_DURATION = 2000;
const MAX_PARTICLE_SIZE = 10;
const CELL_SIZE = MAX_PARTICLE_SIZE * 0.4 * 2;

/** @type {Map<number, ConfettiParticle[]>} */
const spatialGrid = new Map();

/** @type {Set<ConfettiParticle>} */
const contactedThisFrame = new Set();

/** @type {ConfettiParticle[]} */
let particles = [];
/** @type {Rocket[]} */
let rockets = [];
let animating = false;
/** @type {number[]} */
let pendingTimers = [];

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;

/**
 * Initialize the confetti system with a canvas element.
 * @param {HTMLCanvasElement} canvasEl
 */
export function initConfetti(canvasEl) {
  canvas = canvasEl;
  ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
}

/**
 * Get the collision radius for a particle (treat as circle).
 * @param {ConfettiParticle} p
 * @returns {number}
 */
function particleRadius(p) {
  return p.size * 0.4;
}

/**
 * Hash a cell coordinate pair into a single numeric key.
 * @param {number} cx
 * @param {number} cy
 * @returns {number}
 */
function cellKey(cx, cy) {
  // Pack both coordinates into one int; the offset keeps negatives positive
  const a = cx + 0x8000;
  const b = cy + 0x8000;
  return (a << 16) | b;
}

/**
 * Build the spatial hash grid from all current particles, settled or not.
 */
function buildSpatialGrid() {
  spatialGrid.clear();
  for (const p of particles) {
    const cx = Math.floor(p.x / CELL_SIZE);
    const cy = Math.floor(p.y / CELL_SIZE);
    const key = cellKey(cx, cy);
    const bucket = spatialGrid.get(key);

    if (bucket) {
      bucket.push(p);
    } else {
      spatialGrid.set(key, [p]);
    }
  }
}

/**
 * Run collision detection using the spatial grid.
 * Only iterates a fixed half of the 8 neighbor cells so each pair of cells is
 * visited once.
 */
function collideViaSpatialGrid() {
  for (const [key, bucket] of spatialGrid) {
    // Intra-cell: all pairs within this cell
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        resolveCollision(
          /** @type {ConfettiParticle} */ (bucket[i]),
          /** @type {ConfettiParticle} */ (bucket[j]),
        );
      }
    }

    // Inter-cell: only check 4 of 8 neighbors to avoid duplicate pairs
    const cx = (key >> 16) - 0x8000;
    const cy = (key & 0xffff) - 0x8000;
    const neighborOffsets = /** @type {[number, number][]} */ ([
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
    ]);

    for (const [ndx, ndy] of neighborOffsets) {
      const neighborKey = cellKey(cx + ndx, cy + ndy);
      const neighbor = spatialGrid.get(neighborKey);
      if (!neighbor) continue;

      for (let i = 0; i < bucket.length; i++) {
        for (let j = 0; j < neighbor.length; j++) {
          resolveCollision(
            /** @type {ConfettiParticle} */ (bucket[i]),
            /** @type {ConfettiParticle} */ (neighbor[j]),
          );
        }
      }
    }
  }
}

/**
 * Resolve collision between two circular particles.
 * @param {ConfettiParticle} a
 * @param {ConfettiParticle} b
 */
function resolveCollision(a, b) {
  if (a.settled && b.settled) {
    return;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const rA = particleRadius(a);
  const rB = particleRadius(b);
  const minDist = rA + rB;

  if (dist < minDist && dist > 0.01) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    if (a.settled) {
      // Only push the moving particle out
      b.x += nx * overlap;
      b.y += ny * overlap;
    } else if (b.settled) {
      a.x -= nx * overlap;
      a.y -= ny * overlap;
    } else {
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
    }

    // Settle a slow-moving particle that lands on a settled one
    if (a.settled && !b.settled) {
      if (
        Math.abs(b.vx) < SETTLED_THRESHOLD &&
        Math.abs(b.vy) < SETTLED_THRESHOLD
      ) {
        b.vx = 0;
        b.vy = 0;
        b.rotationSpeed = 0;
        b.settled = true;
        return;
      }
    } else if (b.settled && !a.settled) {
      if (
        Math.abs(a.vx) < SETTLED_THRESHOLD &&
        Math.abs(a.vy) < SETTLED_THRESHOLD
      ) {
        a.vx = 0;
        a.vy = 0;
        a.rotationSpeed = 0;
        a.settled = true;
        return;
      }
    }

    // Mark particles as in contact this frame
    if (!a.settled) contactedThisFrame.add(a);
    if (!b.settled) contactedThisFrame.add(b);

    // Relative velocity along collision normal
    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const relVel = dvx * nx + dvy * ny;

    // Only resolve if particles are moving toward each other
    if (relVel > 0) {
      const restitution = 0.3;
      const impulse = relVel * restitution;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Cents} amount
 */
function spawnExplosion(x, y, amount) {
  const now = performance.now();
  const particleCount = EMOJI_MAP[amount.cents]
    ? PARTICLES_EMOJI
    : PARTICLES_DEFAULT;
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 8;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 4 + Math.random() * 6,
      color: /** @type {string} */ (
        COLORS[Math.floor(Math.random() * COLORS.length)]
      ),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      opacity: 1,
      settled: false,
      fadeStart:
        now +
        FADE_AFTER_MIN +
        Math.random() * (FADE_AFTER_MAX - FADE_AFTER_MIN),
      contactStart: 0,
      emoji: getEmoji(amount),
    });
  }
}

/**
 * Get a random emoji if there is one for the cent amount.
 * @param {Cents} amount
 * @returns {string | null}
 */
function getEmoji(amount) {
  const emojiOptions = EMOJI_MAP[amount.cents];
  if (!emojiOptions) {
    return null;
  }

  return /** @type {string} */ (
    emojiOptions[Math.floor(Math.random() * emojiOptions.length)]
  );
}

/**
 * @param {Cents} amount
 * @param {boolean | null} showHyperdrive
 */
export async function launchConfetti(amount, showHyperdrive) {
  const rocketCount = Math.min(
    25,
    Math.ceil(Math.floor(amount.cents / 1000) + 0.001),
  );

  /** @type {{ delay: number, explosionTime: number }[]} */
  const schedule = [];

  for (let i = 0; i < rocketCount; i++) {
    const delay = i * 300 + Math.random() * 200;
    const speed = ROCKET_SPEED + Math.random() * 1.5;
    const startX = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
    const targetY = Math.random() * canvas.height * 0.35 + canvas.height * 0.1;
    const sparklePhase = Math.random() * Math.PI * 2;
    const flightDistance = canvas.height + 10 - targetY;
    const estimatedFlightMs = (flightDistance / speed) * (1000 / 60);

    schedule.push({ delay, explosionTime: estimatedFlightMs });

    pendingTimers.push(
      window.setTimeout(() => {
        rockets.push({
          x: startX,
          y: canvas.height + 10,
          targetY,
          vy: -speed,
          sparklePhase,
          exploded: false,
          trail: [],
          amount,
        });

        if (!animating) {
          animating = true;
          requestAnimationFrame(animate);
        }
      }, delay),
    );
  }

  switch (showHyperdrive) {
    case true:
      await ledHyperdrive();
      break;
    case false:
      await ledConfetti(schedule);
      break;
    case null:
      break;
  }

  if (!animating) {
    animating = true;
    requestAnimationFrame(animate);
  }
}

/**
 * Stop all confetti animations and clear the canvas.
 */
export async function stopConfetti() {
  for (const id of pendingTimers) {
    clearTimeout(id);
  }

  pendingTimers = [];
  particles = [];
  rockets = [];
  animating = false;
  await ledClear();
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * @param {Rocket} r
 */
function drawRocketSparkle(r) {
  r.sparklePhase += 0.3;
  const flicker = 0.6 + 0.4 * Math.sin(r.sparklePhase);
  const size = 3 + flicker * 3;

  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.globalAlpha = flicker;

  // 4-point star sparkle
  ctx.fillStyle = "#ffffcc";
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const outerR = size;
    const innerR = size * 0.3;
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    const midAngle = angle + Math.PI / 4;
    ctx.lineTo(Math.cos(midAngle) * innerR, Math.sin(midAngle) * innerR);
  }
  ctx.closePath();
  ctx.fill();

  // glow
  ctx.globalAlpha = flicker * 0.4;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let alive = false;
  const floor = canvas.height;

  // Update and draw rockets
  for (const r of rockets) {
    if (r.exploded) {
      continue;
    }

    alive = true;

    // Add trail point
    r.trail.push({ x: r.x, y: r.y, opacity: 0.6 });

    r.y += r.vy;
    // slight horizontal wobble
    r.x += Math.sin(r.sparklePhase * 0.5) * 0.3;

    // Draw trail
    for (let i = r.trail.length - 1; i >= 0; i--) {
      const t = /** @type {TrailPoint} */ (r.trail[i]);
      t.opacity -= TRAIL_FADE_RATE;
      if (t.opacity <= 0) {
        r.trail.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = t.opacity;
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawRocketSparkle(r);

    // Check if rocket reached target
    if (r.y <= r.targetY) {
      r.exploded = true;
      spawnExplosion(r.x, r.y, r.amount);
    }
  }

  // Remove offscreen and fully faded particles
  const margin = 100;
  particles = particles.filter(
    (p) =>
      p.opacity > 0 &&
      p.x > -margin &&
      p.x < canvas.width + margin &&
      p.y > -margin &&
      p.y < floor + margin,
  );

  const now = performance.now();

  // Update physics for confetti particles
  for (const p of particles) {
    if (p.settled) {
      continue;
    }

    // Force-settle if in contact with other particles for over 1 second
    if (p.contactStart > 0 && now - p.contactStart > 1000) {
      p.vx = 0;
      p.vy = 0;
      p.rotationSpeed = 0;
      p.settled = true;
      continue;
    }

    p.vy += GRAVITY;
    p.vx *= DRAG;
    p.vy *= DRAG;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;

    const r = particleRadius(p);

    // Floor collision
    if (p.y + r > floor) {
      p.y = floor - r;
      p.vy = -p.vy * BOUNCE_DAMPING;
      p.vx *= FRICTION;

      // If barely moving, settle
      if (
        Math.abs(p.vy) < SETTLED_THRESHOLD &&
        Math.abs(p.vx) < SETTLED_THRESHOLD
      ) {
        p.vx = 0;
        p.vy = 0;
        p.rotationSpeed = 0;
        p.settled = true;
      }
    }

    // Wall collisions (left/right)
    if (p.x - r < 0) {
      p.x = r;
      p.vx = -p.vx * BOUNCE_DAMPING;
    } else if (p.x + r > canvas.width) {
      p.x = canvas.width - r;
      p.vx = -p.vx * BOUNCE_DAMPING;
    }
  }

  // Particle-to-particle collision via spatial hash grid (after movement)
  contactedThisFrame.clear();
  buildSpatialGrid();
  collideViaSpatialGrid();

  // Update contact timers: stamp new contacts, reset particles with no contact
  for (const p of particles) {
    if (p.settled) {
      continue;
    }

    if (contactedThisFrame.has(p)) {
      if (p.contactStart === 0) p.contactStart = now;
    } else {
      p.contactStart = 0;
    }
  }

  // Draw confetti particles
  for (const p of particles) {
    alive = true;

    // Fade out after the particle's random lifetime
    if (now >= p.fadeStart) {
      p.opacity = Math.max(0, 1 - (now - p.fadeStart) / FADE_DURATION);
      if (p.opacity <= 0) {
        continue;
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.opacity;
    if (p.emoji) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `${p.size * 3}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.emoji, 0, 0);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    ctx.restore();
  }

  // Check for lingering trails on exploded rockets
  for (const r of rockets) {
    if (!r.exploded) {
      continue;
    }

    for (let i = r.trail.length - 1; i >= 0; i--) {
      const t = /** @type {TrailPoint} */ (r.trail[i]);
      t.opacity -= TRAIL_FADE_RATE;
      if (t.opacity <= 0) {
        r.trail.splice(i, 1);
        continue;
      }

      alive = true;
      ctx.save();
      ctx.globalAlpha = t.opacity;
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (alive) {
    requestAnimationFrame(animate);
  } else {
    animating = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export const confettiEffect = {
  init: initConfetti,
  show: (/** @type {Cents} */ amount, /** @type {boolean} */ showHyperdrive) =>
    launchConfetti(amount, showHyperdrive),
  stop: stopConfetti,
  showStatic: null,
  ledEffect: ledConfetti,
};
