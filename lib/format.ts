export function money(value: number, currency = "INR") {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function hoursLabel(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString("en-IN", { maximumFractionDigits: 1 })}h`;
}

export function prettyDate(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function prettyStamp(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return prettyDate(iso);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function labelize(value: string) {
  return value.replaceAll("_", " ");
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function nid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
