import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Subtle page enter motion — CSS only, no animation library. */
export function PageEnter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("page-enter", className)}>{children}</div>;
}
