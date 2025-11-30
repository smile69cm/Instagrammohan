import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  MessageSquare, 
  Heart, 
  UserPlus, 
  MoreHorizontal,
  Plus,
  AtSign,
  Image,
  Pencil,
  Trash2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useApiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const automationTypes = {
  comment_to_dm: {
    icon: AtSign,
    color: "text-blue-600",
    bg: "bg-blue-100",
    label: "Comment to DM",
    description: "When someone comments a keyword on your post, send them a DM with a link",
  },
  auto_dm_reply: {
    icon: MessageSquare,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Auto DM Reply",
    description: "Automatically reply to DMs with AI-generated responses",
  },
  story_reaction: {
    icon: Heart,
    color: "text-accent",
    bg: "bg-accent/10",
    label: "Story Reaction",
    description: "Auto-react to stories from followers",
  },
  welcome_message: {
    icon: UserPlus,
    color: "text-secondary",
    bg: "bg-secondary/10",
    label: "Welcome Message",
    description: "Send welcome messages to new followers",
  },
};

export default function Automations() {
  const api = useApiClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<any>(null);
  const [deleteAutomation, setDeleteAutomation] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [formData, setFormData] = useState({
    type: "comment_to_dm",
    title: "",
    description: "",
    instagramAccountId: "",
    mediaId: "",
    mediaPermalink: "",
    keywords: "",
    messageTemplate: "",
    prompt: "",
  });

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.get("/automations"),
  });

  const { data: instagramAccounts = [] } = useQuery({
    queryKey: ["instagram-accounts"],
    queryFn: () => api.get("/instagram/accounts"),
  });

  const toggleMutation = useMutation({
    mutationFn: (data: { id: string; isActive: boolean }) =>
      api.patch(`/automations/${data.id}`, { isActive: data.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "Success",
        description: "Automation updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update automation",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/automations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "Success",
        description: "Automation created successfully",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create automation",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      api.patch(`/automations/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "Success",
        description: "Automation updated successfully",
      });
      setIsDialogOpen(false);
      setEditingAutomation(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update automation",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "Success",
        description: "Automation deleted successfully",
      });
      setDeleteAutomation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete automation",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      type: "comment_to_dm",
      title: "",
      description: "",
      instagramAccountId: "",
      mediaId: "",
      mediaPermalink: "",
      keywords: "",
      messageTemplate: "",
      prompt: "",
    });
    setMedia([]);
  };

  const handleToggle = (id: string, currentState: boolean) => {
    toggleMutation.mutate({ id, isActive: !currentState });
  };

  const handleSaveAutomation = () => {
    if (!formData.title || !formData.instagramAccountId) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.type === "comment_to_dm" && (!formData.keywords || !formData.messageTemplate)) {
      toast({
        title: "Missing fields",
        description: "Please enter keywords and a message template",
        variant: "destructive",
      });
      return;
    }

    const automationData = {
      type: formData.type,
      title: formData.title,
      description: formData.description,
      instagramAccountId: formData.instagramAccountId,
      config: {
        prompt: formData.prompt,
        keywords: formData.keywords ? formData.keywords.split(",").map(w => w.trim().toLowerCase()) : [],
        mediaId: formData.mediaId,
        mediaPermalink: formData.mediaPermalink,
        messageTemplate: formData.messageTemplate,
      },
    };

    if (editingAutomation) {
      updateMutation.mutate({
        id: editingAutomation.id,
        updates: automationData,
      });
    } else {
      createMutation.mutate({
        ...automationData,
        isActive: false,
      });
    }
  };

  const handleEdit = (automation: any) => {
    setEditingAutomation(automation);
    const config = automation.config || {};
    setFormData({
      type: automation.type,
      title: automation.title,
      description: automation.description || "",
      instagramAccountId: automation.instagramAccountId,
      mediaId: config.mediaId || "",
      mediaPermalink: config.mediaPermalink || "",
      keywords: config.keywords ? config.keywords.join(", ") : "",
      messageTemplate: config.messageTemplate || "",
      prompt: config.prompt || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (automation: any) => {
    setDeleteAutomation(automation);
  };

  const confirmDelete = () => {
    if (deleteAutomation) {
      deleteMutation.mutate(deleteAutomation.id);
    }
  };

  const fetchMedia = async (accountId: string) => {
    setLoadingMedia(true);
    try {
      const mediaData = await api.get(`/instagram/accounts/${accountId}/media`);
      setMedia(mediaData || []);
    } catch (error) {
      console.error("Failed to fetch media:", error);
      setMedia([]);
    }
    setLoadingMedia(false);
  };

  useEffect(() => {
    if (formData.instagramAccountId && formData.type === "comment_to_dm") {
      fetchMedia(formData.instagramAccountId);
    }
  }, [formData.instagramAccountId, formData.type]);

  const openDialog = () => {
    setEditingAutomation(null);
    resetForm();
    if (instagramAccounts.length > 0) {
      setFormData(prev => ({ ...prev, instagramAccountId: instagramAccounts[0].id }));
    }
    setIsDialogOpen(true);
  };

  const handleMediaSelect = (mediaItem: any) => {
    setFormData(prev => ({
      ...prev,
      mediaId: mediaItem.id,
      mediaPermalink: mediaItem.permalink,
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Automations</h2>
            <p className="text-muted-foreground">Manage your AI-powered interaction rules.</p>
          </div>
          <Button 
            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25" 
            data-testid="button-new-automation"
            onClick={openDialog}
            disabled={instagramAccounts.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Automation
          </Button>
        </div>

        {instagramAccounts.length === 0 && (
          <Card className="border-none shadow-sm p-6 bg-yellow-50 border-yellow-200">
            <p className="text-yellow-800">Connect an Instagram account first to create automations.</p>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-8">Loading automations...</div>
        ) : automations.length === 0 ? (
          <Card className="border-none shadow-sm p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No automations yet</h3>
            <p className="text-muted-foreground mb-6">Create your first automation to start automating your Instagram interactions.</p>
            <Button 
              className="bg-primary text-white" 
              data-testid="button-create-first-automation"
              onClick={openDialog}
              disabled={instagramAccounts.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Automation
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {automations.map((automation: any) => {
              const typeConfig = automationTypes[automation.type as keyof typeof automationTypes] || automationTypes.auto_dm_reply;
              const Icon = typeConfig.icon;
              
              return (
                <Card key={automation.id} className="border-none shadow-sm hover:shadow-md transition-all duration-200 group" data-testid={`card-automation-${automation.id}`}>
                  <div className="p-6 flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl ${typeConfig.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-8 w-8 ${typeConfig.color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold">{automation.title}</h3>
                        {automation.isActive ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Paused</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mb-2">{automation.description}</p>
                      {automation.type === "comment_to_dm" && automation.config?.keywords && (
                        <p className="text-xs text-blue-600 mb-1">
                          Keywords: {automation.config.keywords.join(", ")}
                        </p>
                      )}
                      <p className="text-xs font-medium text-muted-foreground/70">
                        {automation.stats?.totalReplies ? `${automation.stats.totalReplies} messages sent` : "No activity yet"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <Switch 
                        checked={automation.isActive} 
                        onCheckedChange={() => handleToggle(automation.id, automation.isActive)}
                        disabled={toggleMutation.isPending}
                        data-testid={`switch-automation-${automation.id}`}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid={`button-more-${automation.id}`}>
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleEdit(automation)}
                            data-testid={`button-edit-${automation.id}`}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(automation)}
                            className="text-red-600 focus:text-red-600"
                            data-testid={`button-delete-${automation.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingAutomation(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAutomation ? "Edit Automation" : "Create New Automation"}</DialogTitle>
            <DialogDescription>
              {editingAutomation ? "Update your automation settings." : "Set up an automated response for your Instagram account."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="instagram-account">Instagram Account</Label>
              <Select
                value={formData.instagramAccountId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, instagramAccountId: value }))}
                disabled={!!editingAutomation}
              >
                <SelectTrigger data-testid="select-instagram-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {instagramAccounts.map((account: any) => (
                    <SelectItem key={account.id} value={account.id}>
                      @{account.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Automation Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                disabled={!!editingAutomation}
              >
                <SelectTrigger data-testid="select-automation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(automationTypes).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {automationTypes[formData.type as keyof typeof automationTypes]?.description}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Free Guide DM"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-automation-title"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What does this automation do?"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-automation-description"
              />
            </div>

            {formData.type === "comment_to_dm" && (
              <>
                <div className="grid gap-2">
                  <Label>Select Post/Reel (Optional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Leave empty to monitor all posts, or select a specific post/reel
                  </p>
                  {loadingMedia ? (
                    <div className="text-center py-4 text-muted-foreground">Loading posts...</div>
                  ) : media.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-2">
                      <div 
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${!formData.mediaId ? 'border-primary bg-primary/10' : 'border-dashed border-gray-300 hover:border-gray-400'}`}
                        onClick={() => setFormData(prev => ({ ...prev, mediaId: "", mediaPermalink: "" }))}
                      >
                        <span className="text-xs text-center px-2">All Posts</span>
                      </div>
                      {media.map((item: any) => (
                        <div
                          key={item.id}
                          className={`aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all relative ${formData.mediaId === item.id ? 'border-primary' : 'border-transparent hover:border-gray-300'}`}
                          onClick={() => handleMediaSelect(item)}
                        >
                          {item.thumbnail_url ? (
                            <img 
                              src={item.thumbnail_url} 
                              alt={item.caption || "Instagram post"} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <Image className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground border rounded-lg">
                      No posts found. Will monitor all comments.
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="keywords">Trigger Keywords * (comma-separated)</Label>
                  <Input
                    id="keywords"
                    placeholder="e.g., link, guide, free, send"
                    value={formData.keywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                    data-testid="input-keywords"
                  />
                  <p className="text-xs text-muted-foreground">
                    When someone comments these words, they'll receive a DM
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="messageTemplate">DM Message Template *</Label>
                  <Textarea
                    id="messageTemplate"
                    placeholder="e.g., Hey! Here's your free guide: https://example.com/guide"
                    value={formData.messageTemplate}
                    onChange={(e) => setFormData(prev => ({ ...prev, messageTemplate: e.target.value }))}
                    data-testid="input-message-template"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This message will be sent as a DM to commenters
                  </p>
                </div>
              </>
            )}

            {formData.type !== "comment_to_dm" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="prompt">AI Prompt (for replies)</Label>
                  <Textarea
                    id="prompt"
                    placeholder="e.g., Be friendly and helpful. Answer questions about our products."
                    value={formData.prompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                    data-testid="input-automation-prompt"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="triggerWords">Trigger Words (comma-separated)</Label>
                  <Input
                    id="triggerWords"
                    placeholder="e.g., help, support, question"
                    value={formData.keywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                    data-testid="input-trigger-words"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to respond to all messages</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAutomation}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-automation"
            >
              {createMutation.isPending || updateMutation.isPending 
                ? "Saving..." 
                : editingAutomation 
                  ? "Save Changes" 
                  : "Create Automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAutomation} onOpenChange={(open) => !open && setDeleteAutomation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAutomation?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
