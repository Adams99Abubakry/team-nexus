import { useState, useEffect, useMemo } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Loader2
} from "lucide-react";
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths
} from "date-fns";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

const priorityColors = {
  low: "bg-muted",
  medium: "bg-task-medium/20 text-task-medium",
  high: "bg-task-high/20 text-task-high",
  urgent: "bg-task-urgent/20 text-task-urgent",
};

export default function Calendar() {
  const { currentWorkspace } = useWorkspace();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<(Task & { project?: Project })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      fetchData();
    }
  }, [currentWorkspace]);

  const fetchData = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", currentWorkspace.id);
    
    setProjects(projectsData || []);
    
    if (projectsData && projectsData.length > 0) {
      const projectIds = projectsData.map(p => p.id);
      
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .in("project_id", projectIds)
        .not("due_date", "is", null);
      
      const tasksWithProjects = (tasksData || []).map(task => ({
        ...task,
        project: projectsData.find(p => p.id === task.project_id),
      }));
      
      setTasks(tasksWithProjects);
    }
    
    setLoading(false);
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => 
      task.due_date && isSameDay(new Date(task.due_date), day)
    );
  };

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
            <h1 className="text-3xl font-bold">Calendar</h1>
            <p className="text-muted-foreground">View tasks by due date</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-center">
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const dayTasks = getTasksForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={index}
                    className={`min-h-[100px] p-2 rounded-lg border transition-colors cursor-pointer
                      ${isCurrentMonth ? "bg-card" : "bg-muted/30"}
                      ${isCurrentDay ? "border-primary ring-1 ring-primary" : "border-border"}
                      hover:bg-muted/50
                    `}
                    onClick={() => {
                      setSelectedDate(day);
                      setSelectedTask(null);
                      if (projects.length > 0) {
                        setTaskDialogOpen(true);
                      }
                    }}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isCurrentDay ? "text-primary" : 
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          className={`text-xs p-1 rounded truncate cursor-pointer ${priorityColors[task.priority]}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                            setTaskDialogOpen(true);
                          }}
                        >
                          {task.project?.prefix}-{task.task_number}: {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-1">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks with due dates</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks
                  .filter(t => t.due_date && new Date(t.due_date) >= new Date())
                  .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                  .slice(0, 5)
                  .map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedTask(task);
                        setTaskDialogOpen(true);
                      }}
                    >
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">{task.project?.name}</p>
                      </div>
                      <Badge variant="outline">
                        {format(new Date(task.due_date!), "MMM d")}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {projects.length > 0 && (
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          projectId={selectedTask?.project_id || projects[0]?.id}
          task={selectedTask}
          defaultDueDate={selectedDate}
          onTaskSaved={fetchData}
        />
      )}
    </AppLayout>
  );
}
