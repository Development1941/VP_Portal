"use client";

import { ActionForm, Submit } from "@/components/common/forms";
import type { FinanceCase, FinanceSessionUser } from "@/lib/finance/types";
import type { FormState } from "@/lib/form";

export function FinanceAllotmentForm({
  action,
  financeCase,
  financeEmployees,
  legalEmployees,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  financeCase: FinanceCase;
  financeEmployees: FinanceSessionUser[];
  legalEmployees: FinanceSessionUser[];
}) {
  return (
    <ActionForm action={action} className="card finance-intake">
      <input type="hidden" name="caseId" value={financeCase.id} />
      <section className="form-section">
        <h3>Task allocation</h3>
        <p className="muted">Admin allots Finance employees to the case. Legal assignee owns Mandate and NDA.</p>
        <div className="form-grid">
          <label className="field wide">
            <span>Finance employees</span>
            <div className="check-grid">
              {financeEmployees.map((person) => (
                <label key={person.id} className="check">
                  <input
                    type="checkbox"
                    name="allottedEmployeeIds"
                    value={person.id}
                    defaultChecked={financeCase.allottedEmployeeIds.includes(person.id)}
                  />
                  <span>{person.fullName}</span>
                </label>
              ))}
            </div>
          </label>
          <label className="field">
            <span>Legal assignee</span>
            <select name="legalAssigneeId" defaultValue={financeCase.legalAssigneeId || ""}>
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
        <Submit>Save allotment</Submit>
      </div>
    </ActionForm>
  );
}
