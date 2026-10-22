import Link from "next/link";
import { saveProjectAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, Meter, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { showCommercials } from "@/lib/commercial";
import { money, prettyDate } from "@/lib/format";
import { clientOf, nameOf, requirePage } from "@/lib/page";
import { projectEconomics } from "@/lib/reports";

export default async function ProjectsPage() {
  const { user, data, allowed } = await requirePage(["projects.view", "projects.view_all"]);
  if (!allowed) return <Denied title="Projects" />;
  const owners = data.users.filter((person) => person.status === "active");

  return (
    <>
      <PageHeader eyebrow="Delivery" title="Projects" />
      <div className="cards">
        {data.projects.map((project) => {
          const economics = projectEconomics(project, data);
          const client = clientOf(data, project.clientId);
          return (
            <Link key={project.id} href={`/projects/${project.id}`} className="feature">
              <div className="card-head">
                <h3>{project.name}</h3>
                <Badge value={project.status} />
              </div>
              <p className="muted">
                {client?.company || "Client hidden"} · {project.code}{showCommercials ? ` · ${project.billingModel}` : ""}
              </p>
              <p>Owner {nameOf(data, project.ownerId)} · {prettyDate(project.startDate)} – {prettyDate(project.endDate)}</p>
              {showCommercials ? (
                <>
                  <Meter value={economics.budgetUsed} />
                  <p className="muted">
                    Budget {money(project.budgetAmount, data.currency)} · recognized {money(economics.recognized, data.currency)}
                  </p>
                </>
              ) : null}
            </Link>
          );
        })}
      </div>
      {can(user, "projects.manage") ? (
        <section className="card">
          <h2>New project</h2>
          <ActionForm action={saveProjectAction} className="form-grid">
            <label className="field">
              <span>Name</span>
              <input name="name" required placeholder="Noble" />
            </label>
            <label className="field">
              <span>Code</span>
              <input name="code" placeholder="NW-PORTAL" />
            </label>
            <label className="field">
              <span>Client</span>
              <select name="clientId" required defaultValue={data.clients[0]?.id}>
                {data.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Owner</span>
              <select name="ownerId" defaultValue={can(user, "projects.view_all") ? owners[0]?.id : user.id}>
                {(can(user, "projects.view_all") ? owners : owners.filter((person) => person.id === user.id)).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="planning">
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            {showCommercials ? (
              <label className="field">
                <span>Billing model</span>
                <select name="billingModel" defaultValue="hourly">
                  <option value="hourly">Hourly</option>
                  <option value="fixed">Fixed</option>
                  <option value="retainer">Retainer</option>
                </select>
              </label>
            ) : <input type="hidden" name="billingModel" value="hourly" />}
            <label className="field">
              <span>Start</span>
              <input type="date" name="startDate" />
            </label>
            <label className="field">
              <span>End</span>
              <input type="date" name="endDate" />
            </label>
            {showCommercials ? (
              <>
                <label className="field">
                  <span>Budget</span>
                  <input name="budgetAmount" type="number" min="0" step="1" defaultValue="0" />
                </label>
                <label className="field">
                  <span>Currency</span>
                  <input name="currency" defaultValue={data.currency} readOnly />
                </label>
              </>
            ) : (
              <>
                <input type="hidden" name="budgetAmount" value="0" />
                <input type="hidden" name="currency" value={data.currency} />
              </>
            )}
            <label className="field wide">
              <span>Description</span>
              <textarea name="description" />
            </label>
            <Submit>Create project</Submit>
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
