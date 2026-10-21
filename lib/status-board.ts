import type { StatusUpdate } from "@/lib/types";

export function latestStatus(rows: StatusUpdate[]) {
  if (!rows.length) return { date: "", rows: [] as StatusUpdate[] };
  const date = rows.reduce((max, row) => (row.statusDate > max ? row.statusDate : max), rows[0].statusDate);
  return {
    date,
    rows: rows
      .filter((row) => row.statusDate === date)
      .sort((a, b) => a.sheetNo - b.sheetNo || a.project.localeCompare(b.project) || a.subItem.localeCompare(b.subItem)),
  };
}

export function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes("block")) return "bad";
  if (value.includes("hold") || value.includes("not started") || value.includes("to get") || value === "tbd") return "warn";
  if (value.includes("complete") || value.includes("closed")) return "ok";
  return "";
}
