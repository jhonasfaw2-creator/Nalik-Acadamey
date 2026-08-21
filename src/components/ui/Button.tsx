import { type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { HoverLift } from "@/components/motion/HoverLift";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-gold text-navy hover:bg-gold/90 focus-visible:outline-gold",
        secondary:
          "border border-navy/20 bg-white text-navy hover:bg-navy hover:text-white focus-visible:outline-navy",
        ghost:
          "text-navy hover:bg-navy/5 focus-visible:outline-navy",
        link:
          "text-navy underline underline-offset-4 hover:text-gold focus-visible:outline-gold",
      },
      size: {
        sm: "h-9 px-4 text-sm tracking-wide",
        md: "h-11 px-6 text-sm tracking-wide",
        lg: "h-13 px-8 text-base tracking-wide",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  lift?: boolean;
}

export function Button({
  className,
  variant,
  size,
  lift = false,
  ...props
}: ButtonProps) {
  return (
    <HoverLift className={cn(lift && "inline-flex")}>
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    </HoverLift>
  );
}
