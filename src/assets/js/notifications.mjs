// @ts-check

/**
 * Initialize notification dismiss handlers
 */
export function initNotifications() {
  const container = document.querySelector(".notification-container");
  if (!container) return;

  const notifications = /** @type {NodeListOf<HTMLElement>} */ (
    container.querySelectorAll(".notification")
  );

  notifications.forEach((notification) => {
    const dismissBtn = notification.querySelector(".notification-dismiss");
    const type = notification.dataset["type"];

    dismissBtn?.addEventListener("click", () => {
      dismissNotification(notification, type);
    });

    // Auto-clear "info" type notifications
    if (type === "info") {
      setTimeout(() => dismissNotification(notification, type), 5000);
    }
  });
}

/**
 * @param {HTMLElement} notification
 * @param {string | undefined} type
 */
function dismissNotification(notification, type) {
  // Skip if element has already been removed from the DOM
  if (!notification.isConnected) {
    return;
  }

  // Remove query parameter
  if (type) {
    const url = new URL(window.location.href);
    url.searchParams.delete(type);
    history.replaceState({}, "", url);
  }

  const duration = 300; // milliseconds
  notification.style.animation = `notification-fade-out ${duration / 1000}s ease forwards`;

  setTimeout(() => {
    notification.remove();

    // Remove container if empty
    const container = document.querySelector(".notification-container");
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, duration);
}
