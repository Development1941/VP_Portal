"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormState } from "@/lib/form";
import type { Notification } from "@/lib/types";

type Toast = {
  id: number;
  tone: "ok" | "bad";
  title: string;
  body?: string;
  href?: string;
};

type ToastStore = {
  listeners: Set<(items: Toast[]) => void>;
  queue: Toast[];
  nextId: number;
  lastKey: string;
  lastAt: number;
};

function store(): ToastStore {
  const host = window as Window & { __vpToasts?: ToastStore };
  if (!host.__vpToasts) {
    host.__vpToasts = { listeners: new Set(), queue: [], nextId: 1, lastKey: "", lastAt: 0 };
  }
  return host.__vpToasts;
}

function publish() {
  const current = store();
  const snapshot = current.queue;
  current.listeners.forEach((listener) => listener(snapshot));
}

function dismiss(id: number) {
  const current = store();
  current.queue = current.queue.filter((item) => item.id !== id);
  publish();
}

export function pushToast(input: { tone?: "ok" | "bad"; title: string; body?: string; href?: string }) {
  const title = input.title.trim();
  if (!title) return;
  const current = store();
  const key = `${input.tone ?? "ok"}:${title}:${input.body ?? ""}`;
  const now = Date.now();
  if (key === current.lastKey && now - current.lastAt < 700) return;
  current.lastKey = key;
  current.lastAt = now;
  const toast: Toast = { id: current.nextId++, tone: input.tone ?? "ok", title, body: input.body?.trim(), href: input.href };
  current.queue = [...current.queue, toast].slice(-5);
  publish();
  window.setTimeout(() => dismiss(toast.id), 4200);
}

export function toastFormState(state: FormState) {
  if (state.error) pushToast({ tone: "bad", title: state.error });
  else if (state.ok) pushToast({ tone: "ok", title: state.ok });
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const current = store();
    setItems(current.queue);
    const onToast = (next: Toast[]) => setItems(next);
    current.listeners.add(onToast);
    return () => {
      current.listeners.delete(onToast);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div className="toaster" aria-live="polite">
      {items.map((item) => (
        <article key={item.id} className={`toast ${item.tone}`}>
          <div>
            <strong>{item.title}</strong>
            {item.body ? <p>{item.body}</p> : null}
            {item.href ? <Link href={item.href}>Open</Link> : null}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(item.id)}>
            ×
          </button>
        </article>
      ))}
    </div>
  );
}

export function NoticeToasts({ notes }: { notes: Notification[] }) {
  useEffect(() => {
    const key = "vp-toasted-notes";
    let seen = new Set<string>();
    try {
      seen = new Set(JSON.parse(sessionStorage.getItem(key) || "[]") as string[]);
    } catch {
      seen = new Set();
    }
    const fresh = notes.filter((note) => !note.read && !seen.has(note.id));
    fresh.slice(0, 4).forEach((note) => pushToast({ title: note.title, body: note.body, href: note.href }));
    if (fresh.length > 4) pushToast({ title: `${fresh.length - 4} more notifications`, href: "/notifications" });
    if (!fresh.length) return;
    fresh.forEach((note) => seen.add(note.id));
    sessionStorage.setItem(key, JSON.stringify([...seen].slice(-80)));
  }, [notes]);
  return null;
}
