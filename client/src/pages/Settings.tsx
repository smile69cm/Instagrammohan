import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { 
  Instagram,
  LogOut,
  Copy,
  Check,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useApiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const api = useApiClient();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const { data: instagramAccounts = [] } = useQuery({
    queryKey: ["instagram-accounts"],
    queryFn: () => api.get("/instagram/accounts"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (accountId: string) => api.delete(`/instagram/accounts/${accountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
      toast({
        title: "Success",
        description: "Instagram account disconnected successfully",
      });
      setDisconnecting(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to disconnect account",
        variant: "destructive",
      });
      setDisconnecting(null);
    },
  });

  const handleDisconnect = (accountId: string) => {
    setDisconnecting(accountId);
    disconnectMutation.mutate(accountId);
  };

  const { data: oauthConfig } = useQuery({
    queryKey: ["instagram-oauth-url"],
    queryFn: () => api.get("/instagram/oauth/url"),
  });

  const callbackUrl = oauthConfig?.callbackUrl || "";

  const handleCopyRedirectUri = async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleConnectInstagram = () => {
    if (!oauthConfig?.authUrl) {
      console.error("OAuth URL not available");
      return;
    }
    
    console.log("Instagram OAuth URL:", oauthConfig.authUrl);
    console.log("Redirect URI:", oauthConfig.callbackUrl);
    
    window.location.href = oauthConfig.authUrl;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">Manage your account and preferences.</p>
        </div>

        <div className="grid gap-8 max-w-4xl">
          {/* Connected Accounts */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Manage your social media connections.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {callbackUrl && (
                <Alert className="mb-4 border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <p className="font-medium mb-2">Meta Developer Console Setup</p>
                    <p className="text-sm mb-2">Add this exact URL to your Meta App's "Valid OAuth Redirect URIs":</p>
                    <div className="flex items-center gap-2 bg-white rounded-md p-2 border">
                      <code className="text-xs flex-1 break-all" data-testid="text-redirect-uri">{callbackUrl}</code>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleCopyRedirectUri}
                        data-testid="button-copy-redirect-uri"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {instagramAccounts.length > 0 ? (
                instagramAccounts.map((account: any) => (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-instagram flex items-center justify-center text-white">
                        <Instagram size={20} />
                      </div>
                      <div>
                        <p className="font-medium">@{account.username}</p>
                        <p className="text-sm text-muted-foreground">Connected via Instagram Graph API</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                      onClick={() => handleDisconnect(account.id)}
                      disabled={disconnecting === account.id}
                      data-testid={`button-disconnect-${account.id}`}
                    >
                      {disconnecting === account.id ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Instagram className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="mb-4">No Instagram accounts connected</p>
                </div>
              )}
              <Button 
                variant="outline" 
                className="w-full border-dashed" 
                onClick={handleConnectInstagram}
                data-testid="button-connect-instagram"
              >
                <Instagram className="mr-2 h-4 w-4" />
                Connect Instagram Account
              </Button>
            </CardContent>
          </Card>

          {/* Profile Settings */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input defaultValue={user?.fullName || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue={user?.primaryEmailAddress?.emailAddress || ""} disabled />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Profile details are managed through Clerk authentication.</p>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive daily digests of your automation activity.</p>
                </div>
                <Switch defaultChecked data-testid="switch-email-notifications" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automation Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when an automation is paused or fails.</p>
                </div>
                <Switch defaultChecked data-testid="switch-automation-alerts" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
