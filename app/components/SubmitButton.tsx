// app/components/SubmitButton.tsx
"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? "Gönderiliyor…" : children}
    </button>
  );
}
