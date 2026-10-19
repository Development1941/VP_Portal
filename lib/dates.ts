export function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIso(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function startOfWeek(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return isoDate(copy);
}

export function todayIso() {
  return isoDate(new Date());
}

export function monthKey(iso = todayIso()) {
  return iso.slice(0, 7);
}

export function inRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}

export function stamp() {
  return new Date().toISOString();
}
