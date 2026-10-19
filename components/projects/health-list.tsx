import Link from "next/link";
import { Badge, Empty, Meter } from "@/components/common/ui";
import { hoursLabel } from "@/lib/format";
import { projectHealth, type HealthStatus } from "@/lib/health";
import type { Milestone, Project, Timesheet } from "@/lib/types";

const RANK: Record<HealthStatus, number> = { at_risk: 0, watch: 1, unplanned: 2, healthy: 3 };

export function ProjectHealthList({
  projects,
  milestones,
  timesheets,
}: {
  projects: Project[];
  milestones: Milestone[];
  timesheets: Timesheet[];
}) {
  if (!projects.length) return <Empty>No projects yet.</Empty>;
  const rows = projects
    .map((project) => ({
      project,
      health: projectHealth(
        milestones.filter((item) => item.projectId === project.id),
        timesheets.filter((item) => item.projectId === project.id),
      ),
    }))
    .sort((left, right) => RANK[left.health.status] - RANK[right.health.status] || left.project.name.localeCompare(right.project.name));

  return (
    <div className="cards">
      {rows.map(({ project, health }) => (
        <Link key={project.id} href={`/projects/${project.id}`} className="feature">
          <div className="card-head">
            <h3>{project.name}</h3>
            <Badge value={health.status} />
          </div>
          <p className="muted">{project.code || "No code"}</p>
          <Meter value={health.completion} tone="" />
          <p>{health.completion}% complete</p>
          <p className="muted">
            {health.expectedHours > 0
              ? `${hoursLabel(health.loggedHours)} logged of ${hoursLabel(health.expectedHours)} expected`
              : "No sprint hours allocated yet"}
          </p>
        </Link>
      ))}
    </div>
  );
}
