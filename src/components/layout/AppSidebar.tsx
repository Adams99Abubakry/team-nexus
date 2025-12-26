import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Layers,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Search,
  Calendar,
  BarChart3,
  Moon,
  Sun,
} from "lucide-react";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
}

function NavItem({ icon, label, href, active, collapsed }: NavItemProps) {
  const content = (
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const navItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard", href: "/" },
    { icon: <FolderKanban className="w-5 h-5" />, label: "Projects", href: "/projects" },
    { icon: <CheckSquare className="w-5 h-5" />, label: "My Tasks", href: "/tasks" },
    { icon: <Calendar className="w-5 h-5" />, label: "Calendar", href: "/calendar" },
    { icon: <Users className="w-5 h-5" />, label: "Team", href: "/team" },
    { icon: <BarChart3 className="w-5 h-5" />, label: "Analytics", href: "/analytics" },
  ];

  const userInitials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || user?.email?.[0].toUpperCase() || "U";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sidebar-foreground truncate">Flowboard</h1>
          </div>
        )}
      </div>

      {/* Workspace Selector */}
      {!collapsed && currentWorkspace && (
        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-2 px-3 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {currentWorkspace.name[0]}
                  </div>
                  <span className="truncate text-sm font-medium">
                    {currentWorkspace.name}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setCurrentWorkspace(ws)}
                  className={cn(
                    ws.id === currentWorkspace.id && "bg-accent"
                  )}
                >
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary mr-2">
                    {ws.name[0]}
                  </div>
                  {ws.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/workspace/new" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create Workspace
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-muted-foreground h-9"
          >
            <Search className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={location.pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {/* Notifications */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-start px-3")}>
          <NotificationInbox />
          {!collapsed && <span className="ml-3 text-sm">Notifications</span>}
        </div>

        <NavItem
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          href="/settings"
          active={location.pathname === "/settings"}
          collapsed={collapsed}
        />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDarkMode}
          className={cn(
            "w-full justify-start gap-3",
            collapsed && "justify-center px-0"
          )}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </Button>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full h-auto py-2",
                collapsed ? "justify-center px-0" : "justify-start gap-3"
              )}
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">
                    {user?.user_metadata?.full_name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings/profile">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
