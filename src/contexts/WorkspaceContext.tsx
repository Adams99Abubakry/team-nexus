import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  loading: boolean;
  createWorkspace: (name: string, slug: string, description?: string) => Promise<Workspace | null>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setWorkspaces(data || []);
      
      if (data && data.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(data[0]);
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, [user]);

  const createWorkspace = async (name: string, slug: string, description?: string): Promise<Workspace | null> => {
    if (!user) return null;

    try {
      // Use the atomic function to create workspace with owner
      const { data: workspaceId, error } = await supabase
        .rpc('create_workspace_with_owner', {
          _name: name,
          _slug: slug,
          _description: description || null,
        });

      if (error) throw error;

      // Fetch the created workspace
      const { data: workspace, error: fetchError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (fetchError) throw fetchError;

      await refreshWorkspaces();
      setCurrentWorkspace(workspace);
      
      toast({
        title: "Workspace created",
        description: `"${name}" has been created successfully.`,
      });

      return workspace;
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace",
        variant: "destructive",
      });
      return null;
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        loading,
        createWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
