import {
  canAllotCases,
  canCreateCase,
  canEditCaseData,
  canEditMandate,
  canUploadFinanceSheet,
  canViewCase,
  canViewEmployeeDatabase,
  isFinanceAdmin,
  isFinanceClient,
} from "@/lib/finance/access";
import {
  inferCategory,
  isCaseCategory,
  isCaseStatus,
  isCaseType,
  isMandateStatus,
  normalizeLegacyCaseType,
  TERM_LOAN_FIELDS,
} from "@/lib/finance/case-types";
import { capacityRowsFromLegacy, normalizeCapacityRows, summarizeCapacityRows } from "@/lib/finance/capacity";
import { buildFinanceSeed } from "@/lib/finance/seed";
import type {
  CaseCategory,
  FinanceCapacityRow,
  FinanceCase,
  FinanceCompany,
  FinanceFacility,
  FinanceFinancialYear,
  FinanceProject,
  FinanceSessionUser,
  FinanceStore,
  FinanceTask,
  MandateStatus,
} from "@/lib/finance/types";
import { PortalError } from "@/lib/form";
import { localDataFile, readLocalJson, writeLocalJson } from "@/lib/local-data";

const filePath = localDataFile("finance-store.json");
let memoryStore: FinanceStore | null = null;

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function write(store: FinanceStore) {
  memoryStore = store;
  writeLocalJson(filePath, store);
}

function migrateUser(user: FinanceStore["users"][number]) {
  if ((user.roleSlug as string) === "manager") {
    user.roleSlug = "employee";
    user.roleName = "Employee";
    user.title = user.title || "Finance employee";
    user.team = user.team || "Finance";
    return true;
  }
  return false;
}

function migrateCase(item: FinanceCase, seedCases: FinanceCase[]) {
  let dirty = false;
  const seedCase = seedCases.find((row) => row.id === item.id);
  if (!item.caseCategory) {
    item.caseCategory = seedCase?.caseCategory || inferCategory(item.caseType);
    dirty = true;
  }
  const normalized = normalizeLegacyCaseType(String(item.caseType || seedCase?.caseType || "Term Loan"));
  if (item.caseType !== normalized) {
    item.caseType = normalized;
    dirty = true;
  }
  if (!item.allottedEmployeeIds) {
    item.allottedEmployeeIds = seedCase ? [...seedCase.allottedEmployeeIds] : [];
    dirty = true;
  } else if (!item.allottedEmployeeIds.length && seedCase?.allottedEmployeeIds.length) {
    item.allottedEmployeeIds = [...seedCase.allottedEmployeeIds];
    dirty = true;
  }
  if (item.legalAssigneeId == null) {
    item.legalAssigneeId = seedCase?.legalAssigneeId || "";
    dirty = true;
  } else if (!item.legalAssigneeId && seedCase?.legalAssigneeId) {
    item.legalAssigneeId = seedCase.legalAssigneeId;
    dirty = true;
  }
  if (item.documentNotes == null) {
    item.documentNotes = seedCase?.documentNotes || "";
    dirty = true;
  }
  if (seedCase && item.id === seedCase.id) {
    if (seedCase.caseCategory && item.caseCategory !== seedCase.caseCategory && (!item.caseCategory || item.caseType !== seedCase.caseType)) {
      // Keep manually edited types; only backfill when still on legacy-normalized placeholders for known seed rows.
      if (["Structured Finance", "CC", "Term Loan", "Special Situation", "CC Limit"].includes(String(item.caseType)) && seedCase.caseType !== item.caseType && item.id === "fin_case_lifeline") {
        item.caseCategory = seedCase.caseCategory;
        item.caseType = seedCase.caseType;
        dirty = true;
      }
    }
  }
  item.fields = item.fields ?? {};
  return dirty;
}

function hydrate(store: FinanceStore): { store: FinanceStore; dirty: boolean } {
  const seed = buildFinanceSeed();
  let dirty = false;
  if (!store.users?.length) {
    store.users = seed.users;
    dirty = true;
  } else {
    for (const user of seed.users) {
      const existing = store.users.find((item) => item.email.toLowerCase() === user.email.toLowerCase());
      if (!existing) {
        store.users.push({ ...user });
        dirty = true;
      } else if (migrateUser(existing)) {
        dirty = true;
      }
    }
    for (const user of store.users) {
      if (migrateUser(user)) dirty = true;
    }
  }
  if (!store.projects?.length) {
    store.projects = seed.projects;
    dirty = true;
  }
  if (!store.sheetTitle) {
    store.sheetTitle = seed.sheetTitle;
    dirty = true;
  }
  if (!store.companies?.length) {
    store.companies = seed.companies;
    dirty = true;
  }
  if (!store.cases?.length) {
    store.cases = seed.cases;
    dirty = true;
  }
  if (!store.tasks?.length) {
    store.tasks = seed.tasks;
    dirty = true;
  }
  store.companies = (store.companies ?? []).map((company) => {
    const next = {
      ...company,
      people: company.people ?? [],
      financialYears: company.financialYears ?? [],
      facilities: company.facilities ?? [],
      capacityRows: company.capacityRows,
    };
    if (!next.capacityRows?.length) {
      next.capacityRows = capacityRowsFromLegacy(next.products || "", next.capacities || "");
      const summary = summarizeCapacityRows(next.capacityRows);
      if (!next.products) next.products = summary.products;
      if (!next.capacities) next.capacities = summary.capacities;
      dirty = true;
    } else {
      next.capacityRows = normalizeCapacityRows(next.capacityRows);
    }
    return next;
  });
  store.cases = (store.cases ?? []).map((item) => {
    if (migrateCase(item, seed.cases)) dirty = true;
    return item;
  });
  store.tasks = store.tasks ?? [];
  return { store, dirty };
}

function read(): FinanceStore {
  if (memoryStore) return memoryStore;

  const parsed = readLocalJson<FinanceStore>(filePath);
  if (!parsed?.users?.length) {
    const seed = buildFinanceSeed();
    write(seed);
    return seed;
  }

  try {
    const { store, dirty } = hydrate(parsed);
    if (dirty) write(store);
    else memoryStore = store;
    return store;
  } catch {
    const seed = buildFinanceSeed();
    write(seed);
    return seed;
  }
}

function toSession(user: FinanceStore["users"][number]): FinanceSessionUser {
  const { password: _password, ...session } = user;
  return session;
}

function emptyTermLoanFields() {
  return Object.fromEntries(TERM_LOAN_FIELDS.map((field) => [field.key, ""]));
}

export function financeAuthenticate(email: string, password: string): FinanceSessionUser | null {
  const store = read();
  const normalized = email.trim().toLowerCase();
  const user = store.users.find((item) => item.email.toLowerCase() === normalized && item.password === password && item.status === "active");
  return user ? toSession(user) : null;
}

export function financeSessionById(id: string): FinanceSessionUser | null {
  const user = read().users.find((item) => item.id === id && item.status === "active");
  return user ? toSession(user) : null;
}

export function loadFinanceWorkspace(user?: FinanceSessionUser) {
  const store = read();
  const cases = user ? store.cases.filter((item) => canViewCase(user, item)) : store.cases;
  return {
    sheetTitle: store.sheetTitle,
    projects: store.projects,
    users: store.users.map(toSession),
    companies: store.companies,
    cases,
    tasks: store.tasks,
  };
}

export function replaceFinanceProjects(user: FinanceSessionUser, projects: FinanceProject[], sheetTitle: string) {
  if (!canUploadFinanceSheet(user)) {
    throw new PortalError("Only Admin and Finance employees can upload finance sheets.");
  }
  const store = read();
  store.projects = projects;
  store.sheetTitle = sheetTitle || store.sheetTitle;
  write(store);
  return projects.length;
}

export function getFinanceCase(user: FinanceSessionUser, caseId: string) {
  const store = read();
  const financeCase = store.cases.find((item) => item.id === caseId);
  if (!financeCase || !canViewCase(user, financeCase)) throw new PortalError("That case was not found.");
  const company = store.companies.find((item) => item.id === financeCase.companyId);
  if (!company) throw new PortalError("The company for this case is missing.");
  return {
    financeCase,
    company,
    users: store.users.map(toSession),
    tasks: store.tasks.filter((task) => task.caseId === caseId),
  };
}

export function clientCaseFor(user: FinanceSessionUser) {
  if (!isFinanceClient(user)) return null;
  const store = read();
  const financeCase = store.cases.find((item) => item.clientUserId === user.id);
  if (!financeCase) return null;
  const company = store.companies.find((item) => item.id === financeCase.companyId);
  return company ? { financeCase, company } : null;
}

export function employeeDirectory(user: FinanceSessionUser) {
  if (!canViewEmployeeDatabase(user)) throw new PortalError("Only Admin can open the employee database.");
  const store = read();
  const employees = store.users.filter((item) => item.roleSlug === "employee" && item.status === "active").map(toSession);
  return {
    employees,
    companies: store.companies,
    cases: store.cases,
    tasks: store.tasks,
    users: store.users.map(toSession),
  };
}

export type IntakeInput = {
  companyName: string;
  constitution: string;
  cin: string;
  pan: string;
  incorporationYear: string;
  locations: string;
  businessDescription: string;
  capacities: string;
  products: string;
  capacityRows: FinanceCapacityRow[];
  keyClients: string;
  caseCategory: string;
  caseType: string;
  requirementText: string;
  amountSought: string;
  assignedAdminId: string;
  allottedEmployeeIds: string[];
  legalAssigneeId: string;
  clientName: string;
  clientEmail: string;
  promoterName: string;
  clientQuestions: string;
  documentNotes: string;
  fields: Record<string, string>;
  financialYears: Array<Pick<FinanceFinancialYear, "label" | "revenue" | "ebitda" | "pat" | "netWorth" | "debt" | "notes">>;
  facilities: Array<Pick<FinanceFacility, "lender" | "facilityType" | "limit" | "outstanding" | "interestRate" | "security" | "personalGuarantor">>;
};

export function createFinanceIntake(user: FinanceSessionUser, input: IntakeInput) {
  if (!canCreateCase(user)) throw new PortalError("Only Admin can add clients and create a new case.");
  if (!input.companyName.trim()) throw new PortalError("Client / company name is required.");
  if (!isCaseCategory(input.caseCategory)) throw new PortalError("Choose Debt, Equity, or Insolvency.");
  if (!isCaseType(input.caseType)) throw new PortalError("Choose a valid case type.");
  if (!input.requirementText.trim()) throw new PortalError("Requirement text is required.");

  const store = read();
  const now = new Date().toISOString();
  const matched = store.companies.find((item) => item.name.trim().toLowerCase() === input.companyName.trim().toLowerCase());
  const companyId = matched?.id || nid("fin_co");
  const caseId = nid("fin_case");
  let clientUserId = "";

  if (input.clientEmail.trim()) {
    const email = input.clientEmail.trim().toLowerCase();
    let client = store.users.find((item) => item.email.toLowerCase() === email);
    if (!client) {
      client = {
        id: nid("fin_usr"),
        fullName: input.clientName.trim() || input.promoterName.trim() || "Client",
        email,
        password: "demo123",
        title: "Promoter",
        roleName: "Client",
        roleSlug: "client",
        status: "active",
        companyId,
      };
      store.users.push(client);
    } else {
      client.companyId = companyId;
      if (input.clientName.trim()) client.fullName = input.clientName.trim();
    }
    clientUserId = client.id;
  }

  const financialYears =
    input.financialYears.length > 0
      ? input.financialYears.map((year) => ({ id: nid("fin_fy"), ...year }))
      : [
          { id: nid("fin_fy"), label: "FY24", revenue: "", ebitda: "", pat: "", netWorth: "", debt: "", notes: "" },
          { id: nid("fin_fy"), label: "FY25", revenue: "", ebitda: "", pat: "", netWorth: "", debt: "", notes: "" },
          { id: nid("fin_fy"), label: "FY26", revenue: "", ebitda: "", pat: "", netWorth: "", debt: "", notes: "" },
        ];

  const facilities = input.facilities
    .filter((item) => item.lender.trim() || item.facilityType.trim())
    .map((item) => ({ id: nid("fin_fac"), ...item }));

  const capacityRows = normalizeCapacityRows(input.capacityRows).map((row) => ({
    ...row,
    id: row.id.startsWith("cap_") ? row.id : nid("fin_cap"),
  }));
  const capacitySummary = summarizeCapacityRows(capacityRows);

  if (matched) {
    matched.constitution = input.constitution.trim() || matched.constitution;
    matched.cin = input.cin.trim() || matched.cin;
    matched.pan = input.pan.trim() || matched.pan;
    matched.incorporationYear = input.incorporationYear.trim() || matched.incorporationYear;
    matched.locations = input.locations.trim() || matched.locations;
    matched.businessDescription = input.businessDescription.trim() || matched.businessDescription;
    matched.capacityRows = capacityRows;
    matched.capacities = capacitySummary.capacities || input.capacities.trim() || matched.capacities;
    matched.products = capacitySummary.products || input.products.trim() || matched.products;
    matched.keyClients = input.keyClients.trim() || matched.keyClients;
    if (input.promoterName.trim() && !matched.people.some((person) => person.name === input.promoterName.trim())) {
      matched.people.push({ id: nid("fin_p"), name: input.promoterName.trim(), role: "Promoter", profile: "", shareholdingPct: "" });
    }
    if (input.financialYears.some((year) => year.revenue || year.ebitda || year.pat || year.netWorth || year.debt)) {
      matched.financialYears = financialYears;
    }
    if (facilities.length) matched.facilities = [...matched.facilities, ...facilities];
  } else {
    const company: FinanceCompany = {
      id: companyId,
      name: input.companyName.trim(),
      constitution: input.constitution.trim(),
      cin: input.cin.trim(),
      pan: input.pan.trim(),
      incorporationYear: input.incorporationYear.trim(),
      locations: input.locations.trim(),
      businessDescription: input.businessDescription.trim(),
      capacities: capacitySummary.capacities || input.capacities.trim(),
      products: capacitySummary.products || input.products.trim(),
      capacityRows,
      keyClients: input.keyClients.trim(),
      people: input.promoterName.trim()
        ? [{ id: nid("fin_p"), name: input.promoterName.trim(), role: "Promoter", profile: "", shareholdingPct: "" }]
        : [],
      financialYears,
      facilities,
    };
    store.companies.push(company);
  }

  const assignedAdminId = store.users.some((item) => item.id === input.assignedAdminId && isFinanceAdmin(toSession(item)))
    ? input.assignedAdminId
    : user.id;

  const allottedEmployeeIds = input.allottedEmployeeIds.filter((id) =>
    store.users.some((item) => item.id === id && item.roleSlug === "employee" && item.team === "Finance"),
  );
  const legalAssigneeId = store.users.some((item) => item.id === input.legalAssigneeId && item.roleSlug === "employee" && item.team === "Legal")
    ? input.legalAssigneeId
    : "";

  const category = input.caseCategory as CaseCategory;
  const financeCase: FinanceCase = {
    id: caseId,
    companyId,
    caseCategory: category,
    caseType: input.caseType,
    requirementText: input.requirementText.trim(),
    amountSought: input.amountSought.trim(),
    status: "intake",
    assignedAdminId,
    allottedEmployeeIds,
    legalAssigneeId,
    clientUserId,
    clientLinkToken: nid("token"),
    mandateStatus: "not_started",
    mandateSignedOn: "",
    mandateNote: "",
    ndaStatus: "not_started",
    ndaSignedOn: "",
    ndaNote: "",
    clientQuestions: input.clientQuestions.trim(),
    documentNotes: input.documentNotes.trim(),
    fields: input.caseType === "Term Loan" ? { ...emptyTermLoanFields(), ...input.fields } : { ...input.fields },
    createdAt: now,
    updatedAt: now,
    createdById: user.id,
  };

  store.cases.unshift(financeCase);

  for (const employeeId of allottedEmployeeIds) {
    store.tasks.push({
      id: nid("fin_task"),
      caseId,
      employeeId,
      kind: "case_work",
      title: `Work ${input.companyName.trim()} · ${input.caseType}`,
      status: "open",
      createdAt: now,
      updatedAt: now,
      createdById: user.id,
    });
  }
  if (legalAssigneeId) {
    store.tasks.push({
      id: nid("fin_task"),
      caseId,
      employeeId: legalAssigneeId,
      kind: "mandate",
      title: `Mandate · ${input.companyName.trim()}`,
      status: "open",
      createdAt: now,
      updatedAt: now,
      createdById: user.id,
    });
    store.tasks.push({
      id: nid("fin_task"),
      caseId,
      employeeId: legalAssigneeId,
      kind: "nda",
      title: `NDA · ${input.companyName.trim()}`,
      status: "open",
      createdAt: now,
      updatedAt: now,
      createdById: user.id,
    });
  }

  write(store);
  return financeCase;
}

export function updateFinanceCase(
  user: FinanceSessionUser,
  caseId: string,
  patch: {
    requirementText?: string;
    amountSought?: string;
    status?: string;
    clientQuestions?: string;
    documentNotes?: string;
    fields?: Record<string, string>;
    company?: Partial<Omit<FinanceCompany, "id" | "people" | "financialYears" | "facilities">>;
    financialYears?: FinanceFinancialYear[];
    facilities?: FinanceFacility[];
  },
) {
  const store = read();
  const financeCase = store.cases.find((item) => item.id === caseId);
  if (!financeCase || !canViewCase(user, financeCase)) throw new PortalError("That case was not found.");
  if (!canEditCaseData(user, financeCase)) throw new PortalError("You cannot edit this case.");

  if (isFinanceAdmin(user) || (!isFinanceClient(user) && canEditCaseData(user, financeCase))) {
    if (patch.requirementText != null && !isFinanceClient(user)) financeCase.requirementText = patch.requirementText.trim();
    if (patch.status != null && isFinanceAdmin(user)) {
      if (!isCaseStatus(patch.status)) throw new PortalError("Choose a valid case status.");
      financeCase.status = patch.status;
    }
  }

  if (patch.amountSought != null) financeCase.amountSought = patch.amountSought.trim();
  if (patch.clientQuestions != null) financeCase.clientQuestions = patch.clientQuestions.trim();
  if (patch.documentNotes != null) financeCase.documentNotes = patch.documentNotes.trim();
  if (patch.fields) financeCase.fields = { ...financeCase.fields, ...patch.fields };

  const company = store.companies.find((item) => item.id === financeCase.companyId);
  if (company && patch.company) {
    if (isFinanceAdmin(user) || isFinanceClient(user) || canEditCaseData(user, financeCase)) {
      if (isFinanceAdmin(user)) {
        if (patch.company.name != null) company.name = patch.company.name.trim();
        if (patch.company.constitution != null) company.constitution = patch.company.constitution.trim();
      }
      if (patch.company.cin != null) company.cin = patch.company.cin.trim();
      if (patch.company.pan != null) company.pan = patch.company.pan.trim();
      if (patch.company.incorporationYear != null) company.incorporationYear = patch.company.incorporationYear.trim();
      if (patch.company.locations != null) company.locations = patch.company.locations.trim();
      if (patch.company.businessDescription != null) company.businessDescription = patch.company.businessDescription.trim();
      if (patch.company.capacityRows) {
        company.capacityRows = normalizeCapacityRows(patch.company.capacityRows);
        const summary = summarizeCapacityRows(company.capacityRows);
        company.products = summary.products;
        company.capacities = summary.capacities;
      } else {
        if (patch.company.capacities != null) company.capacities = patch.company.capacities.trim();
        if (patch.company.products != null) company.products = patch.company.products.trim();
      }
      if (patch.company.keyClients != null) company.keyClients = patch.company.keyClients.trim();
    }
  }
  if (company && patch.financialYears) company.financialYears = patch.financialYears;
  if (company && patch.facilities) company.facilities = patch.facilities;

  financeCase.updatedAt = new Date().toISOString();
  write(store);
  return financeCase;
}

export function allotFinanceCase(
  user: FinanceSessionUser,
  caseId: string,
  patch: { allottedEmployeeIds: string[]; legalAssigneeId: string },
) {
  if (!canAllotCases(user)) throw new PortalError("Only Admin can allot cases and tasks.");
  const store = read();
  const financeCase = store.cases.find((item) => item.id === caseId);
  if (!financeCase) throw new PortalError("That case was not found.");
  const company = store.companies.find((item) => item.id === financeCase.companyId);
  const now = new Date().toISOString();

  financeCase.allottedEmployeeIds = patch.allottedEmployeeIds.filter((id) =>
    store.users.some((item) => item.id === id && item.roleSlug === "employee" && item.team === "Finance"),
  );
  financeCase.legalAssigneeId = store.users.some((item) => item.id === patch.legalAssigneeId && item.roleSlug === "employee" && item.team === "Legal")
    ? patch.legalAssigneeId
    : "";
  financeCase.updatedAt = now;

  const keep = new Set([...financeCase.allottedEmployeeIds, financeCase.legalAssigneeId].filter(Boolean));
  store.tasks = store.tasks.filter((task) => task.caseId !== caseId || keep.has(task.employeeId));

  for (const employeeId of financeCase.allottedEmployeeIds) {
    if (!store.tasks.some((task) => task.caseId === caseId && task.employeeId === employeeId && task.kind === "case_work")) {
      store.tasks.push({
        id: nid("fin_task"),
        caseId,
        employeeId,
        kind: "case_work",
        title: `Work ${company?.name || "case"} · ${financeCase.caseType}`,
        status: "open",
        createdAt: now,
        updatedAt: now,
        createdById: user.id,
      });
    }
  }
  if (financeCase.legalAssigneeId) {
    for (const kind of ["mandate", "nda"] as const) {
      if (!store.tasks.some((task) => task.caseId === caseId && task.employeeId === financeCase.legalAssigneeId && task.kind === kind)) {
        store.tasks.push({
          id: nid("fin_task"),
          caseId,
          employeeId: financeCase.legalAssigneeId,
          kind,
          title: `${kind === "mandate" ? "Mandate" : "NDA"} · ${company?.name || "case"}`,
          status: "open",
          createdAt: now,
          updatedAt: now,
          createdById: user.id,
        });
      }
    }
  }

  write(store);
  return financeCase;
}

export function updateMandateNda(
  user: FinanceSessionUser,
  caseId: string,
  patch: {
    mandateStatus?: string;
    mandateSignedOn?: string;
    mandateNote?: string;
    ndaStatus?: string;
    ndaSignedOn?: string;
    ndaNote?: string;
  },
) {
  const store = read();
  const financeCase = store.cases.find((item) => item.id === caseId);
  if (!financeCase || !canViewCase(user, financeCase)) throw new PortalError("That case was not found.");
  if (!canEditMandate(user, financeCase)) throw new PortalError("Mandate and NDA are limited to Admin or the assigned Legal employee.");

  const applyStatus = (value: string | undefined, key: "mandateStatus" | "ndaStatus") => {
    if (value == null) return;
    if (!isMandateStatus(value)) throw new PortalError("Choose a valid mandate / NDA status.");
    financeCase[key] = value as MandateStatus;
  };

  applyStatus(patch.mandateStatus, "mandateStatus");
  applyStatus(patch.ndaStatus, "ndaStatus");
  if (patch.mandateSignedOn != null) financeCase.mandateSignedOn = patch.mandateSignedOn.trim();
  if (patch.mandateNote != null) financeCase.mandateNote = patch.mandateNote.trim();
  if (patch.ndaSignedOn != null) financeCase.ndaSignedOn = patch.ndaSignedOn.trim();
  if (patch.ndaNote != null) financeCase.ndaNote = patch.ndaNote.trim();
  financeCase.updatedAt = new Date().toISOString();
  write(store);
  return financeCase;
}

export function setEmployeeFunderAccess(user: FinanceSessionUser, employeeId: string, enabled: boolean) {
  if (!isFinanceAdmin(user)) throw new PortalError("Only Admin can grant or withdraw funder database access.");
  const store = read();
  const employee = store.users.find((item) => item.id === employeeId && item.roleSlug === "employee");
  if (!employee) throw new PortalError("That employee was not found.");
  employee.funderDbAccess = enabled;
  write(store);
  return toSession(employee);
}

export type { FinanceTask };
