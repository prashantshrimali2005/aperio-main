import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-4 text-sm font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
  { variants: { variant: {
    primary: "bg-[var(--primary)] text-white shadow-[0_7px_18px_color-mix(in_srgb,var(--primary)_20%,transparent)] hover:bg-[var(--primary-strong)]",
    secondary: "border bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
    ghost: "text-[var(--muted-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
    destructive: "bg-[var(--critical)] text-white hover:opacity-90",
  }, size: { sm: "h-9 px-3 text-xs", md: "h-10 px-4", lg: "h-11 px-5" } }, defaultVariants: { variant: "primary", size: "md" } },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  // Slot requires a single child, so only decorate the plain <button> form.
  const content = !asChild && loading ? (
    <>
      <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
      {children}
    </>
  ) : children;
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? disabled : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </Comp>
  );
}
