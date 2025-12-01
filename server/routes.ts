import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { clerk, protectedRoute } from "./lib/clerk";
import { generateContent, generateAutoReply } from "./lib/openai";
import { exchangeCodeForToken, getInstagramUserInfo, getLongLivedToken, refreshLongLivedToken, getInstagramCallbackUrl, getUserMedia, sendPrivateReply, getCommentDetails, getFacebookCallbackUrl, exchangeFacebookCodeForToken, getFacebookLongLivedToken, getFacebookPages, getInstagramBusinessAccount, replyToComment, sendDirectMessage, sendDirectMessageWithButtons, type DMLink } from "./lib/instagram";

function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value || '');
  }
  return result;
}

function formatLinksAsButtons(links: Array<{ label?: string; url: string; isButton?: boolean }>): string {
  if (!links || links.length === 0) return '';
  
  let formatted = '\n\n';
  for (const link of links) {
    if (link.label) {
      formatted += `🔗 ${link.label}\n👉 ${link.url}\n\n`;
    } else {
      formatted += `👉 ${link.url}\n\n`;
    }
  }
  return formatted.trim();
}

function isWithinSchedule(config: any): boolean {
  if (!config?.scheduleEnabled) return true;
  
  const now = new Date();
  const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  
  if (config.scheduleDays && config.scheduleDays.length > 0) {
    const normalizedDays = config.scheduleDays.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());
    if (!normalizedDays.includes(currentDay)) {
      return false;
    }
  }
  
  if (config.scheduleStartTime && config.scheduleEndTime) {
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const [startH, startM] = config.scheduleStartTime.split(':').map(Number);
    const [endH, endM] = config.scheduleEndTime.split(':').map(Number);
    const startTime = startH * 100 + (startM || 0);
    const endTime = endH * 100 + (endM || 0);
    
    if (startTime <= endTime) {
      // Normal daytime range (e.g., 9:00 to 17:00)
      if (currentTime < startTime || currentTime > endTime) {
        return false;
      }
    } else {
      // Overnight range (e.g., 22:00 to 06:00)
      // Current time must be >= start OR <= end
      if (currentTime < startTime && currentTime > endTime) {
        return false;
      }
    }
  }
  
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
import { insertAutomationSchema, insertGeneratedContentSchema, insertActivityLogSchema } from "@shared/schema";
import { z } from "zod";
import "./types";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Apply Clerk middleware globally
  app.use(clerk);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ========================================
  // USER ROUTES
  // ========================================
  
  // Get or create current user
  app.get("/api/user", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      if (!clerkId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let user = await storage.getUserByClerkId(clerkId);
      
      if (!user) {
        // Create new user from Clerk data
        const clerkUser = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
          headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`
          }
        }).then(r => r.json());

        user = await storage.createUser({
          clerkId,
          email: clerkUser.email_addresses?.[0]?.email_address || `user-${clerkId}@instaflow.local`
        });
      }

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // INSTAGRAM OAUTH ROUTES
  // ========================================

  // Get connected Instagram accounts
  app.get("/api/instagram/accounts", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const accounts = await storage.getInstagramAccountsByUserId(user.id);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Instagram account media (posts/reels)
  app.get("/api/instagram/accounts/:accountId/media", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const accounts = await storage.getInstagramAccountsByUserId(user.id);
      const account = accounts.find(a => a.id === req.params.accountId);
      
      if (!account) {
        return res.status(404).json({ message: "Instagram account not found" });
      }

      const media = await getUserMedia(account.accessToken, account.instagramUserId);
      res.json(media);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete/disconnect Instagram account
  app.delete("/api/instagram/accounts/:accountId", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const accounts = await storage.getInstagramAccountsByUserId(user.id);
      const account = accounts.find(a => a.id === req.params.accountId);
      
      if (!account) {
        return res.status(404).json({ message: "Instagram account not found" });
      }

      // Backup automations before disconnecting (so they can be restored later)
      const automations = await storage.getAutomationsByInstagramAccountId(account.id);
      if (automations.length > 0) {
        const backupData = automations.map(a => ({
          type: a.type,
          title: a.title,
          description: a.description,
          config: a.config,
          stats: a.stats,
          isActive: a.isActive,
        }));
        await storage.backupAutomations(user.id, account.instagramUserId, backupData);
        console.log(`Backed up ${automations.length} automations for Instagram account ${account.username}`);
      }

      // Delete automations from primary table
      for (const automation of automations) {
        await storage.deleteAutomation(automation.id);
      }

      // Deactivate the Instagram account (soft delete)
      await storage.deactivateInstagramAccount(account.id);
      res.json({ message: "Account disconnected successfully. Your automations have been saved and will be restored when you reconnect." });
    } catch (error: any) {
      console.error("Error disconnecting Instagram account:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get Instagram OAuth URL (ensures consistent redirect URI)
  app.get("/api/instagram/oauth/url", protectedRoute, (req, res) => {
    const callbackUrl = getInstagramCallbackUrl(req);
    
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const scope = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights";
    
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&response_type=code`;
    
    res.json({ 
      authUrl, 
      callbackUrl,
      clientId 
    });
  });

  // Instagram OAuth callback endpoint
  app.get("/api/instagram/oauth/callback", clerk, async (req, res) => {
    try {
      const { code, error, error_reason } = req.query;

      if (error) {
        const errorValue = Array.isArray(error_reason) ? error_reason[0] : (error_reason || error);
        const errorMsg = typeof errorValue === 'string' ? errorValue : 'connection_failed';
        return res.redirect(`/settings?error=${encodeURIComponent(errorMsg)}`);
      }

      if (!code) {
        return res.redirect("/settings?error=no_code");
      }

      // Get the authenticated user from Clerk session
      const auth = req.auth();
      const clerkId = auth.userId;

      if (!clerkId) {
        return res.redirect("/auth");
      }

      let user = await storage.getUserByClerkId(clerkId);
      if (!user) {
        // Create user if doesn't exist
        user = await storage.createUser({
          clerkId,
          email: `user-${clerkId}@instaflow.local`
        });
      }

      // Exchange code for token - use centralized callback URL
      const callbackUrl = getInstagramCallbackUrl(req);
      
      console.log("Instagram OAuth callback URL:", callbackUrl);
      const tokenData = await exchangeCodeForToken(code as string, callbackUrl);

      // Try to get long-lived token, but fall back to short-lived if it fails
      let accessToken = tokenData.access_token;
      let expiresIn = 3600; // Default 1 hour for short-lived tokens
      
      try {
        const longLivedToken = await getLongLivedToken(tokenData.access_token);
        accessToken = longLivedToken.access_token;
        expiresIn = longLivedToken.expires_in || 5184000; // ~60 days for long-lived
        console.log("Successfully obtained long-lived token");
      } catch (longTokenError: any) {
        console.log("Could not get long-lived token, using short-lived token:", longTokenError?.message);
        // Continue with short-lived token - it's still valid for 1 hour
      }

      // Get user info
      const userInfo = await getInstagramUserInfo(accessToken, tokenData.user_id.toString());

      // Check if this account was previously deactivated (disconnected)
      const deactivatedAccount = await storage.getDeactivatedInstagramAccount(user.id, userInfo.id);
      
      if (deactivatedAccount) {
        // Reactivate the existing account
        await storage.reactivateInstagramAccount(deactivatedAccount.id, accessToken, expiresIn);
        console.log(`Reactivated Instagram account: ${userInfo.username}`);
        
        // Check for backed up automations and restore them
        const backup = await storage.getAutomationBackup(user.id, userInfo.id);
        if (backup && backup.automationData && Array.isArray(backup.automationData)) {
          console.log(`Restoring ${backup.automationData.length} automations from backup`);
          
          for (const autoData of backup.automationData) {
            await storage.createAutomation({
              userId: user.id,
              instagramAccountId: deactivatedAccount.id,
              type: autoData.type,
              title: autoData.title,
              description: autoData.description,
              config: autoData.config,
              stats: autoData.stats,
              isActive: false, // Start as inactive, user can re-enable
            });
          }
          
          // Delete the backup after successful restore
          await storage.deleteAutomationBackup(user.id, userInfo.id);
          console.log("Automations restored and backup cleared");
        }
      } else {
        // Save new account to database (upsert to prevent duplicates)
        await storage.upsertInstagramAccount({
          userId: user.id,
          instagramUserId: userInfo.id,
          username: userInfo.username,
          accessToken: accessToken,
          expiresIn: expiresIn
        });
      }

      // Redirect back to settings with success
      res.redirect("/settings?success=instagram_connected");
    } catch (error: any) {
      console.error("Instagram OAuth callback error:", error);
      res.redirect(`/settings?error=${encodeURIComponent(error?.message || "Connection failed")}`);
    }
  });

  // Connect Instagram account (API endpoint for direct connection)
  app.post("/api/instagram/connect", protectedRoute, async (req, res) => {
    try {
      const { code, redirectUri } = req.body;
      const auth = req.auth();
      const clerkId = auth.userId;

      const user = await storage.getUserByClerkId(clerkId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Exchange code for token
      const tokenData = await exchangeCodeForToken(code, redirectUri);

      // Try to get long-lived token, but fall back to short-lived if it fails
      let accessToken = tokenData.access_token;
      let expiresIn = 3600;
      
      try {
        const longLivedToken = await getLongLivedToken(tokenData.access_token);
        accessToken = longLivedToken.access_token;
        expiresIn = longLivedToken.expires_in || 5184000;
      } catch (e) {
        // Continue with short-lived token
      }

      // Get user info
      const userInfo = await getInstagramUserInfo(accessToken, tokenData.user_id.toString());

      let account;
      
      // Check if this account was previously deactivated (disconnected)
      const deactivatedAccount = await storage.getDeactivatedInstagramAccount(user.id, userInfo.id);
      
      if (deactivatedAccount) {
        // Reactivate the existing account
        await storage.reactivateInstagramAccount(deactivatedAccount.id, accessToken, expiresIn);
        console.log(`Reactivated Instagram account: ${userInfo.username}`);
        account = deactivatedAccount;
        
        // Check for backed up automations and restore them
        const backup = await storage.getAutomationBackup(user.id, userInfo.id);
        if (backup && backup.automationData && Array.isArray(backup.automationData)) {
          console.log(`Restoring ${backup.automationData.length} automations from backup`);
          
          for (const autoData of backup.automationData) {
            await storage.createAutomation({
              userId: user.id,
              instagramAccountId: deactivatedAccount.id,
              type: autoData.type,
              title: autoData.title,
              description: autoData.description,
              config: autoData.config,
              stats: autoData.stats,
              isActive: false, // Start as inactive, user can re-enable
            });
          }
          
          // Delete the backup after successful restore
          await storage.deleteAutomationBackup(user.id, userInfo.id);
          console.log("Automations restored and backup cleared");
        }
      } else {
        // Save new account to database (upsert to prevent duplicates)
        account = await storage.upsertInstagramAccount({
          userId: user.id,
          instagramUserId: userInfo.id,
          username: userInfo.username,
          accessToken: accessToken,
          expiresIn: expiresIn
        });
      }

      res.json(account);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // AUTOMATION ROUTES
  // ========================================

  // Get all automations for user
  app.get("/api/automations", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const automations = await storage.getAutomationsByUserId(user.id);
      res.json(automations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create automation
  app.post("/api/automations", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const data = insertAutomationSchema.parse({ ...req.body, userId: user.id });
      const automation = await storage.createAutomation(data);
      
      res.json(automation);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update automation
  app.patch("/api/automations/:id", protectedRoute, async (req, res) => {
    try {
      const { id } = req.params;
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const automation = await storage.getAutomation(id);
      if (!automation || automation.userId !== user.id) {
        return res.status(404).json({ message: "Automation not found" });
      }

      await storage.updateAutomation(id, req.body);
      const updated = await storage.getAutomation(id);
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete automation
  app.delete("/api/automations/:id", protectedRoute, async (req, res) => {
    try {
      const { id } = req.params;
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const automation = await storage.getAutomation(id);
      if (!automation || automation.userId !== user.id) {
        return res.status(404).json({ message: "Automation not found" });
      }

      // Delete associated queue items first
      await storage.deleteQueueItemsByAutomationId(id);
      
      // Then delete the automation
      await storage.deleteAutomation(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting automation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // CONTENT GENERATION ROUTES
  // ========================================

  // Generate content
  app.post("/api/content/generate", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { topic, tone, additionalInstructions } = req.body;
      
      if (!topic) {
        return res.status(400).json({ message: "Topic is required" });
      }

      const generatedText = await generateContent({ topic, tone, additionalInstructions });
      
      const content = await storage.createGeneratedContent({
        userId: user.id,
        topic,
        tone,
        additionalInstructions,
        generatedText
      });

      res.json(content);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get generated content history
  app.get("/api/content/history", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const content = await storage.getGeneratedContent(user.id, limit);
      
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // DASHBOARD METRICS ROUTES
  // ========================================

  // Get dashboard metrics
  app.get("/api/metrics", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get connected Instagram accounts
      const accounts = await storage.getInstagramAccountsByUserId(user.id);
      
      // Get automations and activity
      const automations = await storage.getAutomationsByUserId(user.id);
      const activities = await storage.getActivityLog(user.id, 100);
      
      // Calculate total replies from all automations
      let totalReplies = 0;
      for (const automation of automations) {
        const stats = automation.stats as any;
        totalReplies += stats?.totalReplies || 0;
      }

      // Calculate activity by day for the chart (last 7 days) based on actual data
      const now = new Date();
      const weekData = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayActivities = activities.filter(a => {
          const activityDate = new Date(a.createdAt);
          return activityDate >= dayStart && activityDate <= dayEnd;
        });
        
        weekData.push({
          name: days[dayStart.getDay()],
          date: dayStart.toISOString().split('T')[0],
          value: dayActivities.length,
          dmsSent: dayActivities.filter(a => a.action === 'dm_sent').length,
          commentsProcessed: dayActivities.filter(a => a.action === 'comment_processed').length,
        });
      }

      res.json({
        accounts: accounts.map(a => ({
          id: a.id,
          username: a.username,
          instagramUserId: a.instagramUserId,
        })),
        stats: {
          totalAccounts: accounts.length,
          activeAutomations: automations.filter(a => a.isActive).length,
          totalAutomations: automations.length,
          totalReplies,
          totalActivities: activities.length,
        },
        chartData: weekData,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // ACTIVITY LOG ROUTES
  // ========================================

  // Get activity log
  app.get("/api/activity", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const activities = await storage.getActivityLog(user.id, limit);
      
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // SCHEDULED MESSAGES ROUTES
  // ========================================

  // Get all scheduled messages for user
  app.get("/api/scheduled-messages", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const messages = await storage.getScheduledMessagesByUserId(user.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create scheduled message
  app.post("/api/scheduled-messages", protectedRoute, async (req, res) => {
    try {
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { instagramAccountId, recipientInstagramId, recipientUsername, message, links, scheduledFor, note } = req.body;
      
      // Require either recipientInstagramId or recipientUsername
      if (!instagramAccountId || (!recipientInstagramId && !recipientUsername) || !message || !scheduledFor) {
        return res.status(400).json({ message: "Missing required fields. Provide either Instagram ID or username." });
      }

      const accounts = await storage.getInstagramAccountsByUserId(user.id);
      const selectedAccount = accounts.find(a => a.id === instagramAccountId);
      if (!selectedAccount) {
        return res.status(403).json({ message: "Instagram account not found or not yours" });
      }

      // If no recipientInstagramId provided, try to look up from follower tracking
      let finalRecipientId = recipientInstagramId;
      const cleanUsername = recipientUsername?.replace('@', '').toLowerCase();
      
      if (!finalRecipientId && cleanUsername) {
        // Try to find the user's Instagram ID from follower tracking
        const follower = await storage.getFollowerByUsername(selectedAccount.id, cleanUsername);
        if (follower && follower.followerInstagramId) {
          finalRecipientId = follower.followerInstagramId;
          console.log(`Resolved username @${cleanUsername} to Instagram ID: ${finalRecipientId}`);
        } else {
          console.log(`Username @${cleanUsername} not found in followers - will store and try to resolve later`);
          // Store without ID - will try to resolve when sending
          finalRecipientId = `pending:${cleanUsername}`;
        }
      }

      const scheduled = await storage.createScheduledMessage({
        userId: user.id,
        instagramAccountId,
        recipientInstagramId: finalRecipientId,
        recipientUsername: cleanUsername || recipientUsername,
        message,
        links,
        scheduledFor: new Date(scheduledFor),
        note,
        status: "pending"
      });

      res.json(scheduled);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update scheduled message
  app.patch("/api/scheduled-messages/:id", protectedRoute, async (req, res) => {
    try {
      const { id } = req.params;
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const messages = await storage.getScheduledMessagesByUserId(user.id);
      const message = messages.find(m => m.id === id);
      
      if (!message) {
        return res.status(404).json({ message: "Scheduled message not found" });
      }

      if (message.status !== "pending") {
        return res.status(400).json({ message: "Can only update pending messages" });
      }

      const updates: any = {};
      if (req.body.message !== undefined) updates.message = req.body.message;
      if (req.body.links !== undefined) updates.links = req.body.links;
      if (req.body.scheduledFor !== undefined) updates.scheduledFor = new Date(req.body.scheduledFor);
      if (req.body.note !== undefined) updates.note = req.body.note;
      if (req.body.recipientInstagramId !== undefined) updates.recipientInstagramId = req.body.recipientInstagramId;
      if (req.body.recipientUsername !== undefined) updates.recipientUsername = req.body.recipientUsername;

      await storage.updateScheduledMessage(id, updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete scheduled message
  app.delete("/api/scheduled-messages/:id", protectedRoute, async (req, res) => {
    try {
      const { id } = req.params;
      const auth = req.auth();
      const clerkId = auth.userId;
      const user = await storage.getUserByClerkId(clerkId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const messages = await storage.getScheduledMessagesByUserId(user.id);
      const message = messages.find(m => m.id === id);
      
      if (!message) {
        return res.status(404).json({ message: "Scheduled message not found" });
      }

      await storage.deleteScheduledMessage(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // INSTAGRAM WEBHOOK ROUTES
  // ========================================

  // Webhook verification (GET)
  app.get("/api/webhooks/instagram", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  // Webhook handler (POST)
  app.post("/api/webhooks/instagram", async (req, res) => {
    try {
      const body = req.body;
      console.log("Webhook received:", JSON.stringify(body, null, 2));

      if (body.object === "instagram") {
        for (const entry of body.entry) {
          const igUserId = entry.id;
          
          // Handle comment webhooks (using entry.changes)
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              console.log("Processing change:", change.field);
              
              if (change.field === "comments") {
              // Handle new comment
              const commentData = change.value;
              console.log("Received comment:", commentData);
              
              // Find Instagram account - try business ID first, then regular ID
              let account = await storage.getInstagramAccountByBusinessId(igUserId);
              
              if (!account) {
                // Try by regular Instagram user ID
                account = await storage.getInstagramAccountByInstagramUserId(igUserId);
              }
              
              // If still not found, try to find account by matching the media ID in automations
              if (!account && commentData.media?.id) {
                console.log("Trying to find account by media ID in automations:", commentData.media.id);
                const allAutomations = await storage.getAllActiveAutomations();
                for (const automation of allAutomations) {
                  const config = automation.config as any;
                  // Check if this automation targets this media or has no media filter (all posts)
                  if (automation.type === "comment_to_dm" && 
                      (!config?.mediaId || config.mediaId === commentData.media.id)) {
                    account = await storage.getInstagramAccount(automation.instagramAccountId);
                    if (account) {
                      console.log("Found account via automation media match:", account.username);
                      break;
                    }
                  }
                }
              }
              
              if (!account) {
                console.log("No matching Instagram account found for webhook business ID:", igUserId);
                console.log("User may need to reconnect their Instagram account to link the business ID.");
                continue;
              }
              
              // If account found but doesn't have business ID set, update it for faster future lookups
              if (!account.igBusinessAccountId) {
                console.log("Linking business ID to account:", account.id);
                await storage.updateInstagramAccountBusinessId(account.id, igUserId);
              }

              // Get active comment_to_dm automations for this account
              const automations = await storage.getAutomationsByInstagramAccountId(account.id);
              const activeCommentAutomations = automations.filter(
                a => a.isActive && a.type === "comment_to_dm"
              );

              for (const automation of activeCommentAutomations) {
                const config = automation.config as any;
                const keywords = config?.keywords || [];
                const messageTemplate = config?.messageTemplate || "";
                const targetMediaId = config?.mediaId;

                // Check schedule - skip if outside active hours
                if (!isWithinSchedule(config)) {
                  console.log(`Automation "${automation.title}" skipped - outside scheduled hours`);
                  continue;
                }

                // Check if this comment is on the target media (if specified)
                if (targetMediaId && commentData.media?.id !== targetMediaId) {
                  continue;
                }

                // Check if comment contains any trigger keywords
                const commentText = (commentData.text || "").toLowerCase();
                const matchedKeyword = keywords.find((kw: string) => 
                  commentText.includes(kw.toLowerCase())
                );

                if (matchedKeyword) {
                  console.log(`Keyword "${matchedKeyword}" matched in comment`);
                  
                  const commenterUsername = commentData.from?.username || "friend";
                  const followersOnly = config?.followersOnly || false;
                  const fallbackCommentMessage = config?.fallbackCommentMessage || "";
                  const delaySeconds = config?.delaySeconds || 0;
                  const links = config?.links || [];
                  
                  // Replace template variables
                  const templateVars = {
                    username: commenterUsername,
                    keyword: matchedKeyword,
                  };
                  
                  let processedMessage = replaceTemplateVariables(messageTemplate, templateVars);
                  
                  // Format links as prominent buttons
                  if (links.length > 0) {
                    processedMessage += formatLinksAsButtons(links);
                  }
                  
                  // Add to queue for reliable processing
                  try {
                    await storage.addToQueue({
                      automationId: automation.id,
                      userId: account.userId,
                      payload: {
                        commentId: commentData.id,
                        commentText: commentData.text,
                        commenterUsername: commentData.from?.username,
                        commenterUserId: commentData.from?.id,
                        mediaId: commentData.media?.id,
                        messageType: "comment_to_dm",
                      },
                      status: "pending",
                      scheduledFor: new Date(Date.now() + (delaySeconds * 1000)),
                    });
                    console.log(`Added comment automation to queue for ${commentData.from?.username}`);
                  } catch (queueError: any) {
                    console.log("Queue not available, processing immediately");
                  }
                  
                  // Apply delay if configured
                  if (delaySeconds > 0) {
                    console.log(`Waiting ${delaySeconds} seconds before sending...`);
                    await delay(delaySeconds * 1000);
                  }
                  
                  // Process immediately
                  try {
                    const accessToken = account.accessToken;
                    const igBusinessId = account.igBusinessAccountId || igUserId;
                    
                    if (!accessToken) {
                      throw new Error("Account access token is missing");
                    }
                    
                    // If followers only is enabled, we'll try to send DM first
                    // If it fails (user doesn't follow), we'll reply with fallback comment
                    let dmSent = false;
                    let dmError: any = null;
                    
                    try {
                      console.log("Sending DM to commenter:", commenterUsername);
                      await sendPrivateReply(
                        accessToken,
                        igBusinessId,
                        commentData.id,
                        processedMessage
                      );
                      dmSent = true;
                      console.log("DM sent successfully to", commenterUsername);
                    } catch (dmErr: any) {
                      dmError = dmErr;
                      console.log("DM could not be sent:", dmErr?.response?.data?.error?.message || dmErr?.message);
                    }
                    
                    // If followers only mode and DM failed, post fallback comment
                    if (!dmSent && followersOnly && fallbackCommentMessage) {
                      const processedFallback = replaceTemplateVariables(fallbackCommentMessage, templateVars);
                      console.log("Posting fallback comment for non-follower");
                      try {
                        await replyToComment(accessToken, commentData.id, processedFallback);
                        console.log("Fallback comment posted successfully");
                      } catch (fallbackErr: any) {
                        console.log("Fallback comment failed:", fallbackErr?.message);
                      }
                    }
                    
                    // Send public comment reply if enabled (regardless of DM status)
                    if (config?.commentReplyEnabled && config?.commentReplyTemplate) {
                      const processedCommentReply = replaceTemplateVariables(config.commentReplyTemplate, templateVars);
                      try {
                        await replyToComment(accessToken, commentData.id, processedCommentReply);
                        console.log("Public comment reply sent");
                      } catch (commentReplyError: any) {
                        console.log("Comment reply failed:", commentReplyError?.message);
                      }
                    }

                    // Update automation stats
                    const currentStats = automation.stats as any || {};
                    await storage.updateAutomation(automation.id, {
                      stats: {
                        ...currentStats,
                        totalReplies: (currentStats.totalReplies || 0) + 1,
                        lastTriggered: new Date().toISOString(),
                      }
                    });

                    // Log activity
                    await storage.createActivityLog({
                      userId: account.userId,
                      automationId: automation.id,
                      action: dmSent ? "dm_sent" : "comment_reply_sent",
                      targetUsername: commenterUsername,
                      details: dmSent 
                        ? `Sent DM for keyword "${matchedKeyword}"` 
                        : `Posted comment reply for "${matchedKeyword}" (user not following)`,
                    });
                  } catch (sendError: any) {
                    console.log("Automation processing error:", sendError?.message);
                  }
                }
              }
              } else if (change.field === "messages") {
                // Handle new message from changes
                const message = change.value;
                console.log("Received message from changes:", message);
              }
            }
          }
          
          // Handle DM webhooks (using entry.messaging)
          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const messageEvent of entry.messaging) {
              console.log("Processing messaging event:", messageEvent);
              
              const senderId = messageEvent.sender?.id;
              const messageText = messageEvent.message?.text;
              
              if (senderId && messageText) {
                console.log(`DM from ${senderId}: ${messageText}`);
                
                // Find Instagram account for this recipient using business account ID
                // The webhook sends igBusinessAccountId, not instagramUserId
                const account = await storage.getInstagramAccountByBusinessId(igUserId);
                
                if (!account) {
                  console.log("No matching Instagram account found for business ID:", igUserId);
                  continue;
                }
                
                console.log("Found matching account:", account.username);

                // Get active auto_dm_reply and welcome_message automations for this account
                const automations = await storage.getAutomationsByInstagramAccountId(account.id);
                const activeDmAutomations = automations.filter(
                  (a: any) => a.isActive && (a.type === "auto_dm_reply" || a.type === "welcome_message" || a.type === "mention_reply")
                );

                for (const automation of activeDmAutomations) {
                  const config = automation.config as any;
                  const triggerWords = config?.keywords || config?.triggerWords || [];
                  const messageTemplate = config?.messageTemplate || "";
                  const links = config?.links || [];
                  const delaySeconds = config?.delaySeconds || 0;
                  
                  // Check schedule
                  if (!isWithinSchedule(config)) {
                    console.log(`Automation ${automation.title} skipped - outside schedule`);
                    continue;
                  }
                  
                  const isWelcomeMessage = automation.type === "welcome_message";

                  const messageTextLower = messageText.toLowerCase();
                  const matchedKeyword = triggerWords.find((tw: string) => messageTextLower.includes(tw.toLowerCase()));
                  const keywordMatch = triggerWords.length === 0 || matchedKeyword;
                  
                  const shouldRespond = isWelcomeMessage || keywordMatch;

                  if (shouldRespond && messageTemplate) {
                    console.log(`${automation.type} triggered for automation:`, automation.title);
                    
                    // For welcome automation, check cooldown
                    if (isWelcomeMessage) {
                      const cooldownDays = config?.welcomeCooldownDays || 7;
                      const canSend = await storage.canSendWelcomeMessage(account.id, senderId, cooldownDays);
                      
                      if (!canSend) {
                        console.log(`Welcome message skipped for ${senderId} - within ${cooldownDays} day cooldown`);
                        continue;
                      }
                    }
                    
                    // Apply delay if configured
                    if (delaySeconds > 0) {
                      console.log(`Waiting ${delaySeconds} seconds before sending...`);
                      await delay(delaySeconds * 1000);
                    }
                    
                    try {
                      const templateVars = {
                        username: senderId,
                        keyword: matchedKeyword || '',
                      };
                      
                      const replyMessage = replaceTemplateVariables(messageTemplate, templateVars);
                      
                      console.log("Sending DM reply with button support");
                      
                      // Use button-enabled function if any links are marked as buttons
                      const hasButtonLinks = links.some((l: any) => l.isButton);
                      if (hasButtonLinks) {
                        await sendDirectMessageWithButtons(
                          account.accessToken,
                          senderId,
                          replyMessage,
                          links
                        );
                      } else {
                        let fullMessage = replyMessage;
                        if (links.length > 0) {
                          fullMessage += formatLinksAsButtons(links);
                        }
                        await sendDirectMessage(
                          account.accessToken,
                          senderId,
                          fullMessage
                        );
                      }
                      
                      console.log("DM reply sent successfully to", senderId);
                      
                      // For welcome message, track that we sent one
                      if (isWelcomeMessage) {
                        const existingTracking = await storage.getFollowerTracking(account.id, senderId);
                        if (existingTracking) {
                          await storage.markWelcomeMessageSent(existingTracking.id);
                        } else {
                          const newTracking = await storage.createFollowerTracking({
                            instagramAccountId: account.id,
                            followerInstagramId: senderId,
                            isFollowing: true,
                            welcomeMessageSent: true,
                            welcomeMessageSentAt: new Date(),
                            firstFollowedAt: new Date(),
                            lastFollowedAt: new Date()
                          });
                          await storage.markWelcomeMessageSent(newTracking.id);
                        }
                      }
                      
                      const currentStats = automation.stats as any || {};
                      await storage.updateAutomation(automation.id, {
                        stats: {
                          ...currentStats,
                          totalReplies: (currentStats.totalReplies || 0) + 1,
                          lastTriggered: new Date().toISOString(),
                        }
                      });
                      
                      await storage.createActivityLog({
                        userId: account.userId,
                        automationId: automation.id,
                        action: "dm_auto_reply",
                        targetUsername: senderId,
                        details: `Auto-replied to DM: "${messageText.substring(0, 50)}..."`,
                      });
                    } catch (replyError: any) {
                      console.log("DM reply could not be sent:", replyError?.response?.data?.error?.message || replyError?.message);
                    }
                  }
                }
              }
              
              // Handle story reactions
              const storyReaction = messageEvent.reaction;
              if (senderId && storyReaction) {
                console.log(`Story reaction from ${senderId}:`, storyReaction);
                
                const account = await storage.getInstagramAccountByBusinessId(igUserId);
                if (account) {
                  const automations = await storage.getAutomationsByInstagramAccountId(account.id);
                  const storyAutomations = automations.filter(
                    (a: any) => a.isActive && a.type === "story_reaction"
                  );
                  
                  for (const automation of storyAutomations) {
                    const config = automation.config as any;
                    const messageTemplate = config?.messageTemplate || "";
                    const links = config?.links || [];
                    const delaySeconds = config?.delaySeconds || 0;
                    
                    // Check schedule
                    if (!isWithinSchedule(config)) {
                      console.log(`Story reaction automation ${automation.title} skipped - outside schedule`);
                      continue;
                    }
                    
                    if (messageTemplate) {
                      console.log("Story reaction automation triggered:", automation.title);
                      
                      if (delaySeconds > 0) {
                        await delay(delaySeconds * 1000);
                      }
                      
                      try {
                        const templateVars = { username: senderId };
                        const replyMessage = replaceTemplateVariables(messageTemplate, templateVars);
                        
                        // Use button-enabled function if any links are marked as buttons
                        const hasButtonLinks = links.some((l: any) => l.isButton);
                        if (hasButtonLinks) {
                          await sendDirectMessageWithButtons(account.accessToken, senderId, replyMessage, links);
                        } else {
                          let fullMessage = replyMessage;
                          if (links.length > 0) {
                            fullMessage += formatLinksAsButtons(links);
                          }
                          await sendDirectMessage(account.accessToken, senderId, fullMessage);
                        }
                        console.log("Story reaction reply sent to", senderId);
                        
                        const currentStats = automation.stats as any || {};
                        await storage.updateAutomation(automation.id, {
                          stats: {
                            ...currentStats,
                            totalReplies: (currentStats.totalReplies || 0) + 1,
                            lastTriggered: new Date().toISOString(),
                          }
                        });
                        
                        await storage.createActivityLog({
                          userId: account.userId,
                          automationId: automation.id,
                          action: "story_reaction_reply",
                          targetUsername: senderId,
                          details: `Replied to story reaction`,
                        });
                      } catch (err: any) {
                        console.log("Story reaction reply failed:", err?.message);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      res.sendStatus(200);
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.sendStatus(500);
    }
  });

  // ========================================
  // SCHEDULED MESSAGE PROCESSOR
  // ========================================
  
  // Process scheduled messages every minute
  setInterval(async () => {
    try {
      const pendingMessages = await storage.getPendingScheduledMessages();
      
      for (const msg of pendingMessages) {
        try {
          const account = await storage.getInstagramAccount(msg.instagramAccountId);
          if (!account) {
            await storage.markScheduledMessageFailed(msg.id, "Instagram account not found");
            continue;
          }
          
          // Handle pending username resolution
          let recipientId = msg.recipientInstagramId;
          if (recipientId.startsWith('pending:')) {
            const pendingUsername = recipientId.replace('pending:', '');
            console.log(`Attempting to resolve pending username: @${pendingUsername}`);
            
            // Try to resolve from follower tracking
            const follower = await storage.getFollowerByUsername(account.id, pendingUsername);
            if (follower && follower.followerInstagramId) {
              recipientId = follower.followerInstagramId;
              console.log(`Resolved @${pendingUsername} to ID: ${recipientId}`);
              // Update the message with resolved ID for future reference
              await storage.updateScheduledMessage(msg.id, { recipientInstagramId: recipientId });
            } else {
              await storage.markScheduledMessageFailed(
                msg.id, 
                `Cannot send DM: User @${pendingUsername} has not interacted with your account. They need to message you or comment on your posts first.`
              );
              continue;
            }
          }
          
          console.log(`Processing scheduled message to ${recipientId}`);
          
          // Use button-enabled function if any links are marked as buttons
          const links = msg.links as any[] || [];
          const hasButtonLinks = links.some((l: any) => l.isButton);
          
          if (hasButtonLinks) {
            await sendDirectMessageWithButtons(
              account.accessToken,
              recipientId,
              msg.message,
              links
            );
          } else {
            let fullMessage = msg.message;
            if (links.length > 0) {
              fullMessage += "\n\n";
              for (const link of links) {
                if (link.label) {
                  fullMessage += `${link.label}\n${link.url}\n\n`;
                } else {
                  fullMessage += `${link.url}\n\n`;
                }
              }
            }
            await sendDirectMessage(account.accessToken, recipientId, fullMessage.trim());
          }
          
          await storage.markScheduledMessageProcessed(msg.id);
          
          // Log activity
          await storage.createActivityLog({
            userId: msg.userId,
            action: "scheduled_dm_sent",
            targetUsername: msg.recipientUsername || recipientId,
            details: msg.note || `Scheduled message sent: "${msg.message.substring(0, 50)}..."`,
          });
          
          console.log(`Scheduled message sent successfully to ${recipientId}`);
        } catch (err: any) {
          console.error(`Failed to send scheduled message ${msg.id}:`, err?.message);
          await storage.markScheduledMessageFailed(msg.id, err?.message || "Unknown error");
        }
      }
    } catch (err: any) {
      console.error("Error processing scheduled messages:", err?.message);
    }
  }, 60000); // Check every minute

  return httpServer;
}
