import { useState, useEffect, useMemo } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from "recharts";
import { 
  TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle, 
  Target, Users, FolderKanban, Loader2, Activity
} from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

const COLORS = {
  backlog: "hsl(var(--muted-foreground))",
  todo: "hsl(217, 91%, 60%)",
  in_progress: "hsl(45, 93%, 47%)",
  in_review: "hsl(270, 91%, 65%)",
  done: "hsl(142, 76%, 36%)",
  cancelled: "hsl(var(--muted))",
};

const PRIORITY_COLORS = {
  low: "#a1a1aa",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#ef4444",
};

export default function Analytics() {
  const { currentWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    if (currentWorkspace) {
      fetchData();
    }
  }, [currentWorkspace, dateRange]);

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
        .in("project_id", projectIds);

      setTasks(tasksData || []);
    }

    const { data: membersData } = await supabase
      .from("workspace_members")
      .select("*, profile:profiles(*)")
      .eq("workspace_id", currentWorkspace.id);

    setMembers(membersData || []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "done").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const overdue = tasks.filter(t => 
      t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
    ).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, overdue, completionRate };
  }, [tasks]);

  const statusDistribution = useMemo(() => {
    const distribution: Record<string, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      cancelled: 0,
    };

    tasks.forEach(task => {
      distribution[task.status]++;
    });

    return Object.entries(distribution).map(([status, count]) => ({
      name: status.replace("_", " "),
      value: count,
      color: COLORS[status as keyof typeof COLORS],
    }));
  }, [tasks]);

  const priorityDistribution = useMemo(() => {
    const distribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    tasks.forEach(task => {
      distribution[task.priority]++;
    });

    return Object.entries(distribution).map(([priority, count]) => ({
      name: priority,
      value: count,
      fill: PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS],
    }));
  }, [tasks]);

  const tasksTrend = useMemo(() => {
    const days = parseInt(dateRange);
    const interval = eachDayOfInterval({
      start: subDays(new Date(), days - 1),
      end: new Date(),
    });

    return interval.map(day => {
      const dayStart = startOfDay(day);
      const created = tasks.filter(t => 
        startOfDay(new Date(t.created_at)).getTime() === dayStart.getTime()
      ).length;
      const completed = tasks.filter(t => 
        t.status === "done" && 
        startOfDay(new Date(t.updated_at)).getTime() === dayStart.getTime()
      ).length;

      return {
        date: format(day, "MMM d"),
        created,
        completed,
      };
    });
  }, [tasks, dateRange]);

  const projectStats = useMemo(() => {
    return projects.map(project => {
      const projectTasks = tasks.filter(t => t.project_id === project.id);
      const total = projectTasks.length;
      const completed = projectTasks.filter(t => t.status === "done").length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        name: project.name,
        total,
        completed,
        progress,
      };
    }).sort((a, b) => b.total - a.total);
  }, [projects, tasks]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <Activity className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Workspace Selected</h2>
          <p className="text-muted-foreground">Please select or create a workspace first</p>
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
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Track your workspace productivity</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-green-500">{stats.completed}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-yellow-500">{stats.inProgress}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-3xl font-bold text-red-500">{stats.overdue}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Task Activity</CardTitle>
              <CardDescription>Tasks created vs completed over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tasksTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Legend />
                  <Area type="monotone" dataKey="created" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} name="Created" />
                  <Area type="monotone" dataKey="completed" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} name="Completed" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Tasks by current status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Priority & Projects */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Priority Breakdown</CardTitle>
              <CardDescription>Tasks by priority level</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priorityDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" className="text-xs capitalize" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Project Progress</CardTitle>
              <CardDescription>Completion rate by project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectStats.slice(0, 5).map(project => (
                  <div key={project.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium truncate">{project.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {project.completed}/{project.total} tasks
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
                {projectStats.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No projects yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Completion Rate Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${stats.completionRate * 3.51} 351`}
                    className="text-primary"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{stats.completionRate}%</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Overall Completion Rate</h3>
                <p className="text-muted-foreground">
                  {stats.completed} of {stats.total} tasks have been completed
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {stats.completionRate >= 50 ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      On track
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Needs attention
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
