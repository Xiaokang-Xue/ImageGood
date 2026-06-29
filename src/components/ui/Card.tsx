import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-300 bg-white shadow-card transition duration-200",
        className
      )}
      {...props}
    />
  );
}
