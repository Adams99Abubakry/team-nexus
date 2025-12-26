-- Fix workspace creation: need to insert workspace AND member in a transaction
-- The issue is that the workspace RLS requires the user to be a member, but the member can't be added until workspace exists
-- Solution: Create a database function to handle atomic workspace creation

-- Create function to atomically create workspace with owner
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  _name text,
  _slug text,
  _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id uuid;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert workspace
  INSERT INTO public.workspaces (name, slug, description, created_by)
  VALUES (_name, _slug, _description, _user_id)
  RETURNING id INTO _workspace_id;

  -- Add creator as owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, _user_id, 'owner');

  RETURN _workspace_id;
END;
$$;

-- Create team_invitations table for email invitations
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES public.profiles(id),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins can manage invitations"
ON public.team_invitations
FOR ALL
USING (
  has_workspace_role(auth.uid(), workspace_id, 'owner') OR 
  has_workspace_role(auth.uid(), workspace_id, 'admin')
);

CREATE POLICY "Users can view their own invitations"
ON public.team_invitations
FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create time_entries table for time tracking
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  description text,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  duration_minutes integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage time entries"
ON public.time_entries
FOR ALL
USING (
  is_workspace_member(auth.uid(), get_project_workspace((SELECT project_id FROM tasks WHERE id = task_id)))
);

-- Create file_attachments table
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage attachments"
ON public.file_attachments
FOR ALL
USING (
  is_workspace_member(auth.uid(), 
    COALESCE(
      get_project_workspace(project_id),
      get_project_workspace((SELECT project_id FROM tasks WHERE id = task_id))
    )
  )
);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;