"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-strong",
  ghost: "bg-transparent text-foreground hover:bg-panel-strong",
  // A clip-path would cut a border, so "outline" is a quiet filled slab.
  outline: "bg-panel-strong text-foreground hover:bg-border",
  danger: "bg-danger/10 text-danger hover:bg-danger/20",
};

type ButtonProps = HTMLMotionProps<"button"> & { variant?: Variant; slanted?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", slanted = true, className, type = "button", disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96, x: 1 }}
      transition={{ duration: 0.12 }}
      className={cn(
        "text-display inline-flex min-h-11 items-center justify-center gap-2 px-5 text-[15px] tracking-wider transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        slanted && "shape-slant px-6",
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
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center text-foreground transition-colors",
        "hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-40",
        active && "text-accent-strong",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
