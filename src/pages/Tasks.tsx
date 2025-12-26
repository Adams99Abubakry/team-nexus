import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, Filter, Plus, Calendar, Flag, Clock, 
  ChevronRight, MoreHorizontal, CheckCircle2, Circle,
  AlertCircle, ArrowUpCircle, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

const priorityIcons = {
  low: <Circle className="w-4 h-4 text-muted-foreground" />,
  medium: <Flag className="w-4 h-4 text-task-medium" />,
  high: <AlertCircle className="w-4 h-4 text-task-high" />,
  urgent: <ArrowUpCircle className="w-4 h-4 text-task-urgent" />,
};

const statusColors = {
  backlog: "bg-muted text-muted-foreground",
  todo: "bg-status-todo/20 text-status-todo",
  in_progress: "bg-status-in-progress/20 text-status-in-progress",
  in_review: "bg-status-review/20 text-status-review",
  done: "bg-status-done/20 text-status-done",
  cancelled: "bg-muted text-muted-foreground",
};

export default function Tasks() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<(Task & { project?: Project })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      fetchData();
    }
  }, [currentWorkspace]);

  const fetchData = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    
    // Fetch projects first
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", currentWorkspace.id);
    
    setProjects(projectsData || []);
    
    if (projectsData && projectsData.length > 0) {
      const projectIds = projectsData.map(p => p.id);
      
      // Fetch all tasks for these projects
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      
      // Merge with project data
      const tasksWithProjects = (tasksData || []).map(task => ({
        ...task,
        project: projectsData.find(p => p.id === task.project_id),
      }));
      
      setTasks(tasksWithProjects);
    }
    
    setLoading(false);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleTaskComplete = async (taskId: string, completed: boolean) => {
    const newStatus = completed ? "done" : "todo";
    await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);
    
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t
    ));
  };

  const myTasks = filteredTasks.filter(t => t.assignee_id === user?.id);
  const otherTasks = filteredTasks.filter(t => t.assignee_id !== user?.id);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">Manage all your tasks across projects</p>
          </div>
          <Button onClick={() => {
            setSelectedTask(null);
            setSelectedProjectId(projects[0]?.id || null);
            setTaskDialogOpen(true);
          }} disabled={projects.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* My Tasks */}
        {myTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assigned to me</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {myTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleTaskComplete}
                    onClick={() => {
                      setSelectedTask(task);
                      setSelectedProjectId(task.project_id);
                      setTaskDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {myTasks.length > 0 ? "Other Tasks" : "All Tasks"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {otherTasks.length === 0 && myTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks found. Create your first task to get started!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {otherTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleTaskComplete}
                    onClick={() => {
                      setSelectedTask(task);
                      setSelectedProjectId(task.project_id);
                      setTaskDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedProjectId && (
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          projectId={selectedProjectId}
          task={selectedTask}
          onTaskSaved={fetchData}
        />
      )}
    </AppLayout>
  );
}

function TaskRow({ 
  task, 
  onComplete, 
  onClick 
}: { 
  task: Task & { project?: Project };
  onComplete: (id: string, completed: boolean) => void;
  onClick: () => void;
}) {
  const isComplete = task.status === "done";
  
  return (
    <div 
      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <Checkbox
        checked={isComplete}
        onCheckedChange={(checked) => {
          event?.stopPropagation();
          onComplete(task.id, checked as boolean);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {task.project && (
            <Badge variant="outline" className="text-xs">
              {task.project.prefix}-{task.task_number}
            </Badge>
          )}
          <span className={`font-medium truncate ${isComplete ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </span>
        </div>
        {task.project && (
          <p className="text-sm text-muted-foreground truncate mt-1">
            {task.project.name}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {priorityIcons[task.priority]}
        <Badge className={statusColors[task.status]} variant="secondary">
          {task.status.replace("_", " ")}
        </Badge>
        {task.due_date && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {format(new Date(task.due_date), "MMM d")}
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
