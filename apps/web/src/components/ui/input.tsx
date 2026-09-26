import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { FOCUS_RING } from "./variants";

export const FIELD_CLASSES = `w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-navy-400 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-500 ${FOCUS_RING}`;

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(FIELD_CLASSES, "h-10", className)}
      {...props}
    />
  );
}
