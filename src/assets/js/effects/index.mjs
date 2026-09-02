// @ts-check

/** @typedef {import("~/types/cents").Cents} Cents */

/**
 * @typedef {object} EffectModule
 * @property {(canvas: HTMLCanvasElement) => void} init
 * @property {(amount: Cents, showHyperdrive: boolean) => Promise<void>} show
 * @property {() => Promise<void>} stop
 * @property {(() => void) | null} showStatic
 * @property {(() => Promise<void>) | null} ledEffect - null when the effect
 *   drives its LEDs itself and has no standalone programme
 */

import { confettiEffect } from "./confetti.mjs";
import { dolphinEffect } from "./dolphin.mjs";
import { matrixEffect } from "./matrix.mjs";
import { mericaEffect } from "./merica.mjs";
import { snoopEffect } from "./snoop.mjs";

/** @satisfies {Record<string, EffectModule>} */
const effects = {
  confetti: confettiEffect,
  dolphin: dolphinEffect,
  matrix: matrixEffect,
  snoop: snoopEffect,
  merica: mericaEffect,
};

export default effects;
