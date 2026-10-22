import Link from "next/link";
import { submitIntakeAction } from "@/app/actions";
import { canFileIntake, canSeeIntake } from "@/lib/access";
import { ActionForm, Submit } from "@/components/common/forms";
import { HoursField } from "@/components/intake/hours-field";
import { Badge, Denied, Empty, PageHeader } from "@/components/common/ui";
import { db } from "@/lib/data";
import { REQUIREMENT_SOURCES, sourceLabel } from "@/lib/delivery";
import { hoursLabel, prettyDate } from "@/lib/format";
import { clientOf, requirePage } from "@/lib/page";

export default async function IntakePage() {
  const { user, data, allowed } = await requirePage(["projects.intake", "projects.manage", "projects.view", "projects.view_all"]);
  if (!allowed || !canSeeIntake(user)) return <Denied title="Project intake" />;
  const filing = canFileIntake(user);
  const organizations = filing ? await db().organizations(user) : [];
  const owners = filing ? await db().intakeOwners(user) : [];
  const ownerDefault = owners.some((person) => person.id === user.id) ? user.id : owners[0]?.id || "";

  return (
    <div className="intake-lock">
      <PageHeader eyebrow="Operations" title="Project intake" />
      {filing ? (
        <section className="card intake-form">
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
              <Submit>Submit intake</Submit>
            </div>
          </ActionForm>
        </section>
      ) : null}
      <details className="card intake-history">
        <summary>Previous intakes</summary>
        {!data.projects.length ? <Empty>No project request has been filed yet.</Empty> : null}
        {data.projects.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Project</th><th>Client</th><th>Due</th><th>Est. hours</th><th>Source</th><th>Stage</th><th>Files</th></tr>
              </thead>
              <tbody>
                {data.projects.map((project) => (
                  <tr key={project.id}>
                    <td><Link href={`/sow/${project.id}`}>{project.name}</Link></td>
                    <td>{clientOf(data, project.clientId)?.company || "Client hidden"}</td>
                    <td>{prettyDate(project.endDate)}</td>
                    <td>{hoursLabel(project.estimatedHours)}</td>
                    <td>{sourceLabel(project.source)}</td>
                    <td><Badge value={project.sowStage} /></td>
                    <td>
                      {data.files.filter((file) => file.projectId === project.id && file.kind === "requirement").map((file) => (
                        <a key={file.id} href={`/files/${file.id}`}>{file.fileName}</a>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </details>
    </div>
  );
}
