"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { ConceptStatus } from "@/lib/types";

export function Action({
  icon,
  label,
  busy,
  disabled,
  tone = "violet",
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  tone?: "violet" | "emerald" | "rose" | "ghost";
  onClick: () => void;
}) {
  const colors =
    tone === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : tone === "rose"
        ? "border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
        : tone === "ghost"
          ? "border border-white/15 text-zinc-300 hover:bg-white/5"
          : "bg-violet-600 text-white hover:bg-violet-500";

  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-40 ${colors}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

export function Collapsible({
  icon,
  title,
  hint,
  defaultOpen,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-start gap-3 p-5">
        <button
          onClick={() => setOpen((value) => !value)}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-zinc-500/20 text-zinc-300">
            {icon}
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-zinc-50">{title}</span>
            <span className="mt-1 block text-sm text-zinc-400">{hint}</span>
          </span>
          <ChevronDown
            className={`mt-1 size-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
        {right}
      </div>
      {open && <div className="border-t border-white/5 p-5">{children}</div>}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-600">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60";

const STATUS_LABELS: Record<ConceptStatus, { label: string; className: string }> = {
  concept_pending: { label: "Konsept onayı bekliyor", className: "text-amber-300 bg-amber-500/10" },
  concept_approved: { label: "Konsept onaylandı", className: "text-violet-200 bg-violet-500/15" },
  concept_rejected: { label: "Reddedildi", className: "text-zinc-400 bg-white/5" },
  images_pending: { label: "Görsel onayı bekliyor", className: "text-amber-300 bg-amber-500/10" },
  images_approved: { label: "Görseller onaylandı", className: "text-sky-200 bg-sky-500/15" },
  exported: { label: "Export edildi", className: "text-emerald-200 bg-emerald-500/15" },
  pinterest_posted: { label: "Pinterest'te", className: "text-rose-200 bg-rose-500/15" },
};

export function StatusPill({ status }: { status: ConceptStatus }) {
  const entry = STATUS_LABELS[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${entry.className}`}>
      {entry.label}
    </span>
  );
}

export function statusLabel(status: ConceptStatus) {
  return STATUS_LABELS[status].label;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      {message}
    </p>
  );
}
