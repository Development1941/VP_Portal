import { ProjectHealthList } from "@/components/projects/health-list";
import { Denied, PageHeader } from "@/components/common/ui";
import { requirePage } from "@/lib/page";

export default async function HealthPage() {
  const { user, data, allowed } = await requirePage(["dashboard.view"]);
  if (!allowed || user.roleSlug !== "director") return <Denied title="Project health" />;

  return (
    <>
      <PageHeader eyebrow="Delivery" title="Project health" />
      <ProjectHealthList projects={data.projects} milestones={data.milestones} timesheets={data.timesheets} />
    </>
  );
}
