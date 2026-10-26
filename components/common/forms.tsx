"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import type { FormState } from "@/lib/form";
import { toastFormState } from "@/components/toast";

export function ActionForm({
  action,
  children,
  className,
  onDone,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, {});
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    toastFormState(state);
    if (state.ok) done.current?.();
  }, [state]);
  return <form action={formAction} className={className}>{children}</form>;
}

export function Submit({ children, variant = "", disabled = false }: { children: React.ReactNode; variant?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn ${variant}`.trim()} disabled={pending || disabled} type="submit">
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
