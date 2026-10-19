import Link from "next/link";
import { labelize } from "@/lib/format";

const TONES: Record<string, string> = {
  active: "ok",
  approved: "ok",
  paid: "ok",
  finalised: "ok",
  signed: "ok",
  resolved: "ok",
  completed: "ok",
  healthy: "ok",
  connected: "ok",
  done: "ok",
  submitted: "warn",
  partial: "warn",
  initiated: "warn",
  processing: "warn",
  in_progress: "warn",
  in_review: "warn",
  partially_paid: "warn",
  concern: "warn",
  dependency: "warn",
  review: "warn",
  planning: "warn",
  planned: "warn",
  pending: "warn",
  watch: "warn",
  high: "warn",
  urgent: "bad",
  blocked: "bad",
  open: "bad",
  blocker: "bad",
  rejected: "bad",
  failed: "bad",
  missed: "bad",
  at_risk: "bad",
  overdue: "bad",
  on_hold: "muted",
  void: "muted",
  draft: "muted",
  inactive: "muted",
  cancelled: "muted",
  disconnected: "muted",
  invited: "warn",
  unplanned: "muted",
  low: "muted",
  medium: "warn",
};

export function Badge({ value }: { value: string }) {
  return <span className={`badge ${TONES[value] ?? ""}`}>{labelize(value).replaceAll(".", " ")}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </header>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <b>{value}</b>
      {note ? <em>{note}</em> : null}
    </article>
  );
}

export function Meter({ value, tone }: { value: number; tone?: string }) {
  const paint = tone ?? (value >= 100 ? "bad" : value >= 80 ? "warn" : "");
  return (
    <div className={`meter ${paint}`} aria-hidden>
      <span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  );
}

export function Denied({ title }: { title: string }) {
  return (
    <section className="card">
      <PageHeader eyebrow="Restricted" title={title} lede="This area follows the permission matrix. A director can grant it to another role from Settings, including a future Finance or Client role, without changing the screens." />
      <Link href="/dashboard" className="btn ghost">
        Back to the desk
      </Link>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}
