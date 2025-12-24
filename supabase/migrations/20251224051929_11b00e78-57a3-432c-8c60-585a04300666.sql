-- Create enums for various statuses and types
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled');
CREATE TYPE public.project_status AS ENUM ('active', 'on_hold', 'completed', 'archived');
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace members table
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

-- Function to check workspace role
CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id UUID, _workspace_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id 
      AND workspace_id = _workspace_id
      AND role = _role
  )
$$;

-- Workspace RLS policies
CREATE POLICY "Members can view their workspaces" ON public.workspaces
  FOR SELECT TO authenticated 
  USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and owners can update workspace" ON public.workspaces
  FOR UPDATE TO authenticated 
  USING (
    public.has_workspace_role(auth.uid(), id, 'owner') OR 
    public.has_workspace_role(auth.uid(), id, 'admin')
  );

-- Workspace members RLS policies
CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT TO authenticated 
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Owners/admins can manage members" ON public.workspace_members
  FOR ALL TO authenticated
  USING (
    public.has_workspace_role(auth.uid(), workspace_id, 'owner') OR 
    public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  );

CREATE POLICY "Users can insert themselves as owner" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'owner');

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prefix TEXT NOT NULL,
  status project_status NOT NULL DEFAULT 'active',
  color TEXT DEFAULT '#6366f1',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view projects" ON public.projects
  FOR SELECT TO authenticated 
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create projects" ON public.projects
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can update projects" ON public.projects
  FOR UPDATE TO authenticated 
  USING (
    public.has_workspace_role(auth.uid(), workspace_id, 'owner') OR 
    public.has_workspace_role(auth.uid(), workspace_id, 'admin') OR
    public.has_workspace_role(auth.uid(), workspace_id, 'member')
  );

-- Labels table
CREATE TABLE public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view labels" ON public.labels
  FOR SELECT TO authenticated 
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage labels" ON public.labels
  FOR ALL TO authenticated 
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'backlog',
  priority task_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  task_number INTEGER NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Function to get workspace_id from project
CREATE OR REPLACE FUNCTION public.get_project_workspace(_project_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.projects WHERE id = _project_id
$$;

CREATE POLICY "Workspace members can view tasks" ON public.tasks
  FOR SELECT TO authenticated 
  USING (public.is_workspace_member(auth.uid(), public.get_project_workspace(project_id)));

CREATE POLICY "Workspace members can create tasks" ON public.tasks
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_workspace_member(auth.uid(), public.get_project_workspace(project_id)));

CREATE POLICY "Workspace members can update tasks" ON public.tasks
  FOR UPDATE TO authenticated 
  USING (public.is_workspace_member(auth.uid(), public.get_project_workspace(project_id)));

CREATE POLICY "Workspace members can delete tasks" ON public.tasks
  FOR DELETE TO authenticated 
  USING (public.is_workspace_member(auth.uid(), public.get_project_workspace(project_id)));

-- Task labels junction table
CREATE TABLE public.task_labels (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage task labels" ON public.task_labels
  FOR ALL TO authenticated 
  USING (public.is_workspace_member(auth.uid(), public.get_project_workspace(
    (SELECT project_id FROM public.tasks WHERE id = task_id)
  )));

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view comments" ON public.comments
  FOR SELECT TO authenticated 
  USING (public.is_workspace_member(auth.uid(), public.get_project_workspace(
    (SELECT project_id FROM public.tasks WHERE id = task_id)
  )));

CREATE POLICY "Workspace members can create comments" ON public.comments
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);

-- Activity log table
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view activity" ON public.activity_log
  FOR SELECT TO authenticated 
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "System can insert activity" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;