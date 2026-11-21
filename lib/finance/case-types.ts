import type { CaseCategory, CaseStatus, CaseType, MandateStatus } from "@/lib/finance/types";

export const CASE_CATEGORIES: CaseCategory[] = ["Debt", "Equity", "Insolvency"];

export const CASE_TYPES_BY_CATEGORY: Record<CaseCategory, CaseType[]> = {
  Debt: ["Term Loan", "CC", "Takeover", "Structured Finance"],
  Equity: ["Private Equity", "Strategic Equity", "SME IPO", "Main Board IPO"],
  Insolvency: ["Not defined yet"],
};

export const CASE_TYPES: CaseType[] = CASE_CATEGORIES.flatMap((category) => CASE_TYPES_BY_CATEGORY[category]);

export const CASE_STATUSES: { value: CaseStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "intake", label: "Intake" },
  { value: "review", label: "Review" },
  { value: "ready", label: "Ready for circulation" },
  { value: "circulated", label: "Circulated" },
];

export const MANDATE_STATUSES: { value: MandateStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export const CONSTITUTIONS = ["Private Limited", "Public Limited", "LLP", "Partnership", "Sole Proprietorship", "Other"] as const;

export const PERSON_ROLES = ["Promoter", "CEO", "Director", "CFO", "Company Secretary", "Other"] as const;

/** Debt · Term Loan extras from the Client Onboarding blueprint. */
export const TERM_LOAN_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "projectReportStatus", label: "Project report status" },
  { key: "landArea", label: "Land area" },
  { key: "landValuation", label: "Land valuation" },
  { key: "buildingType", label: "Building type" },
  { key: "buildingSqFt", label: "Building square feet" },
  { key: "architectEstimate", label: "Architect estimate" },
  { key: "plantMachinery", label: "Plant and machinery quotations / list" },
  { key: "projections", label: "Projections", hint: "Products, capacities, selling price, raw materials, costs, expenses" },
  { key: "projectCost", label: "Project cost" },
  { key: "promoterContribution", label: "Promoter contribution" },
  { key: "loanAsk", label: "Loan ask" },
  { key: "tenure", label: "Tenure" },
  { key: "moratorium", label: "Moratorium" },
];

export function typesForCategory(category: string): CaseType[] {
  if (category === "Debt" || category === "Equity" || category === "Insolvency") {
    return CASE_TYPES_BY_CATEGORY[category];
  }
  return [];
}

export function isCaseCategory(value: string): value is CaseCategory {
  return (CASE_CATEGORIES as string[]).includes(value);
}

export function isCaseType(value: string): value is CaseType {
  return (CASE_TYPES as string[]).includes(value) || ["CC Limit", "Buyback Funding", "Special Situation", "Acquisition Finance"].includes(value);
}

export function isCaseStatus(value: string): value is CaseStatus {
  return CASE_STATUSES.some((item) => item.value === value);
}

export function isMandateStatus(value: string): value is MandateStatus {
  return MANDATE_STATUSES.some((item) => item.value === value);
}

export function normalizeLegacyCaseType(value: string): CaseType {
  if (value === "CC Limit") return "CC";
  if (value === "Special Situation") return "Structured Finance";
  if (value === "Buyback Funding" || value === "Acquisition Finance") return "Structured Finance";
  return isCaseType(value) ? value : "Term Loan";
}

export function inferCategory(caseType: string): CaseCategory {
  const normalized = normalizeLegacyCaseType(caseType);
  if (CASE_TYPES_BY_CATEGORY.Equity.includes(normalized)) return "Equity";
  if (CASE_TYPES_BY_CATEGORY.Insolvency.includes(normalized)) return "Insolvency";
  return "Debt";
}
