"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canUploadFinanceSheet, homePathFor, isFinanceAdmin } from "@/lib/finance/access";
import { capacityRowsFromForm, summarizeCapacityRows } from "@/lib/finance/capacity";
import { TERM_LOAN_FIELDS } from "@/lib/finance/case-types";
import { getFinanceSession, financeSignIn, financeSignOut } from "@/lib/finance/session";
import { parseFinanceSheet } from "@/lib/finance/sheet";
import {
  allotFinanceCase,
  createFinanceIntake,
  replaceFinanceProjects,
  setEmployeeFunderAccess,
  updateFinanceCase,
  updateMandateNda,
} from "@/lib/finance/store";
import { list, PortalError, str, type FormState } from "@/lib/form";

export async function financeLoginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const presets: Record<string, [string, string]> = {
    apurv: ["apurv@finance.embee.local", "demo123"],
    gsvk: ["gsvk@finance.embee.local", "demo123"],
    vishal: ["vishal@finance.embee.local", "demo123"],
    ashish: ["ashish@finance.embee.local", "demo123"],
    deepak: ["deepak@finance.embee.local", "demo123"],
    meera: ["meera@finance.embee.local", "demo123"],
    rohan: ["rohan@finance.embee.local", "demo123"],
    lifeline: ["nikhil@lifeline.client.local", "demo123"],
    jija: ["ravi@jijamata.client.local", "demo123"],
  };
  const preset = presets[str(form, "preset")];
  let user;
  try {
    await financeSignIn(preset?.[0] || str(form, "email"), preset?.[1] || str(form, "password"));
    user = await getFinanceSession();
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
  redirect(user ? homePathFor(user) : "/finance/dashboard");
}

export async function financeSignOutAction() {
  await financeSignOut();
  redirect("/");
}

export async function uploadFinanceProjectsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getFinanceSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  if (!canUploadFinanceSheet(user)) return { error: "Only Admin and Finance employees can upload finance sheets." };

  const file = form.get("sheet");
  if (!(file instanceof File) || !file.size) return { error: "Choose a CSV or Excel file." };
  if (file.size > 4 * 1024 * 1024) return { error: "That file is larger than 4 MB." };

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = parseFinanceSheet(bytes, file.name);
    const count = replaceFinanceProjects(user, parsed.projects, parsed.sheetTitle);
    revalidatePath("/finance", "layout");
    return { ok: `Uploaded ${count} finance project row${count === 1 ? "" : "s"} from ${file.name}.` };
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
}

function fieldMap(form: FormData) {
  const fields: Record<string, string> = {};
  for (const item of TERM_LOAN_FIELDS) {
    fields[item.key] = str(form, `field_${item.key}`);
  }
  return fields;
}

function financialYearsFrom(form: FormData) {
  return [0, 1, 2].map((index) => ({
    label: str(form, `fy_label_${index}`) || `FY${24 + index}`,
    revenue: str(form, `fy_revenue_${index}`),
    ebitda: str(form, `fy_ebitda_${index}`),
    pat: str(form, `fy_pat_${index}`),
    netWorth: str(form, `fy_netWorth_${index}`),
    debt: str(form, `fy_debt_${index}`),
    notes: "",
  }));
}

function facilitiesFrom(form: FormData) {
  return [
    {
      lender: str(form, "fac_lender_0"),
      facilityType: str(form, "fac_facilityType_0"),
      limit: str(form, "fac_limit_0"),
      outstanding: str(form, "fac_outstanding_0"),
      interestRate: str(form, "fac_interestRate_0"),
      security: str(form, "fac_security_0"),
      personalGuarantor: str(form, "fac_personalGuarantor_0"),
    },
  ];
}

export async function submitFinanceIntakeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getFinanceSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  try {
    const capacityRows = capacityRowsFromForm(form);
    const capacitySummary = summarizeCapacityRows(capacityRows);
    const financeCase = createFinanceIntake(user, {
      companyName: str(form, "companyName"),
      constitution: str(form, "constitution"),
      cin: str(form, "cin"),
      pan: str(form, "pan"),
      incorporationYear: str(form, "incorporationYear"),
      locations: str(form, "locations"),
      businessDescription: str(form, "businessDescription"),
      capacities: capacitySummary.capacities,
      products: capacitySummary.products,
      capacityRows,
      keyClients: str(form, "keyClients"),
      caseCategory: str(form, "caseCategory"),
      caseType: str(form, "caseType"),
      requirementText: str(form, "requirementText"),
      amountSought: str(form, "amountSought"),
      assignedAdminId: str(form, "assignedAdminId"),
      allottedEmployeeIds: list(form, "allottedEmployeeIds"),
      legalAssigneeId: str(form, "legalAssigneeId"),
      clientName: str(form, "clientName"),
      clientEmail: str(form, "clientEmail"),
      promoterName: str(form, "promoterName"),
      clientQuestions: str(form, "clientQuestions"),
      documentNotes: str(form, "documentNotes"),
      fields: fieldMap(form),
      financialYears: financialYearsFrom(form),
      facilities: facilitiesFrom(form),
    });
    revalidatePath("/finance", "layout");
    redirect(`/finance/cases/${financeCase.id}`);
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
}

export async function saveFinanceCaseAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getFinanceSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  const caseId = str(form, "caseId");
  try {
    const capacityRows = capacityRowsFromForm(form);
    const capacitySummary = summarizeCapacityRows(capacityRows);
    updateFinanceCase(user, caseId, {
      requirementText: str(form, "requirementText"),
      amountSought: str(form, "amountSought"),
      status: str(form, "status") || undefined,
      clientQuestions: str(form, "clientQuestions"),
      documentNotes: str(form, "documentNotes"),
      fields: fieldMap(form),
      company: {
        name: str(form, "companyName"),
        constitution: str(form, "constitution"),
        cin: str(form, "cin"),
        pan: str(form, "pan"),
        incorporationYear: str(form, "incorporationYear"),
        locations: str(form, "locations"),
        businessDescription: str(form, "businessDescription"),
        capacities: capacitySummary.capacities,
        products: capacitySummary.products,
        capacityRows,
        keyClients: str(form, "keyClients"),
      },
    });
    revalidatePath("/finance", "layout");
    return { ok: "Case saved." };
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
}

export async function allotFinanceCaseAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getFinanceSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  try {
    allotFinanceCase(user, str(form, "caseId"), {
      allottedEmployeeIds: list(form, "allottedEmployeeIds"),
      legalAssigneeId: str(form, "legalAssigneeId"),
    });
    revalidatePath("/finance", "layout");
    return { ok: "Allotment saved." };
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
}

export async function saveMandateNdaAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getFinanceSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  try {
    updateMandateNda(user, str(form, "caseId"), {
      mandateStatus: str(form, "mandateStatus"),
      mandateSignedOn: str(form, "mandateSignedOn"),
      mandateNote: str(form, "mandateNote"),
      ndaStatus: str(form, "ndaStatus"),
      ndaSignedOn: str(form, "ndaSignedOn"),
      ndaNote: str(form, "ndaNote"),
    });
    revalidatePath("/finance", "layout");
    return { ok: "Mandate and NDA updated." };
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
}

export async function setFunderAccessAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getFinanceSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  if (!isFinanceAdmin(user)) return { error: "Only Admin can grant funder database access." };
  try {
    const employee = setEmployeeFunderAccess(user, str(form, "employeeId"), str(form, "enabled") === "1");
    revalidatePath("/finance", "layout");
    return { ok: `${employee.fullName}: funder database access ${employee.funderDbAccess ? "granted" : "withdrawn"}.` };
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
}
