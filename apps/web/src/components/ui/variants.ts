import { cva } from "class-variance-authority";

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS_RING}`,
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-lime-300",
        destructive: "bg-red-600 text-white hover:bg-red-500",
        outline:
          "border border-input bg-secondary text-secondary-foreground hover:bg-navy-700",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "text-muted-foreground underline-offset-4 hover:text-primary hover:underline",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-8 px-3 text-xs",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
