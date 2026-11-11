import Link from "next/link";
import { History } from "lucide-react";
import { prettyDate } from "@/lib/format";

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function ArchiveControl({ path, dates, selected }: { path: string; dates: string[]; selected?: string }) {
  const months = new Map<string, string[]>();
  for (const date of dates) {
    const list = months.get(date.slice(0, 7)) ?? [];
    list.push(date);
    months.set(date.slice(0, 7), list);
  }
  return (
    <div className="sheet-actions">
      {selected ? (
        <Link className="btn ghost" href={path}>
          Back to latest
        </Link>
      ) : null}
      <details className="archive-menu">
        <summary className="btn ghost">
          <History strokeWidth={1.75} aria-hidden size={16} /> Archive
        </summary>
        <div className="archive-panel">
          <form method="get" action={path} className="archive-pick">
            <label className="field">
              <span>Any day</span>
              <input type="date" name="date" required defaultValue={selected} max={new Date().toISOString().slice(0, 10)} />
            </label>
            <button type="submit" className="btn">View</button>
          </form>
          {months.size ? (
            <div className="archive-months">
              {[...months.entries()].map(([month, days]) => (
                <div key={month}>
                  <p className="archive-month">{monthLabel(month)}</p>
                  <div className="archive-days">
                    {days.map((day) => (
                      <Link key={day} href={`${path}?date=${day}`} className={day === selected ? "on" : ""} title={prettyDate(day)}>
                        {Number(day.slice(8, 10))}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No status sheets have been recorded yet.</p>
          )}
        </div>
      </details>
    </div>
  );
}

export function ArchiveNotice({ selected, shown }: { selected: string; shown: string }) {
  return (
    <section className="card archive-notice">
      <strong>Archive view · {prettyDate(selected)}</strong>
      <span className="muted">
        {shown && shown !== selected
          ? ` No status sheet was filed that day, so the last sheet before it (${prettyDate(shown)}) is shown.`
          : shown
            ? " Read-only snapshot of that day."
            : " Nothing had been recorded by that day."}
      </span>
    </section>
  );
}
