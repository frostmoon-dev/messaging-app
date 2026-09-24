"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Hover changes colour, never opacity: faded buttons read as disabled.
const VARIANTS: Record<Variant, string> = {
  primary: "pill bg-accent px-5 font-bold text-accent-foreground shadow-[var(--shadow-raised)] hover:bg-accent-hover",
  secondary: "pill bg-panel-strong px-5 text-foreground hover:bg-border",
  ghost: "pill bg-transparent text-foreground hover:bg-panel-strong",
  danger: "pill bg-transparent text-danger hover:bg-panel-strong",
};

type ButtonProps = HTMLMotionProps<"button"> & { variant?: Variant };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, type = "button", disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 px-4 text-body font-semibold whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:bg-panel-strong disabled:text-muted disabled:shadow-none",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});

type IconButtonProps = HTMLMotionProps<"button"> & { label: string; active?: boolean };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, type = "button", disabled, active, children, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-strong transition-colors",
        "hover:bg-panel-strong hover:text-foreground disabled:cursor-not-allowed disabled:text-muted",
        active && "text-accent-text",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
