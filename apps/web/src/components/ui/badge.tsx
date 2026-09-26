import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-foreground",
        primary: "border-lime-400/30 bg-lime-400/10 text-lime-300",
        info: "border-cyan-400/30 bg-cyan-400/10 text-info-foreground",
        warning: "border-amber-400/30 bg-amber-400/10 text-warning-foreground",
        destructive:
          "border-red-500/30 bg-red-500/10 text-destructive-foreground",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
