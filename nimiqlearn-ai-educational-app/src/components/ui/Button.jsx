import React from "react";

const VARIANTS = {
  primary: "btn btn-primary",
  teal: "btn btn-teal",
  nimiq: "btn btn-nimiq",
  outline: "btn btn-outline",
  ghost: "btn btn-ghost",
  danger: "btn btn-danger",
};

export default function Button({
  variant = "primary",
  size,
  loading = false,
  block = false,
  children,
  className = "",
  disabled,
  ...rest
}) {
  const classes = [
    VARIANTS[variant] || VARIANTS.primary,
    size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "",
    block ? "btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
