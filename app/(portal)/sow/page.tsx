import Link from "next/link";
import { setDeliveryStatusAction, uploadSowAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader, Stat } from "@/components/common/ui";
import { DELIVERY_STATUSES } from "@/lib/delivery";
import { can, canSeeIntake } from "@/lib/access";
import { ArrivalToast } from "@/components/toast";
import { clientOf, requirePage } from "@/lib/page";

export default async function SowPage({ searchParams }: { searchParams: Promise<{ intake?: string }> }) {
  const query = await searchParams;
  const { user, data, allowed } = await requirePage(["projects.view", "projects.view_all", "projects.manage", "projects.intake"]);
  if (!allowed || !canSeeIntake(user)) return <Denied title="SOW management" />;
  const counts = {
    progress: data.projects.filter((project) => project.deliveryStatus === "in_progress").length,
    done: data.projects.filter((project) => project.deliveryStatus === "done").length,
    blocked: data.projects.filter((project) => project.deliveryStatus === "blocked").length,
  };
  const manage = can(user, "projects.manage") || can(user, "projects.view_all");

  return (
    <>
      {query.intake ? <ArrivalToast title="Project intake completed." body="It is now with SOW. The client, admin, director, and the intake owner have been notified." /> : null}
      <PageHeader eyebrow="Delivery control" title="SOW management" lede="Every intaken project with its delivery status. Change status from the list and attach the SOW PDF in the same row." />
      <div className="stats">
        <Stat label="Projects intaken" value={String(data.projects.length)} />
        <Stat label="In progress" value={String(counts.progress)} />
        <Stat label="Done" value={String(counts.done)} />
        <Stat label="Blocked" value={String(counts.blocked)} />
      </div>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Project</th><th>Client</th><th>Status</th><th>SOW stage</th><th>SOW PDF</th><th></th></tr>
            </thead>
            <tbody>
              {data.projects.map((project) => (
                <tr key={project.id}>
                  <td><b>{project.name}</b></td>
                  <td>{clientOf(data, project.clientId)?.company || "Client hidden"}</td>
                  <td>
                    {manage ? (
                      <ActionForm action={setDeliveryStatusAction} className="inline-form">
                        <input type="hidden" name="projectId" value={project.id} />
                        <select name="deliveryStatus" defaultValue={project.deliveryStatus}>
                          {DELIVERY_STATUSES.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <Submit variant="ghost">Save</Submit>
                      </ActionForm>
                    ) : (
                      <Badge value={project.deliveryStatus} />
                    )}
                  </td>
                  <td><Badge value={project.sowStage} /></td>
                  <td>
                    {project.sowFileName ? <span>{project.sowFileName}</span> : null}
                    {manage ? (
                      <ActionForm action={uploadSowAction} className="inline-form">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input name="file" type="file" accept=".pdf" />
                        <Submit variant="ghost">Attach</Submit>
                      </ActionForm>
                    ) : null}
                  </td>
                  <td><Link href={`/sow/${project.id}`}>Open in admin</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
