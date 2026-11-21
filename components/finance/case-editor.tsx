"use client";

import { ActionForm, Submit } from "@/components/common/forms";
import { CASE_STATUSES, CONSTITUTIONS, MANDATE_STATUSES, TERM_LOAN_FIELDS } from "@/lib/finance/case-types";
import type { FinanceCase, FinanceCompany } from "@/lib/finance/types";
import type { FormState } from "@/lib/form";

export function FinanceCaseEditor({
  action,
  mandateAction,
  financeCase,
  company,
  teamEditable,
  adminControls = false,
  showMandate,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mandateAction: (state: FormState, formData: FormData) => Promise<FormState>;
  financeCase: FinanceCase;
  company: FinanceCompany;
  teamEditable: boolean;
  adminControls?: boolean;
  showMandate: boolean;
}) {
  return (
    <div className="finance-case-stack">
      <ActionForm action={action} className="card finance-intake">
        <input type="hidden" name="caseId" value={financeCase.id} />
        <section className="form-section">
          <h3>Company</h3>
          <div className="form-grid">
            <label className="field">
              <span>Company name</span>
              <input name="companyName" defaultValue={company.name} required readOnly={!adminControls} />
            </label>
            <label className="field">
              <span>Constitution</span>
              {adminControls ? (
                <select name="constitution" defaultValue={company.constitution || "Private Limited"}>
                  {CONSTITUTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input value={company.constitution || "Private Limited"} readOnly />
                  <input type="hidden" name="constitution" value={company.constitution || "Private Limited"} />
                </>
              )}
            </label>
            <label className="field">
              <span>CIN</span>
              <input name="cin" defaultValue={company.cin} />
            </label>
            <label className="field">
              <span>PAN</span>
              <input name="pan" defaultValue={company.pan} />
            </label>
            <label className="field">
              <span>Incorporation year</span>
              <input name="incorporationYear" defaultValue={company.incorporationYear} />
            </label>
            <label className="field">
              <span>Locations</span>
              <input name="locations" defaultValue={company.locations} />
            </label>
            <label className="field wide">
              <span>Business description</span>
              <textarea name="businessDescription" rows={3} defaultValue={company.businessDescription} />
            </label>
            <label className="field">
              <span>Capacities</span>
              <input name="capacities" defaultValue={company.capacities} />
            </label>
            <label className="field">
              <span>Products</span>
              <input name="products" defaultValue={company.products} />
            </label>
            <label className="field wide">
              <span>Key clients</span>
              <input name="keyClients" defaultValue={company.keyClients} />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Case · {financeCase.caseType}</h3>
          <div className="form-grid">
            <label className="field">
              <span>Amount sought</span>
              <input name="amountSought" defaultValue={financeCase.amountSought} />
            </label>
            {adminControls ? (
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={financeCase.status}>
                  {CASE_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Status</span>
                <input value={CASE_STATUSES.find((item) => item.value === financeCase.status)?.label || financeCase.status} readOnly />
              </label>
            )}
            <label className="field wide">
              <span>Requirement</span>
              <textarea name="requirementText" rows={4} defaultValue={financeCase.requirementText} readOnly={!adminControls && !teamEditable} />
            </label>
            <label className="field wide">
              <span>Documents</span>
              <textarea name="documentNotes" rows={3} defaultValue={financeCase.documentNotes || ""} />
            </label>
            <label className="field wide">
              <span>Other information / questions for Embee</span>
              <textarea name="clientQuestions" rows={3} defaultValue={financeCase.clientQuestions} />
            </label>
          </div>
        </section>

        {financeCase.caseType === "Term Loan" ? (
          <section className="form-section">
            <h3>Term Loan template</h3>
            <div className="form-grid">
              {TERM_LOAN_FIELDS.map((field) => (
                <label key={field.key} className={`field${field.key === "projections" || field.key === "plantMachinery" ? " wide" : ""}`}>
                  <span>{field.label}</span>
                  {field.key === "projections" || field.key === "plantMachinery" ? (
                    <textarea name={`field_${field.key}`} rows={3} defaultValue={financeCase.fields[field.key] || ""} />
                  ) : (
                    <input name={`field_${field.key}`} defaultValue={financeCase.fields[field.key] || ""} />
                  )}
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {(company.people.length || company.financialYears.length || company.facilities.length) && teamEditable ? (
          <section className="form-section">
            <h3>Common core snapshot</h3>
            {company.people.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Role</th>
                      <th>Shareholding %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.people.map((person) => (
                      <tr key={person.id}>
                        <td>{person.name}</td>
                        <td>{person.role}</td>
                        <td>{person.shareholdingPct || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {company.financialYears.length ? (
              <div className="table-wrap" style={{ marginTop: 12 }}>
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
                    {company.financialYears.map((year) => (
                      <tr key={year.id}>
                        <td>{year.label}</td>
                        <td>{year.revenue || "—"}</td>
                        <td>{year.ebitda || "—"}</td>
                        <td>{year.pat || "—"}</td>
                        <td>{year.netWorth || "—"}</td>
                        <td>{year.debt || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {company.facilities.length ? (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Lender</th>
                      <th>Facility</th>
                      <th>Limit</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.facilities.map((facility) => (
                      <tr key={facility.id}>
                        <td>{facility.lender}</td>
                        <td>{facility.facilityType}</td>
                        <td>{facility.limit || "—"}</td>
                        <td>{facility.outstanding || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="modal-actions">
          <Submit>Save case</Submit>
        </div>
      </ActionForm>

      {showMandate ? (
        <ActionForm action={mandateAction} className="card finance-intake">
          <input type="hidden" name="caseId" value={financeCase.id} />
          <section className="form-section">
            <h3>Mandate and NDA</h3>
            <p className="muted">Admin-only. Clients and funders never see this tab.</p>
            <div className="form-grid">
              <label className="field">
                <span>Mandate status</span>
                <select name="mandateStatus" defaultValue={financeCase.mandateStatus}>
                  {MANDATE_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Mandate signed on</span>
                <input type="date" name="mandateSignedOn" defaultValue={financeCase.mandateSignedOn} />
              </label>
              <label className="field wide">
                <span>Mandate note</span>
                <textarea name="mandateNote" rows={2} defaultValue={financeCase.mandateNote} />
              </label>
              <label className="field">
                <span>NDA status</span>
                <select name="ndaStatus" defaultValue={financeCase.ndaStatus}>
                  {MANDATE_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>NDA signed on</span>
                <input type="date" name="ndaSignedOn" defaultValue={financeCase.ndaSignedOn} />
              </label>
              <label className="field wide">
                <span>NDA note</span>
                <textarea name="ndaNote" rows={2} defaultValue={financeCase.ndaNote} />
              </label>
            </div>
          </section>
          <div className="modal-actions">
            <Submit>Save mandate / NDA</Submit>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}
