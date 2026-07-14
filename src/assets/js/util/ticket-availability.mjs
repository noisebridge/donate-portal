// @ts-check

/**
 * @typedef {Object} TicketAvailability
 * @property {number} capacity
 * @property {number} sold
 * @property {number} claimed
 * @property {number} remaining
 */

/**
 * @typedef {Object} TicketControls
 * @property {(maxQuantity: number) => void} enable
 * @property {(label: string) => void} disable
 */

const REQUEST_TIMEOUT_MILLISECONDS = 30_000;

/**
 * @param {unknown} value
 * @returns {value is TicketAvailability}
 */
export function isTicketAvailability(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const capacity = "capacity" in value ? value.capacity : undefined;
  const sold = "sold" in value ? value.sold : undefined;
  const claimed = "claimed" in value ? value.claimed : undefined;
  const remaining = "remaining" in value ? value.remaining : undefined;
  if (
    typeof capacity !== "number" ||
    typeof sold !== "number" ||
    typeof claimed !== "number" ||
    typeof remaining !== "number" ||
    !Number.isSafeInteger(capacity) ||
    !Number.isSafeInteger(sold) ||
    !Number.isSafeInteger(claimed) ||
    !Number.isSafeInteger(remaining)
  ) {
    return false;
  }

  return (
    capacity > 0 &&
    sold >= 0 &&
    claimed >= sold &&
    remaining >= 0 &&
    remaining === Math.max(0, capacity - claimed)
  );
}

/**
 * @param {string} url
 * @returns {Promise<TicketAvailability>}
 */
export async function fetchTicketAvailability(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
  });
  if (!response.ok) {
    throw new Error(`Ticket availability returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!isTicketAvailability(data)) {
    throw new Error("Ticket availability returned invalid data");
  }

  return data;
}

/**
 * Load ticket availability and keep the form disabled until a valid response
 * confirms that tickets remain. The server repeats the capacity check during
 * purchase, so this client state is only a responsive first line of defense.
 *
 * @param {HTMLFormElement} form
 * @param {TicketControls} ticketControls
 * @param {(url: string) => Promise<TicketAvailability>} [fetchAvailability]
 */
export function initTicketAvailability(
  form,
  ticketControls,
  fetchAvailability = fetchTicketAvailability,
) {
  const count = document.getElementById("ticket-count");
  const status = /** @type {HTMLElement | null} */ (
    document.getElementById("ticket-status")
  );
  const statusText = document.getElementById("ticket-status-text");
  const retry = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("ticket-availability-retry")
  );
  const email = /** @type {HTMLInputElement | null} */ (
    form.querySelector("#email")
  );
  const submit = /** @type {HTMLButtonElement | null} */ (
    form.querySelector('button[type="submit"]')
  );
  const url = form.dataset["availabilityUrl"];
  const configuredMax = Number.parseInt(form.dataset["maxQuantity"] ?? "", 10);

  if (
    !count ||
    !status ||
    !statusText ||
    !retry ||
    !email ||
    !submit ||
    !url ||
    !Number.isInteger(configuredMax) ||
    configuredMax < 1
  ) {
    console.error("Ticket availability controls are incomplete");
    return null;
  }

  let requestId = 0;

  /** @param {string} label */
  const disableCheckout = (label) => {
    ticketControls.disable(label);
    email.disabled = true;
    submit.disabled = true;
  };

  const load = async () => {
    const currentRequestId = ++requestId;
    disableCheckout("Checking availability…");
    form.hidden = false;
    form.setAttribute("aria-busy", "true");
    count.textContent = "Checking availability…";
    status.hidden = true;
    statusText.textContent = "";
    retry.hidden = true;
    retry.disabled = true;

    try {
      const availability = await fetchAvailability(url);
      if (currentRequestId !== requestId) {
        return;
      }

      count.textContent = `${availability.sold} of ${availability.capacity} sold`;
      form.setAttribute("aria-busy", "false");

      if (availability.remaining === 0) {
        form.hidden = true;
        status.hidden = false;
        statusText.textContent =
          availability.sold >= availability.capacity
            ? "Sold out."
            : "All remaining tickets are currently held in checkout.";
        retry.hidden = false;
        retry.disabled = false;
        return;
      }

      status.hidden = true;
      email.disabled = false;
      submit.disabled = false;
      ticketControls.enable(Math.min(configuredMax, availability.remaining));
    } catch (error) {
      if (currentRequestId !== requestId) {
        return;
      }

      console.error("Failed to load ticket availability:", error);
      count.textContent = "Availability unavailable";
      form.setAttribute("aria-busy", "false");
      status.hidden = false;
      statusText.textContent = "We couldn't check ticket availability.";
      retry.hidden = false;
      retry.disabled = false;
      disableCheckout("Availability unavailable");
    }
  };

  retry.addEventListener("click", () => void load());
  const ready = load();
  return { ready, reload: load };
}
