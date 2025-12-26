import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Layers } from "lucide-react";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [status, setStatus] = useState<"loading" | "success" | "error" | "login_required">("loading");
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invitation link");
      return;
    }

    if (authLoading) return;

    if (!user) {
      setStatus("login_required");
      setMessage("Please sign in to accept this invitation");
      return;
    }

    acceptInvitation();
  }, [token, user, authLoading]);

  const acceptInvitation = async () => {
    if (!token || !user) return;

    try {
      // Get the invitation
      const { data: invitation, error: fetchError } = await supabase
        .from("team_invitations")
        .select("*, workspace:workspaces(name)")
        .eq("token", token)
        .is("accepted_at", null)
        .single();

      if (fetchError || !invitation) {
        setStatus("error");
        setMessage("This invitation has expired or has already been used");
        return;
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        setStatus("error");
        setMessage("This invitation has expired");
        return;
      }

      // Check if user email matches invitation email
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        setStatus("error");
        setMessage(`This invitation was sent to ${invitation.email}. Please sign in with that email address.`);
        return;
      }

      setWorkspaceName((invitation.workspace as any)?.name || "the workspace");

      // Add user to workspace
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role,
        });

      if (memberError) {
        // Check if already a member
        if (memberError.code === "23505") {
          setStatus("error");
          setMessage("You are already a member of this workspace");
        } else {
          throw memberError;
        }
        return;
      }

      // Mark invitation as accepted
      await supabase
        .from("team_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      setStatus("success");
      setMessage(`You've been added to ${(invitation.workspace as any)?.name}`);

      // Redirect after a short delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      setStatus("error");
      setMessage(error.message || "Failed to accept invitation");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass-card animate-scale-in relative z-10">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Layers className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle>Workspace Invitation</CardTitle>
          <CardDescription>
            {status === "loading" && "Processing your invitation..."}
            {status === "login_required" && "Sign in to continue"}
            {status === "success" && "Welcome to the team!"}
            {status === "error" && "Something went wrong"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "loading" && (
            <div className="py-8">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="mt-4 text-muted-foreground">Accepting invitation...</p>
            </div>
          )}

          {status === "login_required" && (
            <div className="py-8 space-y-4">
              <p className="text-muted-foreground">{message}</p>
              <Button asChild>
                <Link to={`/auth?redirect=/accept-invite?token=${token}`}>
                  Sign In to Continue
                </Link>
              </Button>
            </div>
          )}

          {status === "success" && (
            <div className="py-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <p className="mt-4 text-lg font-medium">{message}</p>
              <p className="text-muted-foreground mt-2">Redirecting to dashboard...</p>
            </div>
          )}

          {status === "error" && (
            <div className="py-8 space-y-4">
              <XCircle className="w-16 h-16 text-destructive mx-auto" />
              <p className="text-muted-foreground">{message}</p>
              <Button asChild variant="outline">
                <Link to="/">Go to Dashboard</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
