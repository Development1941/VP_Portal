import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarClock,
  ChartColumn,
  FileText,
  FolderKanban,
  Gauge,
  HeartPulse,
  History,
  Inbox,
  LayoutDashboard,
  ListTodo,
  PieChart,
  Receipt,
  ScrollText,
  Settings,
  SquareKanban,
  TriangleAlert,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
  not_started: "warn",
  addendum: "warn",
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

const PAGE_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  "My work": SquareKanban,
  "Project board": SquareKanban,
  "Daily status report": CalendarClock,
  "Daily status reports": CalendarClock,
  "Project intake": Inbox,
  "Statements of work": ScrollText,
  "SOW finalisation": ScrollText,
  "Resource allocation": UsersRound,
  Tasks: ListTodo,
  Utilization: Gauge,
  "Utilization and billing": Gauge,
  Escalations: TriangleAlert,
  Projects: FolderKanban,
  "Project health": HeartPulse,
  Clients: Building2,
  Billing: Receipt,
  Invoices: FileText,
  Payments: Wallet,
  Profitability: PieChart,
  "Project progress": ChartColumn,
  Team: Users,
  "Audit log": History,
  Settings: Settings,
  Profile: UserRound,
  Notifications: Bell,
};

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
  const Icon = PAGE_ICONS[title];
  return (
    <header className="page-head">
      <div className="page-title">
        {Icon ? (
          <span className="page-mark">
            <Icon strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </header>
  );
}

export function Stat({ label, value, note, detail, href }: { label: string; value: string; note?: string; detail?: string; href?: string }) {
  const explanation = detail || note;
  const face = (
    <>
      <span className="stat-face">
        <span>{label}</span>
        <b>{value}</b>
      </span>
      {explanation ? (
        <span className="stat-face stat-back">
          <em>{explanation}</em>
        </span>
      ) : null}
    </>
  );
  if (!explanation || !detail) {
    const plain = (
      <>
        <span>{label}</span>
        <b>{value}</b>
        {note ? <em>{note}</em> : null}
      </>
    );
    if (href) return <Link href={href} className="stat">{plain}</Link>;
    return <article className="stat">{plain}</article>;
  }
  const body = <span className="stat-flip-inner">{face}</span>;
  const labelText = `${label}, ${value}. ${explanation}`;
  if (href?.startsWith("#")) return <a href={href} className="stat stat-flip" aria-label={labelText}>{body}</a>;
  if (href) return <Link href={href} className="stat stat-flip" aria-label={labelText}>{body}</Link>;
  return <article className="stat stat-flip" aria-label={labelText}>{body}</article>;
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
      <PageHeader eyebrow="Access" title={title} lede="You do not have permission to view this page." />
      <Link href="/dashboard" className="btn ghost">
        Back to dashboard
      </Link>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}
