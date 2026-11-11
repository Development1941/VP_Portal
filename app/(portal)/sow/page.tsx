import { submitIntakeAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { HoursField } from "@/components/intake/hours-field";
import { Denied, PageHeader, Stat } from "@/components/common/ui";
import { SowStatusBoard } from "@/components/sheets/sow-board";
import { ArrivalToast } from "@/components/toast";
import { db } from "@/lib/data";
import { REQUIREMENT_SOURCES } from "@/lib/delivery";
import { requireTab } from "@/lib/page";
import { sowNeedsAttention } from "@/lib/sow-board";

export default async function SowPage({ searchParams }: { searchParams: Promise<{ intake?: string }> }) {
  const query = await searchParams;
  const { user, data, allowed } = await requireTab("sowManagement");
  if (!allowed) return <Denied title="Statements of work" />;
  const organizations = await db().organizations(user);
  const owners = await db().intakeOwners(user);
  const ownerDefault = owners.some((person) => person.id === user.id) ? user.id : owners[0]?.id || "";
  const sows = data.sowRecords.filter((row) => row.kind === "status");
  const bids = data.sowRecords.filter((row) => row.kind === "bid");
  const signed = sows.filter((row) => row.signature.trim().toLowerCase() === "signed").length;
  const unsigned = sows.length - signed;
  const addenda = sows.filter(sowNeedsAttention).length;
  const sowProjects = new Set(sows.map((row) => row.project.trim().toLowerCase())).size;

  return (
    <>
      {query.intake ? (
        <ArrivalToast title="SOW requisition submitted." body="It was added to SOW status. The client, admin, director, and the intake owner have been notified." />
      ) : null}
      <PageHeader eyebrow="Operations" title="Statements of work" lede="SOW management and intake. New data is appended to the existing records." />
      <div className="stats stats-5">
        <Stat label="SOWs" value={String(sows.length)} href="#sow-status" detail={`${sows.length} SOW rows across ${sowProjects} ${sowProjects === 1 ? "project" : "projects"}. ${signed} signed, ${unsigned} awaiting signature.`} />
        <Stat label="Signed" value={String(signed)} href="#sow-status" detail={`${signed} of ${sows.length} SOWs are marked Signed.`} />
        <Stat label="Awaiting signature" value={String(unsigned)} href="#sow-status" detail={`${unsigned} SOWs are Unsigned or have no signature status yet.`} />
        <Stat label="Addendum / CR needed" value={String(addenda)} href="#sow-status" detail={`${addenda} SOWs have a change request or addendum noted. These also show on the Dashboard under Needs attention.`} />
        <Stat label="SOW bids" value={String(bids.length)} href="#sow-status" detail={`${bids.length} open bids are listed under SOW bids.`} />
      </div>
      <details className="card intake-form intake-history" open={!data.projects.length}>
        <summary>SOW requisition</summary>
        <ActionForm action={submitIntakeAction} className="intake-fields">
          <div className="form-grid intake-fields-scroll">
            <label className="field">
              <span>Client name</span>
              <input name="clientName" required defaultValue={user.fullName} />
            </label>
            <label className="field">
              <span>Project name</span>
              <input name="name" required placeholder="Atlas Ledger Migration" />
            </label>
            <HoursField />
            <label className="field">
              <span>Requested start date</span>
              <input name="startDate" type="date" required />
            </label>
            <label className="field">
              <span>Project due date</span>
              <input name="dueDate" type="date" required />
            </label>
            <label className="field">
              <span>Initiated by</span>
              <input value={user.fullName} readOnly />
            </label>
            <label className="field">
              <span>Initiated from</span>
              <select name="initiatedFrom" required defaultValue={organizations[0] || ""}>
                {organizations.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Intake owner</span>
              <select name="ownerId" required defaultValue={ownerDefault}>
                {owners.map((person) => (
                  <option key={person.id} value={person.id}>{person.fullName} · {person.roleName}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Source of requirement</span>
              <select name="source" defaultValue="requirement_document">
                {REQUIREMENT_SOURCES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>Summary and expected outcome</span>
              <textarea name="summary" className="intake-summary" placeholder="Optional" />
            </label>
            <label className="field wide">
              <span>Upload requirement documents, proposals or meeting transcripts</span>
              <input name="files" type="file" multiple accept=".pdf,.doc,.docx,.txt,.vtt" />
            </label>
          </div>
          <div className="actions">
            <Submit>Submit requisition</Submit>
          </div>
        </ActionForm>
      </details>
      <SowStatusBoard records={data.sowRecords} editable />
    </>
  );
}
