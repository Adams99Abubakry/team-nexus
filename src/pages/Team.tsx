import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, UserPlus, Mail, Shield, Crown, Eye, 
  Trash2, Loader2, Clock, XCircle, Copy, Link, CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];

interface TeamMember extends WorkspaceMember {
  profile: Profile | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

const roleIcons = {
  owner: <Crown className="w-4 h-4 text-yellow-500" />,
  admin: <Shield className="w-4 h-4 text-blue-500" />,
  member: <Users className="w-4 h-4 text-green-500" />,
  viewer: <Eye className="w-4 h-4 text-muted-foreground" />,
};

const roleBadgeColors = {
  owner: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  member: "bg-green-500/10 text-green-500 border-green-500/20",
  viewer: "bg-muted text-muted-foreground",
};

export default function Team() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const currentUserRole = members.find(m => m.user_id === user?.id)?.role;
  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";

  useEffect(() => {
    if (currentWorkspace) {
      fetchTeamData();
    }
  }, [currentWorkspace]);

  const fetchTeamData = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);

    // Fetch members with profiles
    const { data: membersData } = await supabase
      .from("workspace_members")
      .select("*, profile:profiles(*)")
      .eq("workspace_id", currentWorkspace.id);

    setMembers((membersData || []).map(m => ({
      ...m,
      profile: m.profile as Profile | null,
    })));

    // Fetch pending invitations
    const { data: invitesData } = await supabase
      .from("team_invitations")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .is("accepted_at", null);

    setInvitations(invitesData || []);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!currentWorkspace || !inviteEmail || !user) return;

    setInviting(true);
    setLastInviteLink(null);
    setLinkCopied(false);

    try {
      // Get current user's profile for the inviter name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const response = await supabase.functions.invoke("send-invitation", {
        body: {
          email: inviteEmail,
          workspaceId: currentWorkspace.id,
          workspaceName: currentWorkspace.name,
          role: inviteRole,
          inviterName: profile?.full_name || user.email || "A team member",
        },
      });

      if (response.error) throw response.error;

      const { inviteUrl, emailSent } = response.data;
      setLastInviteLink(inviteUrl);

      if (emailSent) {
        toast({
          title: "Invitation sent",
          description: `Email sent to ${inviteEmail}`,
        });
      } else {
        toast({
          title: "Invitation created",
          description: "Copy the invite link below to share with the invitee",
        });
      }

      setInviteEmail("");
      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = async () => {
    if (lastInviteLink) {
      await navigator.clipboard.writeText(lastInviteLink);
      setLinkCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link with the invitee",
      });
      setTimeout(() => setLinkCopied(false), 3000);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Member removed",
        description: "Team member has been removed",
      });
      fetchTeamData();
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from("team_invitations")
      .delete()
      .eq("id", invitationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled",
      });
      fetchTeamData();
    }
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

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <Users className="w-16 h-16 text-muted-foreground mb-4" />
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
            <h1 className="text-3xl font-bold">Team</h1>
            <p className="text-muted-foreground">
              Manage your workspace members and invitations
            </p>
          </div>
          {canManageMembers && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to add a new member to your workspace.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member - Can edit projects and tasks</SelectItem>
                        <SelectItem value="admin">Admin - Can manage workspace settings</SelectItem>
                        <SelectItem value="viewer">Viewer - Can only view content</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Show invite link after creation */}
                {lastInviteLink && (
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <Label className="flex items-center gap-2">
                      <Link className="w-4 h-4" />
                      Invite Link (share manually)
                    </Label>
                    <div className="flex gap-2">
                      <Input 
                        value={lastInviteLink} 
                        readOnly 
                        className="text-sm"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={copyInviteLink}
                      >
                        {linkCopied ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Copy and share this link via email, WhatsApp, or any messaging app
                    </p>
                  </div>
                )}
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setInviteDialogOpen(false);
                    setLastInviteLink(null);
                  }}>
                    {lastInviteLink ? "Done" : "Cancel"}
                  </Button>
                  {!lastInviteLink && (
                    <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                      {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Invitation
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{members.length}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{invitations.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Invites</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {members.filter(m => m.role === "admin" || m.role === "owner").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>People with access to this workspace</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {member.profile?.full_name?.charAt(0) || member.profile?.email?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.profile?.full_name || "Unknown"}
                        {member.user_id === user?.id && (
                          <span className="text-muted-foreground ml-2">(you)</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={roleBadgeColors[member.role as keyof typeof roleBadgeColors]}>
                      {roleIcons[member.role as keyof typeof roleIcons]}
                      <span className="ml-1 capitalize">{member.role}</span>
                    </Badge>
                    {canManageMembers && member.role !== "owner" && member.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Invitations waiting to be accepted</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {invitations.map(invitation => (
                  <div key={invitation.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Invited {format(new Date(invitation.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={roleBadgeColors[invitation.role as keyof typeof roleBadgeColors]}>
                        <span className="capitalize">{invitation.role}</span>
                      </Badge>
                      {canManageMembers && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
