"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return <Sonner className="toaster group" toastOptions={{ classNames: { toast: "group toast bg-popover text-popover-foreground border-border shadow-lg" } }} {...props} />;
}

export { Toaster };
