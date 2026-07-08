// @ts-check

/**
 * Position a range slider's preset ticks along its track and wire each one to
 * select its value when clicked.
 *
 * Each tick is expected to carry its value in a `data-amt` attribute. The tick
 * is placed at the fraction of the track matching that value (via the `--frac`
 * custom property) so the pips line up with where the slider thumb actually
 * sits. CSP blocks inline style attributes, so this is set here in JS rather
 * than in the rendered markup.
 *
 * @param {number} min - Slider minimum, matching its `min` attribute.
 * @param {number} max - Slider maximum, matching its `max` attribute.
 * @param {(value: number) => void} onSelect - Called with a tick's value when clicked.
 * @param {string} [selector] - Selector for the tick elements.
 */
export function initSliderTicks(
  min,
  max,
  onSelect,
  selector = "#slider-ticks .tick",
) {
  const ticks = /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll(selector)
  );
  ticks.forEach((tick) => {
    const amount = tick.dataset["amt"];
    if (amount === undefined) {
      return;
    }

    const value = parseFloat(amount);
    if (Number.isNaN(value)) {
      return;
    }

    const frac = max > min ? (value - min) / (max - min) : 0;
    tick.style.setProperty("--frac", String(frac));

    tick.addEventListener("click", () => onSelect(value));
  });
}
