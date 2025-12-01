import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Calendar,
  Clock,
  Send,
  Trash2,
  Link as LinkIcon,
  User,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Gift,
  Cake,
  Info,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useApiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ScheduledMessages() {
  const api = useApiClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<any>(null);
  const [formData, setFormData] = useState({
    recipientInstagramId: "",
    recipientUsername: "",
    instagramAccountId: "",
    message: "",
    scheduledDate: "",
    scheduledTime: "",
    linkLabel: "",
    linkUrl: "",
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["instagram-accounts"],
    queryFn: () => api.get("/instagram/accounts"),
  });

  const { data: scheduledMessages = [], isLoading } = useQuery({
    queryKey: ["scheduled-messages"],
    queryFn: () => api.get("/scheduled-messages"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/scheduled-messages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Message Scheduled",
        description: "Your message has been scheduled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to schedule message",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scheduled-messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setDeleteMessage(null);
      toast({
        title: "Message Deleted",
        description: "Scheduled message has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      recipientInstagramId: "",
      recipientUsername: "",
      instagramAccountId: "",
      message: "",
      scheduledDate: "",
      scheduledTime: "",
      linkLabel: "",
      linkUrl: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.instagramAccountId) {
      toast({
        title: "Missing Account",
        description: "Please select an Instagram account",
        variant: "destructive",
      });
      return;
    }

    if (!formData.recipientUsername && !formData.recipientInstagramId) {
      toast({
        title: "Missing Recipient",
        description: "Please enter a recipient username",
        variant: "destructive",
      });
      return;
    }

    if (!formData.message.trim()) {
      toast({
        title: "Missing Message",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    if (!formData.scheduledDate || !formData.scheduledTime) {
      toast({
        title: "Missing Schedule",
        description: "Please select a date and time",
        variant: "destructive",
      });
      return;
    }

    const scheduledFor = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
    if (scheduledFor <= new Date()) {
      toast({
        title: "Invalid Time",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      recipientInstagramId: formData.recipientInstagramId,
      recipientUsername: formData.recipientUsername,
      instagramAccountId: formData.instagramAccountId,
      message: formData.message,
      scheduledFor: scheduledFor.toISOString(),
      linkLabel: formData.linkLabel || undefined,
      linkUrl: formData.linkUrl || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-500">
            <CheckCircle2 className="h-3 w-3" />
            Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a: any) => a.id === accountId);
    return account?.username || "Unknown Account";
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 px-2 md:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-bold" data-testid="text-page-title">Scheduled Messages</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Schedule DMs to be sent at specific times
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-schedule-message" size="sm" className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Schedule Message
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Gift className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    Schedule a Message
                  </DialogTitle>
                  <DialogDescription className="text-xs md:text-sm">
                    Schedule a DM to be sent at a specific date and time.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 md:gap-4 py-3 md:py-4">
                  <div className="p-2 md:p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      <strong>Note:</strong> Instagram only allows DMs to users who previously messaged your account.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="account">Instagram Account *</Label>
                    <Select
                      value={formData.instagramAccountId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, instagramAccountId: value }))}
                    >
                      <SelectTrigger data-testid="select-instagram-account">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account: any) => (
                          <SelectItem 
                            key={account.id} 
                            value={account.id}
                          >
                            @{account.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="recipientUsername">Recipient Username *</Label>
                    <Input
                      id="recipientUsername"
                      placeholder="@username"
                      value={formData.recipientUsername}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientUsername: e.target.value }))}
                      data-testid="input-recipient-username"
                    />
                    <p className="text-xs text-muted-foreground">
                      The recipient must have messaged your Instagram account before (Instagram API requirement)
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="recipientId">Recipient Instagram ID (optional)</Label>
                    <Input
                      id="recipientId"
                      placeholder="17841405793..."
                      value={formData.recipientInstagramId}
                      onChange={(e) => setFormData(prev => ({ ...prev, recipientInstagramId: e.target.value }))}
                      data-testid="input-recipient-id"
                    />
                    <p className="text-xs text-muted-foreground">
                      If you have the Instagram scoped user ID, enter it here for direct sending
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      placeholder="Happy Birthday! 🎂 Hope you have an amazing day!"
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      rows={3}
                      data-testid="input-message"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        min={format(new Date(), "yyyy-MM-dd")}
                        data-testid="input-scheduled-date"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="time">Time *</Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.scheduledTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                        data-testid="input-scheduled-time"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 p-3 border rounded-lg bg-muted/50">
                    <Label className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Link Button (Optional)
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Button label"
                        value={formData.linkLabel}
                        onChange={(e) => setFormData(prev => ({ ...prev, linkLabel: e.target.value }))}
                        data-testid="input-link-label"
                      />
                      <Input
                        placeholder="https://..."
                        value={formData.linkUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                        data-testid="input-link-url"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add a clickable button link to your message
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-schedule">
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Message
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : scheduledMessages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Cake className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Scheduled Messages</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Schedule DMs to be sent at specific times - perfect for birthday wishes, 
                promotions, or follow-ups.
              </p>
              <Button 
                className="mt-4" 
                onClick={() => setIsDialogOpen(true)}
                data-testid="button-schedule-first-message"
              >
                <Plus className="mr-2 h-4 w-4" />
                Schedule Your First Message
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="py-3 md:py-6">
              <CardTitle className="text-base md:text-lg">Upcoming Messages</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {scheduledMessages.filter((m: any) => m.status === "pending").length} pending messages
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile card view */}
              <div className="block md:hidden divide-y">
                {scheduledMessages.map((message: any) => (
                  <div key={message.id} className="p-3 space-y-2" data-testid={`scheduled-message-mobile-${message.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          {message.recipientUsername && (
                            <p className="font-medium text-sm">@{message.recipientUsername}</p>
                          )}
                          <p className="text-xs text-muted-foreground">@{getAccountName(message.instagramAccountId)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(message.status)}
                        {message.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteMessage(message)}
                            data-testid={`delete-scheduled-mobile-${message.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{message.message}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(message.scheduledFor), "MMM d, h:mm a")}</span>
                    </div>
                    {message.status === "failed" && message.error && (
                      <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{message.error}</p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledMessages.map((message: any) => (
                    <TableRow key={message.id} data-testid={`scheduled-message-${message.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            {message.recipientUsername && (
                              <p className="font-medium">@{message.recipientUsername}</p>
                            )}
                            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {message.recipientInstagramId}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="text-sm truncate">{message.message}</p>
                          {message.linkUrl && (
                            <div className="flex items-center gap-1 mt-1">
                              <LinkIcon className="h-3 w-3 text-blue-500" />
                              <span className="text-xs text-blue-500">{message.linkLabel || "Link"}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">@{getAccountName(message.instagramAccountId)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm">
                              {format(new Date(message.scheduledFor), "MMM d, yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(message.scheduledFor), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(message.status)}</TableCell>
                      <TableCell className="text-right">
                        {message.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteMessage(message)}
                            data-testid={`delete-scheduled-${message.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {message.status === "failed" && message.error && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                >
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-[300px]">
                                <p className="text-xs">{message.error}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={!!deleteMessage} onOpenChange={() => setDeleteMessage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Scheduled Message?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this scheduled message. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMessage && deleteMutation.mutate(deleteMessage.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
