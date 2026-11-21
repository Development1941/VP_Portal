"use client";

import { useMemo, useState } from "react";
import { ActionForm, Submit } from "@/components/common/forms";
import { CASE_CATEGORIES, CONSTITUTIONS, TERM_LOAN_FIELDS, typesForCategory } from "@/lib/finance/case-types";
import type { FinanceSessionUser } from "@/lib/finance/types";
import type { FormState } from "@/lib/form";

export function FinanceIntakeForm({
  action,
  admins,
  financeEmployees,
  legalEmployees,
  clientNames,
  defaultAdminId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  admins: FinanceSessionUser[];
  financeEmployees: FinanceSessionUser[];
  legalEmployees: FinanceSessionUser[];
  clientNames: string[];
  defaultAdminId: string;
}) {
  const [category, setCategory] = useState<string>("Debt");
  const subtypes = useMemo(() => typesForCategory(category), [category]);
  const [caseType, setCaseType] = useState<string>(subtypes[0] || "Term Loan");

  function onCategoryChange(value: string) {
    setCategory(value);
    const next = typesForCategory(value);
    setCaseType(next[0] || "Not defined yet");
  }

  return (
    <ActionForm action={action} className="card finance-intake">
      <section className="form-section">
        <h3>New case</h3>
        <div className="form-grid">
          <label className="field">
            <span>Client name</span>
            <input name="companyName" list="finance-client-names" required placeholder="Type client / company name" autoComplete="off" />
            <datalist id="finance-client-names">
              {clientNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Case type</span>
            <select name="caseCategory" value={category} onChange={(event) => onCategoryChange(event.target.value)}>
              {CASE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sub type</span>
            <select
              name="caseType"
              value={caseType}
              onChange={(event) => setCaseType(event.target.value)}
              disabled={category === "Insolvency"}
            >
              {subtypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {caseType === "Structured Finance" ? <small className="muted">No further dropdown for Structured Finance.</small> : null}
            {category === "Insolvency" ? <small className="muted">Insolvency subtypes are not defined yet.</small> : null}
          </label>
          <label className="field">
            <span>Amount sought</span>
            <input name="amountSought" placeholder="e.g. 25 Cr" />
          </label>
          <label className="field">
            <span>Assigned admin</span>
            <select name="assignedAdminId" defaultValue={defaultAdminId}>
              {admins.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName} · {person.roleName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Company</h3>
        <div className="form-grid">
          <label className="field">
            <span>Constitution</span>
            <select name="constitution" defaultValue="Private Limited">
              {CONSTITUTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>CIN</span>
            <input name="cin" />
          </label>
          <label className="field">
            <span>PAN</span>
            <input name="pan" />
          </label>
          <label className="field">
            <span>Incorporation year</span>
            <input name="incorporationYear" placeholder="YYYY" />
          </label>
          <label className="field">
            <span>Locations</span>
            <input name="locations" />
          </label>
          <label className="field">
            <span>Promoter name</span>
            <input name="promoterName" />
          </label>
          <label className="field wide">
            <span>Business description</span>
            <textarea name="businessDescription" rows={3} />
          </label>
          <label className="field">
            <span>Capacities</span>
            <input name="capacities" />
          </label>
          <label className="field">
            <span>Products</span>
            <input name="products" />
          </label>
          <label className="field wide">
            <span>Key clients</span>
            <input name="keyClients" />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Financials</h3>
        <p className="muted">Three years. Ratios stay for a later phase.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>FY</th>
                <th>Revenue</th>
                <th>EBITDA</th>
                <th>PAT</th>
                <th>Net worth</th>
                <th>Debt</th>
              </tr>
            </thead>
            <tbody>
              {["FY24", "FY25", "FY26"].map((label, index) => (
                <tr key={label}>
                  <td>
                    {label}
                    <input type="hidden" name={`fy_label_${index}`} value={label} />
                  </td>
                  <td>
                    <input name={`fy_revenue_${index}`} />
                  </td>
                  <td>
                    <input name={`fy_ebitda_${index}`} />
                  </td>
                  <td>
                    <input name={`fy_pat_${index}`} />
                  </td>
                  <td>
                    <input name={`fy_netWorth_${index}`} />
                  </td>
                  <td>
                    <input name={`fy_debt_${index}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="form-section">
        <h3>Existing debt</h3>
        <div className="form-grid">
          <label className="field">
            <span>Lender</span>
            <input name="fac_lender_0" />
          </label>
          <label className="field">
            <span>Facility type</span>
            <input name="fac_facilityType_0" />
          </label>
          <label className="field">
            <span>Limit</span>
            <input name="fac_limit_0" />
          </label>
          <label className="field">
            <span>Outstanding</span>
            <input name="fac_outstanding_0" />
          </label>
          <label className="field">
            <span>Interest rate</span>
            <input name="fac_interestRate_0" />
          </label>
          <label className="field">
            <span>Security charged</span>
            <input name="fac_security_0" />
          </label>
          <label className="field wide">
            <span>Personal guarantor</span>
            <input name="fac_personalGuarantor_0" />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Requirement</h3>
        <div className="form-grid">
          <label className="field wide">
            <span>Requirement</span>
            <textarea name="requirementText" rows={4} required placeholder="Project and amount needed, or facility ask" />
          </label>
          {caseType === "Term Loan" ? (
            <>
              <p className="muted wide">Term Loan template fields</p>
              {TERM_LOAN_FIELDS.map((field) => (
                <label key={field.key} className={`field${field.key === "projections" || field.key === "plantMachinery" ? " wide" : ""}`}>
                  <span>{field.label}</span>
                  {field.key === "projections" || field.key === "plantMachinery" ? (
                    <textarea name={`field_${field.key}`} rows={3} placeholder={field.hint || ""} />
                  ) : (
                    <input name={`field_${field.key}`} placeholder={field.hint || ""} />
                  )}
                </label>
              ))}
            </>
          ) : null}
        </div>
      </section>

      <section className="form-section">
        <h3>Documents</h3>
        <label className="field wide">
          <span>Document notes / checklist</span>
          <textarea name="documentNotes" rows={3} placeholder="List uploaded or expected documents. File storage lands in a later phase." />
        </label>
      </section>

      <section className="form-section">
        <h3>Additional information</h3>
        <div className="form-grid">
          <label className="field">
            <span>Client contact name</span>
            <input name="clientName" placeholder="Promoter or company contact" />
          </label>
          <label className="field">
            <span>Client email</span>
            <input name="clientEmail" type="email" placeholder="Creates a client login for this case" />
          </label>
          <label className="field wide">
            <span>Other information / questions for Embee</span>
            <textarea name="clientQuestions" rows={3} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Allotment</h3>
        <div className="form-grid">
          <label className="field wide">
            <span>Finance employees</span>
            <div className="check-grid">
              {financeEmployees.map((person) => (
                <label key={person.id} className="check">
                  <input type="checkbox" name="allottedEmployeeIds" value={person.id} />
                  <span>
                    {person.fullName} · {person.team}
                  </span>
                </label>
              ))}
            </div>
          </label>
          <label className="field">
            <span>Legal assignee (Mandate / NDA)</span>
            <select name="legalAssigneeId" defaultValue="">
              <option value="">Unassigned</option>
              {legalEmployees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="modal-actions">
        <Submit>Create case</Submit>
      </div>
    </ActionForm>
  );
}
