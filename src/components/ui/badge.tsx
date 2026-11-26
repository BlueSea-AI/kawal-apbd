import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        hijau:
          "bg-[var(--rapor-hijau-bg)] text-[var(--rapor-hijau)] border-[var(--rapor-hijau-border)]",
        kuning:
          "bg-[var(--rapor-kuning-bg)] text-[var(--rapor-kuning)] border-[var(--rapor-kuning-border)]",
        merah:
          "bg-[var(--rapor-merah-bg)] text-[var(--rapor-merah)] border-[var(--rapor-merah-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
