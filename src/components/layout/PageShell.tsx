import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("min-h-screen bg-neutral-50", className)}>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}
