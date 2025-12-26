import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings as SettingsIcon, User, Bell, Palette, Shield, 
  Loader2, Save, LogOut, Trash2, Building2
} from "lucide-react";

export default function Settings() {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Profile form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  // Workspace form
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [taskAssigned, setTaskAssigned] = useState(true);
  const [taskCompleted, setTaskCompleted] = useState(true);
  const [mentions, setMentions] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name);
      setWorkspaceDescription(currentWorkspace.description || "");
    }
  }, [currentWorkspace]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || user.email || "");
      setAvatarUrl(profile.avatar_url || "");
    }
    setProfileLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been saved",
      });
    }
    setLoading(false);
  };

  const handleSaveWorkspace = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    const { error } = await supabase
      .from("workspaces")
      .update({
        name: workspaceName,
        description: workspaceDescription,
      })
      .eq("id", currentWorkspace.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update workspace",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Workspace updated",
        description: "Workspace settings have been saved",
      });
      refreshWorkspaces();
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (profileLoading) {
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
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and workspace preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="workspace">
              <Building2 className="w-4 h-4 mr-2" />
              Workspace
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" />
              Theme
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-2xl">
                      {fullName?.charAt(0) || email?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Label htmlFor="avatar">Avatar URL</Label>
                    <Input
                      id="avatar"
                      placeholder="https://example.com/avatar.jpg"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveProfile} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions for your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workspace Tab */}
          <TabsContent value="workspace" className="space-y-6">
            {currentWorkspace ? (
              <Card>
                <CardHeader>
                  <CardTitle>Workspace Settings</CardTitle>
                  <CardDescription>Manage {currentWorkspace.name} settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="workspaceName">Workspace Name</Label>
                    <Input
                      id="workspaceName"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workspaceDesc">Description</Label>
                    <Textarea
                      id="workspaceDesc"
                      value={workspaceDescription}
                      onChange={(e) => setWorkspaceDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Workspace URL</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">flowboard.app/</span>
                      <Input value={currentWorkspace.slug} disabled className="bg-muted" />
                    </div>
                  </div>

                  <Button onClick={handleSaveWorkspace} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No workspace selected</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what notifications you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Task Assigned</p>
                      <p className="text-sm text-muted-foreground">
                        When a task is assigned to you
                      </p>
                    </div>
                    <Switch
                      checked={taskAssigned}
                      onCheckedChange={setTaskAssigned}
                      disabled={!emailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Task Completed</p>
                      <p className="text-sm text-muted-foreground">
                        When a task you created is completed
                      </p>
                    </div>
                    <Switch
                      checked={taskCompleted}
                      onCheckedChange={setTaskCompleted}
                      disabled={!emailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mentions</p>
                      <p className="text-sm text-muted-foreground">
                        When someone mentions you in a comment
                      </p>
                    </div>
                    <Switch
                      checked={mentions}
                      onCheckedChange={setMentions}
                      disabled={!emailNotifications}
                    />
                  </div>
                </div>

                <Button disabled>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of the app</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-3 block">Theme</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <button className="p-4 rounded-lg border-2 border-primary bg-card text-center">
                      <div className="w-8 h-8 rounded-full bg-background border mx-auto mb-2" />
                      <span className="text-sm font-medium">System</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-card text-center hover:border-primary transition-colors">
                      <div className="w-8 h-8 rounded-full bg-white border mx-auto mb-2" />
                      <span className="text-sm">Light</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-card text-center hover:border-primary transition-colors">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border mx-auto mb-2" />
                      <span className="text-sm">Dark</span>
                    </button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Theme preference can also be toggled using the button in the sidebar.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
