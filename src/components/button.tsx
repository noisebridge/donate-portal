import type { PropsWithChildren } from "@kitajs/html";

interface ButtonOwnProps {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  href?: string;
  type?: "button" | "submit";
  arrow?: boolean;
  icon?: JSX.Element;
  suffix?: string;
  danger?: boolean;
  disabled?: boolean;
  id?: string;
  class?: string;
  "aria-label"?: string;
  "aria-live"?: "off" | "assertive" | "polite";
}

export type ButtonProps = PropsWithChildren<ButtonOwnProps>;

export function Button({
  variant = "primary",
  href,
  type = "button",
  arrow,
  icon,
  suffix,
  danger,
  disabled,
  id,
  class: className,
  "aria-label": ariaLabel,
  "aria-live": ariaLive,
  children,
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, danger && "btn-danger", className]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {!!icon && (
        <span class="btn-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span class="btn-label">{children}</span>
      {!!arrow && <span class="btn-arrow">{"\u2192"}</span>}
      {!!suffix && <span class="btn-suffix">{suffix as "safe"}</span>}
    </>
  );

  if (href) {
    return (
      <a href={href} class={classes} id={id} aria-label={ariaLabel}>
        {inner}
      </a>
    );
  }

  return (
    <button
      type={type}
      class={classes}
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-live={ariaLive}
    >
      {inner}
    </button>
  );
}
