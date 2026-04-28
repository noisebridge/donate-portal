import { escapeHtml } from "@kitajs/html";
import type { Message } from "~/types/message";

export type { Message } from "~/types/message";

export interface MessageContainerProps {
  messages: Message[];
}

export function MessageContainer({ messages }: MessageContainerProps) {
  if (messages.length === 0) return null;

  return (
    <div class="message-container">
      {messages.map((message) => (
        <div
          class={`message message-${message.type}`}
          role="alert"
          data-type={message.type}
        >
          <span class="message-text">{escapeHtml(message.text)}</span>
          {(message.dismissable ?? true) && (
            <button type="button" class="message-dismiss" aria-label="Dismiss">
              &times;
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
