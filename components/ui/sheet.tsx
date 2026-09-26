"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export function SheetContent({ children, className, title = "Details" }: { children: React.ReactNode; className?: string; title?: string }) {
  return <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=closed]:animate-out" />
    <Dialog.Content className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] w-full overflow-y-auto rounded-t-[20px] border-t bg-[var(--surface)] p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:max-w-[520px] sm:rounded-none sm:border-l sm:border-t-0 sm:p-8", className)}>
      <Dialog.Title className="sr-only">{title}</Dialog.Title>
      <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--border-strong)] sm:hidden" aria-hidden="true" />
      <Dialog.Close className="absolute right-5 top-5 grid size-9 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface-muted)]" aria-label="Close panel"><X size={18} /></Dialog.Close>
      {children}
    </Dialog.Content>
  </Dialog.Portal>;
}
