// @ts-check

/** @param {number} t */
export const easeOut = (t) => 1 - (1 - t) ** 3;

/** @param {number} t */
export const easeIn = (t) => t ** 3;
