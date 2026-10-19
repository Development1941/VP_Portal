import { WorkBoard } from "@/components/work/board";
import { Denied, PageHeader } from "@/components/common/ui";
import { canEditTask, leadsProject, projectVisible, taskOnBoard } from "@/lib/access";
import { prettyDate } from "@/lib/format";
import { nameOf, projectOf, requirePage } from "@/lib/page";

export default async function WorkPage() {
  const { user, data, allowed } = await requirePage(["tasks.view"]);
  if (!allowed) return <Denied title="My work" />;
  const tasks = data.tasks.filter((task) => taskOnBoard(user, task, projectOf(data, task.projectId), data.members));
  const reviewing = data.projects.some((project) => leadsProject(user, project, data.members));
  const projects = data.projects
    .filter((project) => projectVisible(user, project, data.members))
    .map((project) => ({ id: project.id, name: project.name }));

  return (
    <>
      <PageHeader
        eyebrow="My work"
        title={reviewing ? "Project board" : "My board"}
        lede={
          reviewing
            ? "Drag a card into any list. A card moved to Done stays on this board."
            : "Drag a card into Backlog, In progress, Review, or Done. Done cards go to the project owner and project manager."
        }
      />
      <WorkBoard
        tasks={tasks.map((task) => {
          const project = projectOf(data, task.projectId);
          return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            projectName: project?.name || "Project",
            assigneeName: nameOf(data, task.assigneeId),
            dueLabel: task.dueDate ? prettyDate(task.dueDate) : "",
            movable: Boolean(project && canEditTask(user, task, project)),
            showAssignee: task.assigneeId !== user.id,
          };
        })}
        projects={projects}
      />
    </>
  );
}
