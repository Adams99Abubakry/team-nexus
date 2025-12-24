import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
  Eye,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_number: number;
  due_date: string | null;
  assignee_id: string | null;
  project_id: string;
  created_at: string;
}

interface KanbanBoardProps {
  tasks: Task[];
  projectPrefix: string;
  onTaskClick: (task: Task) => void;
  onTaskStatusChange: (taskId: string, newStatus: string) => void;
}

const COLUMNS = [
  { id: "backlog", label: "Backlog", icon: Circle, color: "text-status-backlog" },
  { id: "todo", label: "To Do", icon: Circle, color: "text-status-todo" },
  { id: "in_progress", label: "In Progress", icon: Clock, color: "text-status-in-progress" },
  { id: "in_review", label: "In Review", icon: Eye, color: "text-status-in-review" },
  { id: "done", label: "Done", icon: CheckCircle2, color: "text-status-done" },
];

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-priority-low/10", text: "text-priority-low" },
  medium: { bg: "bg-priority-medium/10", text: "text-priority-medium" },
  high: { bg: "bg-priority-high/10", text: "text-priority-high" },
  urgent: { bg: "bg-priority-urgent/10", text: "text-priority-urgent" },
};

export function KanbanBoard({
  tasks,
  projectPrefix,
  onTaskClick,
  onTaskStatusChange,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== columnId) {
      onTaskStatusChange(draggedTask.id, columnId);
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="flex gap-4 p-6 h-full overflow-x-auto">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.id);
        const Icon = column.icon;

        return (
          <div
            key={column.id}
            className={cn(
              "flex flex-col w-72 shrink-0 rounded-xl transition-colors",
              dragOverColumn === column.id && "bg-accent/50"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <Icon className={cn("w-4 h-4", column.color)} />
              <span className="font-medium text-sm">{column.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {columnTasks.length}
              </Badge>
            </div>

            {/* Tasks */}
            <div className="flex-1 space-y-2 overflow-y-auto px-1 pb-4">
              {columnTasks.map((task) => {
                const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;

                return (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick(task)}
                    className={cn(
                      "glass-card cursor-pointer hover:shadow-md transition-all duration-200 group",
                      draggedTask?.id === task.id && "opacity-50"
                    )}
                  >
                    <CardContent className="p-3 space-y-2">
                      {/* Task ID */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">
                          {projectPrefix}-{task.task_number}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs capitalize",
                            priorityStyle.bg,
                            priorityStyle.text
                          )}
                        >
                          {task.priority}
                        </Badge>
                      </div>

                      {/* Title */}
                      <h4 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors">
                        {task.title}
                      </h4>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1">
                        {task.due_date ? (
                          <div
                            className={cn(
                              "flex items-center gap-1 text-xs",
                              isOverdue(task.due_date) && task.status !== "done"
                                ? "text-destructive"
                                : "text-muted-foreground"
                            )}
                          >
                            {isOverdue(task.due_date) && task.status !== "done" ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : (
                              <Calendar className="w-3 h-3" />
                            )}
                            {new Date(task.due_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        ) : (
                          <span />
                        )}

                        {task.assignee_id && (
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              U
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {columnTasks.length === 0 && (
                <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
