import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost" | "marker" | "danger";
type Size = "sm" | "md" | "lg";

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const cls = (variant: Variant = "secondary", size: Size = "md", extra?: string) =>
  ["btn", `btn--${variant}`, `btn--${size}`, extra].filter(Boolean).join(" ");

export const Button = forwardRef<HTMLButtonElement, Common & ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button({ variant, size, icon, iconRight, className, children, type = "button", ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={cls(variant, size, className)} {...rest}>
        {icon}
        {children !== undefined && children !== null && <span>{children}</span>}
        {iconRight}
      </button>
    );
  },
);

export function ButtonLink({ variant, size, icon, iconRight, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link className={cls(variant, size, className)} {...rest}>
      {icon}
      <span>{children}</span>
      {iconRight}
    </Link>
  );
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  { label: string; variant?: Variant; size?: Size } & ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ label, variant = "ghost", size = "md", className, children, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={["icon-btn", `btn--${variant}`, `icon-btn--${size}`, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
});
