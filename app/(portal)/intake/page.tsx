import Link from "next/link";
import { submitIntakeAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { REQUIREMENT_SOURCES, sourceLabel } from "@/lib/delivery";
import { hoursLabel } from "@/lib/format";
import { clientOf, requirePage } from "@/lib/page";

export default async function IntakePage() {
  const { user, data, allowed } = await requirePage(["projects.manage", "projects.view", "projects.view_all"]);
  if (!allowed) return <Denied title="Project intake" />;
  const owners = data.users.filter((person) => person.status === "active");
  const canChooseOwner = user.permissions.includes("projects.view_all");

  return (
    <>
      <PageHeader eyebrow="Delivery control" title="Project intake" lede="Capture a new request with its estimate and supporting material. The SOW team picks it up from here." />
      {user.permissions.includes("projects.manage") ? (
        <section className="card">
          <h2>New project request</h2>
          <ActionForm action={submitIntakeAction} className="form-grid">
            <label className="field">
              <span>Client name</span>
              <input name="clientName" required list="client-names" placeholder="Northwind Bank" />
              <datalist id="client-names">
                {data.clients.map((client) => (
                  <option key={client.id} value={client.company} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Project name</span>
              <input name="name" required placeholder="Atlas Ledger Migration" />
            </label>
            <label className="field">
              <span>Estimated hours</span>
              <input name="estimatedHours" type="number" min="0" step="1" placeholder="600" />
            </label>
            <label className="field">
              <span>Requested start date</span>
              <input name="startDate" type="date" />
            </label>
            <label className="field">
              <span>Intake owner</span>
              <select name="ownerId" defaultValue={canChooseOwner ? owners[0]?.id : user.id}>
                {(canChooseOwner ? owners : owners.filter((person) => person.id === user.id)).map((person) => (
                  <option key={person.id} value={person.id}>{person.fullName}</option>
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
              <textarea name="summary" placeholder="What should this engagement deliver?" />
            </label>
            <label className="field wide">
              <span>Requirement documents, proposals, or meeting transcripts</span>
              <input name="files" type="file" multiple accept=".pdf,.doc,.docx,.txt,.vtt" />
            </label>
            <Submit>Submit intake</Submit>
          </ActionForm>
        </section>
      ) : null}
      <section className="card">
        <h2>Recent intakes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Project</th><th>Client</th><th>Est. hours</th><th>Source</th><th>Stage</th><th>Files</th></tr>
            </thead>
            <tbody>
              {data.projects.map((project) => (
                <tr key={project.id}>
                  <td><Link href={`/sow/${project.id}`}>{project.name}</Link></td>
                  <td>{clientOf(data, project.clientId)?.company || "Client hidden"}</td>
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
      </section>
    </>
  );
}
