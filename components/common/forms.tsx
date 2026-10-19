"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import type { FormState } from "@/lib/form";
import { toastFormState } from "@/components/toast";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  useEffect(() => {
    toastFormState(state);
  }, [state]);
  return <form action={formAction} className={className}>{children}</form>;
}

export function Submit({ children, variant = "" }: { children: React.ReactNode; variant?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn ${variant}`.trim()} disabled={pending} type="submit">
      {pending ? "Working…" : children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn ghost no-print" onClick={() => window.print()}>
      Print
    </button>
  );
}
