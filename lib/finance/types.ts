export type FinanceRoleSlug = "director" | "admin" | "employee" | "client";
export type FinanceTeam = "Finance" | "Legal";

export type FinanceUser = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  title: string;
  roleName: string;
  roleSlug: FinanceRoleSlug;
  status: "active" | "inactive";
  companyId?: string;
  /** Employee team for Finance / Legal allotment. */
  team?: FinanceTeam;
  /** Admin can grant funder-database access to an employee. */
  funderDbAccess?: boolean;
};

export type FinanceSessionUser = Omit<FinanceUser, "password">;

export type FinanceProject = {
  id: string;
  serial: string;
  project: string;
  bank: string;
  status: string;
  remarks: string;
  concernedPerson: string;
  caseHead: string;
  company: string;
};

export type CaseCategory = "Debt" | "Equity" | "Insolvency";

export type CaseType =
  | "Term Loan"
  | "CC"
  | "Takeover"
  | "Structured Finance"
  | "Private Equity"
  | "Strategic Equity"
  | "SME IPO"
  | "Main Board IPO"
  | "Not defined yet"
  /** Legacy values kept readable after migration */
  | "CC Limit"
  | "Buyback Funding"
  | "Special Situation"
  | "Acquisition Finance";

export type CaseStatus = "draft" | "intake" | "review" | "ready" | "circulated";
export type MandateStatus = "not_started" | "in_progress" | "done";
export type FinanceTaskKind = "case_work" | "mandate" | "nda";
export type FinanceTaskStatus = "open" | "done";

export type FinancePerson = {
  id: string;
  name: string;
  role: string;
  profile: string;
  shareholdingPct: string;
};

export type FinanceFinancialYear = {
  id: string;
  label: string;
  revenue: string;
  ebitda: string;
  pat: string;
  netWorth: string;
  debt: string;
  notes: string;
};

export type FinanceFacility = {
  id: string;
  lender: string;
  facilityType: string;
  limit: string;
  outstanding: string;
  interestRate: string;
  security: string;
  personalGuarantor: string;
};

/** Access-matrix Capacity grid: one row per product. */
export type FinanceCapacityRow = {
  id: string;
  product: string;
  capacity: string;
  unit: string;
};

export type FinanceCompany = {
  id: string;
  name: string;
  constitution: string;
  cin: string;
  pan: string;
  incorporationYear: string;
  locations: string;
  businessDescription: string;
  /** Legacy free-text summary; kept in sync from capacityRows. */
  capacities: string;
  /** Legacy free-text summary; kept in sync from capacityRows. */
  products: string;
  capacityRows: FinanceCapacityRow[];
  keyClients: string;
  people: FinancePerson[];
  financialYears: FinanceFinancialYear[];
  facilities: FinanceFacility[];
};

export type FinanceCase = {
  id: string;
  companyId: string;
  caseCategory: CaseCategory;
  caseType: CaseType;
  requirementText: string;
  amountSought: string;
  status: CaseStatus;
  assignedAdminId: string;
  /** Finance employees allotted to this case. */
  allottedEmployeeIds: string[];
  /** Legal employee assigned for mandate / NDA when needed. */
  legalAssigneeId: string;
  clientUserId: string;
  clientLinkToken: string;
  mandateStatus: MandateStatus;
  mandateSignedOn: string;
  mandateNote: string;
  ndaStatus: MandateStatus;
  ndaSignedOn: string;
  ndaNote: string;
  clientQuestions: string;
  documentNotes: string;
  fields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  createdById: string;
};

export type FinanceTask = {
  id: string;
  caseId: string;
  employeeId: string;
  kind: FinanceTaskKind;
  title: string;
  status: FinanceTaskStatus;
  createdAt: string;
  updatedAt: string;
  createdById: string;
};

export type FinanceStore = {
  users: FinanceUser[];
  projects: FinanceProject[];
  sheetTitle: string;
  companies: FinanceCompany[];
  cases: FinanceCase[];
  tasks: FinanceTask[];
};
