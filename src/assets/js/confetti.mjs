// @ts-check

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
const PARTICLES_PER_EXPLOSION = 80;
const GRAVITY = 0.15;
const DRAG = 0.98;
const TRAIL_FADE_RATE = 0.03;
const ROCKET_SPEED = 3;
const BOUNCE_DAMPING = 0.3;
const FRICTION = 0.95;
const SETTLED_THRESHOLD = 0.3;
const FADE_AFTER_MIN = 60000;
const FADE_AFTER_MAX = 90000;
const FADE_DURATION = 2000;

/** @type {ConfettiParticle[]} */
let particles = [];
/** @type {Rocket[]} */
const rockets = [];
let animating = false;

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

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener("resize", resize);
  resize();
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
 * Resolve collision between two circular particles.
 * @param {ConfettiParticle} a
 * @param {ConfettiParticle} b
 */
function resolveCollision(a, b) {
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

    // Push apart (half each)
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

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
 */
function spawnExplosion(x, y) {
  const now = performance.now();
  for (let i = 0; i < PARTICLES_PER_EXPLOSION; i++) {
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
    });
  }
}

/**
 * @param {number} dollars
 */
export function launchConfetti(dollars) {
  const rocketCount = Math.min(10, Math.ceil(Math.floor(dollars / 10) + 0.001));

  for (let i = 0; i < rocketCount; i++) {
    const delay = i * 300 + Math.random() * 200;
    setTimeout(() => {
      rockets.push({
        x: Math.random() * canvas.width * 0.8 + canvas.width * 0.1,
        y: canvas.height + 10,
        targetY: Math.random() * canvas.height * 0.35 + canvas.height * 0.1,
        vy: -(ROCKET_SPEED + Math.random() * 1.5),
        sparklePhase: Math.random() * Math.PI * 2,
        exploded: false,
        trail: [],
      });

      if (!animating) {
        animating = true;
        requestAnimationFrame(animate);
      }
    }, delay);
  }

  if (!animating) {
    animating = true;
    requestAnimationFrame(animate);
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
    if (r.exploded) continue;
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
      spawnExplosion(r.x, r.y);
    }
  }

  // Particle-to-particle collision (rough pass — check nearby pairs)
  for (let i = 0; i < particles.length; i++) {
    const a = /** @type {ConfettiParticle} */ (particles[i]);
    for (let j = i + 1; j < particles.length; j++) {
      const b = /** @type {ConfettiParticle} */ (particles[j]);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const maxDist = particleRadius(a) + particleRadius(b);
      // Quick distance check to skip far-away pairs
      if (Math.abs(dx) > maxDist || Math.abs(dy) > maxDist) continue;
      resolveCollision(a, b);
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

  // Update and draw confetti particles
  for (const p of particles) {
    alive = true;

    // Fade out after the particle's random lifetime
    if (now >= p.fadeStart) {
      p.opacity = Math.max(0, 1 - (now - p.fadeStart) / FADE_DURATION);
      if (p.opacity <= 0) continue;
    }

    if (!p.settled) {
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

    // Draw particle
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }

  // Check for lingering trails on exploded rockets
  for (const r of rockets) {
    if (!r.exploded) continue;

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
