import type { SowRecord } from "@/lib/types";

export function sowCompany(project: string) {
  const name = project.toLowerCase();
  if (name.includes("art information") || name.includes("finsoft") || name.includes("vp portal") || name.includes("ipo") || name.includes("finace") || name.includes("finance")) return "EMbee";
  return "Assure";
}

export function sowNeedsAttention(row: SowRecord) {
  if (row.kind !== "status") return false;
  if (row.changeRequest.trim()) return true;
  return row.signature.trim().toLowerCase() !== "signed";
}

export function sowAttentionNote(row: SowRecord) {
  if (row.changeRequest.trim()) return row.sprint ? `${row.sprint} · addendum needed` : "Addendum needed";
  return row.sprint ? `${row.sprint} · SOW not signed` : "SOW not signed";
}

export function presentSow(row: SowRecord): SowRecord {
  const project = (row.project || "").trim();
  return {
    id: row.id,
    kind: row.kind === "bid" ? "bid" : "status",
    sheetNo: row.sheetNo || 0,
    project,
    sprint: (row.sprint || "").trim(),
    link: (row.link || "").trim(),
    signature: (row.signature || "").trim(),
    signedOn: (row.signedOn || "").trim(),
    changeRequest: row.changeRequest || "",
    company: (row.company || "").trim() || sowCompany(project),
  };
}
