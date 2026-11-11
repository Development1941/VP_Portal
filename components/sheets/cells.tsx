export function sowLink(value: string) {
  if (!value) return "—";
  if (/^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    );
  }
  return value;
}

export function hourlyStatus(status: string) {
  if (!status) return "—";
  return /\bblock/i.test(status) ? <span className="badge bad">{status}</span> : status;
}

export function sheetHours(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}
