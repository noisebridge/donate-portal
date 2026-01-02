// @ts-check

/**
 * @typedef {import("~/components/message-container").Message} Message
 */

/**
 * Initialize message dismiss handlers
 */
export function initMessages() {
  const container = document.querySelector(".message-container");
  if (!container) return;

  const messages = /** @type {NodeListOf<HTMLElement>} */ (
    container.querySelectorAll(".message")
  );

  messages.forEach((message) => {
    const type = /** @type {Message["type"]} */ (message.dataset["type"]);

    const dismissBtn = message.querySelector(".message-dismiss");
    dismissBtn?.addEventListener("click", () => {
      dismissMessage(message, type);
    });

    // Auto-clear "info" type messages
    if (type === "info") {
      setTimeout(() => dismissMessage(message, type), 8000);
    }
  });
}

/**
 * @param {HTMLElement} message
 * @param {Message["type"]} type
 */
function dismissMessage(message, type) {
  // Skip if element has already been removed from the DOM
  if (!message.isConnected) {
    return;
  }

  // Remove query parameter
  const url = new URL(window.location.href);
  url.searchParams.delete(type);
  history.replaceState({}, "", url);

  message.remove();

  // Remove container if empty
  const container = document.querySelector(".message-container");
  if (container?.children?.length === 0) {
    container.remove();
  }
}
