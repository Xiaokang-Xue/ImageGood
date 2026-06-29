"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "dark";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-neutral-950 bg-neutral-950 text-white shadow-sm hover:border-neutral-800 hover:bg-neutral-800 active:scale-[0.98]",
  secondary: "border border-neutral-200 bg-white text-neutral-950 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.98]",
  outline: "border border-neutral-200 bg-transparent text-neutral-900 hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.98]",
  ghost: "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 active:scale-[0.98]",
  dark: "border border-neutral-950 bg-neutral-950 text-white shadow-sm hover:bg-neutral-800 active:scale-[0.98]"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-10 w-10 p-0"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition duration-200",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
);

Button.displayName = "Button";
