"use client";

import { useEffect, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { addWorkTaskAction, taskStatusAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { pushToast } from "@/components/toast";
import type { Task } from "@/lib/types";

export type WorkCard = {
  id: string;
  title: string;
  description: string;
  status: Task["status"];
  priority: Task["priority"];
  projectName: string;
  assigneeName: string;
  dueLabel: string;
  movable: boolean;
  showAssignee: boolean;
};

const COLUMNS: { status: Task["status"]; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "in_progress", label: "In progress" },
  { status: "review", label: "Review" },
  { status: "done", label: "Done" },
];

export function WorkBoard({
  tasks,
  projects,
}: {
  tasks: WorkCard[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(tasks);
  const [over, setOver] = useState<Task["status"] | "">("");
  const [dragging, setDragging] = useState("");
  const [adding, setAdding] = useState<Task["status"] | "">("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCards(tasks);
  }, [tasks]);

  function move(id: string, status: Task["status"]) {
    const current = cards.find((item) => item.id === id);
    if (!current || !current.movable || current.status === status) return;
    setCards((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    const form = new FormData();
    form.set("id", id);
    form.set("status", status);
    startTransition(async () => {
      const result = await taskStatusAction({}, form);
      if (result.error) {
        setCards(tasks);
        pushToast({ tone: "bad", title: result.error });
        return;
      }
      pushToast({ tone: "ok", title: result.ok || "Task updated." });
      router.refresh();
    });
  }

  function takeDrop(event: DragEvent, status: Task["status"]) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragging;
    setOver("");
    setDragging("");
    if (id) move(id, status);
  }

  return (
    <div className="board-wrap">
      <div className="board">
        {COLUMNS.map((column) => {
          const items = cards.filter((card) => card.status === column.status);
          return (
            <section
              key={column.status}
              className={`board-col tone-${column.status}${over === column.status ? " drop" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragging) setOver(column.status);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setOver((value) => (value === column.status ? "" : value));
              }}
              onDrop={(event) => takeDrop(event, column.status)}
            >
              <header>
                <strong>{column.label}</strong>
                <span>{items.length}</span>
              </header>
              <div className="board-cards">
                {items.map((card) => (
                  <article
                    key={card.id}
                    className={`board-card${dragging === card.id ? " dragging" : ""}`}
                    draggable={card.movable}
                    onDragStart={(event) => {
                      if (!card.movable) return;
                      event.dataTransfer.setData("text/plain", card.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragging(card.id);
                    }}
                    onDragEnd={() => {
                      setDragging("");
                      setOver("");
                    }}
                  >
                    <h3>{card.title}</h3>
                    <p>
                      {card.projectName}
                      {card.dueLabel ? ` · due ${card.dueLabel}` : ""}
                      {` · ${card.priority}`}
                    </p>
                    {card.showAssignee ? <p>{card.assigneeName}</p> : null}
                    {card.description ? <p>{card.description}</p> : null}
                    {card.movable ? (
                      <label>
                        Move
                        <select
                          value={card.status}
                          aria-label={`Move ${card.title}`}
                          disabled={pending}
                          onChange={(event) => move(card.id, event.target.value as Task["status"])}
                        >
                          {COLUMNS.map((option) => (
                            <option key={option.status} value={option.status}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </article>
                ))}
              </div>
              {projects.length ? (
                adding === column.status ? (
                  <ActionForm action={addWorkTaskAction} className="composer">
                    <input type="hidden" name="status" value={column.status} />
                    <label className="field">
                      <span>Card</span>
                      <input name="title" required placeholder="Task title" autoFocus />
                    </label>
                    <label className="field">
                      <span>Project</span>
                      <select name="projectId" required defaultValue={projects[0]?.id}>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Note</span>
                      <input name="description" placeholder="Optional" />
                    </label>
                    <div className="actions">
                      <Submit variant="small">Add card</Submit>
                      <button type="button" className="btn ghost small" onClick={() => setAdding("")}>
                        Cancel
                      </button>
                    </div>
                  </ActionForm>
                ) : (
                  <button type="button" className="board-add" onClick={() => setAdding(column.status)}>
                    + Add a card
                  </button>
                )
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
