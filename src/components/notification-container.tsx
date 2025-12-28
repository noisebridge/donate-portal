// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";

export interface Notification {
  type: "error" | "info";
  message: string;
}

export interface NotificationContainerProps {
  notifications: Notification[];
}

export function NotificationContainer({
  notifications,
}: NotificationContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div class="notification-container">
      {notifications.map((notification) => (
        <div
          class={`notification notification-${notification.type}`}
          role="alert"
          data-type={notification.type}
        >
          <span class="notification-message">{notification.message}</span>
          <button
            type="button"
            class="notification-dismiss"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
