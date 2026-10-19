import Link from "next/link";
import { notFound } from "next/navigation";
import { finaliseSowAction, saveSowAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { APPROVAL_STATUSES, BILLING_TERMS, PAYMENT_STATUSES, hoursConsumed } from "@/lib/delivery";
import { hoursLabel, money } from "@/lib/format";
import { clientOf, nameOf, requirePage } from "@/lib/page";

export default async function SowAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, data, allowed } = await requirePage(["projects.view", "projects.view_all", "projects.manage"]);
  if (!allowed) return <Denied title="SOW admin finalisation" />;
  const project = data.projects.find((item) => item.id === id);
  if (!project) notFound();
  const consumed = hoursConsumed(project.id, data.timesheets, data.tasks);
  const balance = project.estimatedHours - consumed;
  const people = data.users.filter((person) => person.status === "active");
  const manage = can(user, "projects.manage") || can(user, "projects.view_all");

  return (
    <>
      <PageHeader eyebrow="Delivery control" title="SOW admin finalisation" lede="Admins review and finalise the SOW. Finalising unlocks resource allocation.">
        <Link href="/sow">Back to SOW list</Link>
      </PageHeader>
      <section className="card">
        <p className="muted">
          {project.name} · <Badge value={project.sowStage} /> · client {clientOf(data, project.clientId)?.company}
        </p>
      </section>
      <ActionForm action={saveSowAction}>
        <input type="hidden" name="id" value={project.id} />
        <section className="card">
          <h2>Commercials</h2>
          <div className="form-grid">
            <label className="field">
              <span>Client</span>
              <select name="clientId" defaultValue={project.clientId} disabled={!manage}>
                {data.clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.company}</option>
                ))}
              </select>
            </label>
            <label className="field"><span>Project name</span><input name="name" defaultValue={project.name} required disabled={!manage} /></label>
            <label className="field"><span>SOW value</span><input name="budgetAmount" type="number" min="0" step="1" defaultValue={project.budgetAmount} disabled={!manage} /></label>
            <label className="field">
              <span>Billing terms</span>
              <select name="billingTerms" defaultValue={project.billingTerms} disabled={!manage}>
                {BILLING_TERMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field"><span>Start date</span><input type="date" name="startDate" defaultValue={project.startDate} disabled={!manage} /></label>
            <label className="field"><span>End date</span><input type="date" name="endDate" defaultValue={project.endDate} disabled={!manage} /></label>
            <label className="field">
              <span>Approval / signature status</span>
              <select name="approvalStatus" defaultValue={project.approvalStatus} disabled={!manage}>
                {APPROVAL_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field"><span>Renewal date</span><input type="date" name="renewalDate" defaultValue={project.renewalDate} disabled={!manage} /></label>
            <label className="field"><span>Currency</span><input name="currency" defaultValue={data.currency} readOnly /></label>
            <p className="muted">Current value {money(project.budgetAmount, data.currency)}</p>
            <label className="field wide"><span>Scope of work</span><textarea name="scope" defaultValue={project.scope} disabled={!manage} /></label>
            <label className="field wide"><span>Deliverables</span><textarea name="deliverables" defaultValue={project.deliverables} disabled={!manage} /></label>
            <label className="field wide"><span>Milestones</span><textarea name="description" defaultValue={project.description} disabled={!manage} /></label>
            <label className="field wide"><span>Risks</span><textarea name="risks" defaultValue={project.risks} disabled={!manage} /></label>
            <label className="field wide"><span>Pending actions</span><textarea name="pendingActions" defaultValue={project.pendingActions} disabled={!manage} /></label>
          </div>
        </section>
        <section className="card">
          <h2>Ownership, hours and invoicing</h2>
          <div className="form-grid">
            <label className="field">
              <span>Project owner</span>
              <select name="ownerId" defaultValue={project.ownerId} disabled={!manage}>
                {people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Delivery owner</span>
              <select name="deliveryOwnerId" defaultValue={project.deliveryOwnerId} disabled={!manage}>
                <option value="">Unassigned</option>
                {people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
              </select>
            </label>
            <label className="field"><span>Budgeted hours</span><input name="estimatedHours" type="number" min="0" step="0.5" defaultValue={project.estimatedHours} disabled={!manage} /></label>
            <label className="field"><span>Actual hours consumed</span><input value={hoursLabel(consumed)} readOnly /></label>
            <label className="field"><span>Balance hours</span><input value={hoursLabel(balance)} readOnly /></label>
            <label className="field"><span>Invoicing status</span><input name="invoicingStatus" defaultValue={project.invoicingStatus} disabled={!manage} /></label>
            <label className="field">
              <span>Payment status</span>
              <select name="paymentStatus" defaultValue={project.paymentStatus} disabled={!manage}>
                {PAYMENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <p className="muted">Project owner {nameOf(data, project.ownerId)} · delivery owner {nameOf(data, project.deliveryOwnerId)}</p>
          </div>
          {manage ? <Submit>Save SOW</Submit> : null}
        </section>
      </ActionForm>
      {manage ? (
        <section className="card">
          {project.sowStage === "finalised" ? (
            <p>SOW already finalised. <Link href="/resources">Open resource allocation</Link></p>
          ) : (
            <ActionForm action={finaliseSowAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <Submit>Finalise SOW</Submit>
            </ActionForm>
          )}
        </section>
      ) : null}
    </>
  );
}
