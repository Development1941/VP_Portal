import { ProjectHealthList } from "@/components/projects/health-list";
import { Denied, PageHeader } from "@/components/common/ui";
import { requirePage } from "@/lib/page";

export default async function HealthPage() {
  const { user, data, allowed } = await requirePage(["dashboard.view"]);
  if (!allowed || user.roleSlug !== "director") return <Denied title="Project health" />;

  return (
    <>
      <PageHeader
        eyebrow="Director"
        title="Project health"
        lede="Each sprint’s allocated hours are the expectation. Health compares logged hours with that expectation and with how many sprints are finished. Completion is finished sprints divided by every sprint on the project."
      />
      <ProjectHealthList projects={data.projects} milestones={data.milestones} timesheets={data.timesheets} />
    </>
  );
}
