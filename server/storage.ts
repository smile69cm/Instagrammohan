import { db } from "../drizzle";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import {
  users,
  instagramAccounts,
  automations,
  generatedContent,
  activityLog,
  automationBackups,
  automationQueue,
  type User,
  type InsertUser,
  type InstagramAccount,
  type InsertInstagramAccount,
  type Automation,
  type InsertAutomation,
  type GeneratedContent,
  type InsertGeneratedContent,
  type ActivityLog,
  type InsertActivityLog,
  type AutomationBackup,
  type InsertAutomationBackup,
  type AutomationQueueItem,
  type InsertAutomationQueueItem,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByClerkId(clerkId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Instagram Accounts
  getInstagramAccount(id: string): Promise<InstagramAccount | undefined>;
  getInstagramAccountsByUserId(userId: string): Promise<InstagramAccount[]>;
  getInstagramAccountByInstagramUserId(instagramUserId: string): Promise<InstagramAccount | undefined>;
  getInstagramAccountByBusinessId(igBusinessAccountId: string): Promise<InstagramAccount | undefined>;
  createInstagramAccount(account: InsertInstagramAccount): Promise<InstagramAccount>;
  upsertInstagramAccount(account: InsertInstagramAccount): Promise<InstagramAccount>;
  updateInstagramAccountToken(id: string, accessToken: string, expiresIn: number): Promise<void>;
  updateInstagramAccountBusinessId(id: string, igBusinessAccountId: string): Promise<void>;
  updateInstagramAccountPageToken(id: string, pageAccessToken: string, pageId: string): Promise<void>;
  deleteInstagramAccount(id: string): Promise<void>;
  
  // Automations
  getAutomation(id: string): Promise<Automation | undefined>;
  getAutomationsByUserId(userId: string): Promise<Automation[]>;
  getAutomationsByInstagramAccountId(accountId: string): Promise<Automation[]>;
  getAllActiveAutomations(): Promise<Automation[]>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  updateAutomation(id: string, updates: Partial<Automation>): Promise<void>;
  deleteAutomation(id: string): Promise<void>;
  
  // Generated Content
  getGeneratedContent(userId: string, limit?: number): Promise<GeneratedContent[]>;
  createGeneratedContent(content: InsertGeneratedContent): Promise<GeneratedContent>;
  
  // Activity Log
  getActivityLog(userId: string, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  // Automation Backups
  backupAutomations(userId: string, instagramUserId: string, automationData: any[]): Promise<AutomationBackup>;
  getAutomationBackup(userId: string, instagramUserId: string): Promise<AutomationBackup | undefined>;
  deleteAutomationBackup(userId: string, instagramUserId: string): Promise<void>;
  
  // Soft delete for Instagram accounts
  deactivateInstagramAccount(id: string): Promise<void>;
  reactivateInstagramAccount(id: string, accessToken: string, expiresIn: number): Promise<void>;
  getDeactivatedInstagramAccount(userId: string, instagramUserId: string): Promise<InstagramAccount | undefined>;
  
  // Automation Queue
  addToQueue(item: InsertAutomationQueueItem): Promise<AutomationQueueItem>;
  getQueuedItems(limit?: number): Promise<AutomationQueueItem[]>;
  markQueueItemProcessed(id: string): Promise<void>;
  markQueueItemFailed(id: string, error: string): Promise<void>;
  getQueueItemsByAutomationId(automationId: string): Promise<AutomationQueueItem[]>;
  deleteQueueItemsByAutomationId(automationId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByClerkId(clerkId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Instagram Accounts
  async getInstagramAccount(id: string): Promise<InstagramAccount | undefined> {
    const [account] = await db.select().from(instagramAccounts).where(eq(instagramAccounts.id, id)).limit(1);
    return account;
  }

  async getInstagramAccountsByUserId(userId: string): Promise<InstagramAccount[]> {
    return await db.select().from(instagramAccounts).where(
      and(
        eq(instagramAccounts.userId, userId),
        eq(instagramAccounts.isActive, true)
      )
    );
  }

  async getInstagramAccountByInstagramUserId(instagramUserId: string): Promise<InstagramAccount | undefined> {
    const [account] = await db.select().from(instagramAccounts).where(eq(instagramAccounts.instagramUserId, instagramUserId)).limit(1);
    return account;
  }

  async getInstagramAccountByBusinessId(igBusinessAccountId: string): Promise<InstagramAccount | undefined> {
    const [account] = await db.select().from(instagramAccounts).where(eq(instagramAccounts.igBusinessAccountId, igBusinessAccountId)).limit(1);
    return account;
  }

  async createInstagramAccount(insertAccount: InsertInstagramAccount): Promise<InstagramAccount> {
    const [account] = await db.insert(instagramAccounts).values(insertAccount).returning();
    return account;
  }

  async upsertInstagramAccount(insertAccount: InsertInstagramAccount): Promise<InstagramAccount> {
    // Check if this Instagram account already exists for this user
    const existing = await db.select().from(instagramAccounts)
      .where(and(
        eq(instagramAccounts.instagramUserId, insertAccount.instagramUserId),
        eq(instagramAccounts.userId, insertAccount.userId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing account with new token
      await db.update(instagramAccounts)
        .set({ 
          accessToken: insertAccount.accessToken,
          expiresIn: insertAccount.expiresIn,
          updatedAt: new Date()
        })
        .where(eq(instagramAccounts.id, existing[0].id));
      return existing[0];
    }
    
    // Create new account
    const [account] = await db.insert(instagramAccounts).values(insertAccount).returning();
    return account;
  }

  async updateInstagramAccountToken(id: string, accessToken: string, expiresIn: number): Promise<void> {
    await db.update(instagramAccounts)
      .set({ accessToken, expiresIn, updatedAt: new Date() })
      .where(eq(instagramAccounts.id, id));
  }

  async updateInstagramAccountBusinessId(id: string, igBusinessAccountId: string): Promise<void> {
    await db.update(instagramAccounts)
      .set({ igBusinessAccountId, updatedAt: new Date() })
      .where(eq(instagramAccounts.id, id));
  }

  async updateInstagramAccountPageToken(id: string, pageAccessToken: string, pageId: string): Promise<void> {
    await db.update(instagramAccounts)
      .set({ pageAccessToken, pageId, updatedAt: new Date() })
      .where(eq(instagramAccounts.id, id));
  }

  async deleteInstagramAccount(id: string): Promise<void> {
    await db.delete(instagramAccounts).where(eq(instagramAccounts.id, id));
  }

  // Automations
  async getAutomation(id: string): Promise<Automation | undefined> {
    const [automation] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
    return automation;
  }

  async getAutomationsByUserId(userId: string): Promise<Automation[]> {
    return await db.select().from(automations).where(eq(automations.userId, userId)).orderBy(desc(automations.createdAt));
  }

  async getAutomationsByInstagramAccountId(accountId: string): Promise<Automation[]> {
    return await db.select().from(automations).where(eq(automations.instagramAccountId, accountId)).orderBy(desc(automations.createdAt));
  }

  async getAllActiveAutomations(): Promise<Automation[]> {
    return await db.select().from(automations).where(eq(automations.isActive, true));
  }

  async createAutomation(insertAutomation: InsertAutomation): Promise<Automation> {
    const [automation] = await db.insert(automations).values({
      ...insertAutomation,
      stats: insertAutomation.stats || {}
    } as any).returning();
    return automation;
  }

  async updateAutomation(id: string, updates: Partial<Automation>): Promise<void> {
    await db.update(automations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(automations.id, id));
  }

  async deleteAutomation(id: string): Promise<void> {
    await db.delete(automations).where(eq(automations.id, id));
  }

  // Generated Content
  async getGeneratedContent(userId: string, limit: number = 50): Promise<GeneratedContent[]> {
    return await db.select().from(generatedContent)
      .where(eq(generatedContent.userId, userId))
      .orderBy(desc(generatedContent.createdAt))
      .limit(limit);
  }

  async createGeneratedContent(insertContent: InsertGeneratedContent): Promise<GeneratedContent> {
    const [content] = await db.insert(generatedContent).values(insertContent).returning();
    return content;
  }

  // Activity Log
  async getActivityLog(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return await db.select().from(activityLog)
      .where(eq(activityLog.userId, userId))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLog).values(insertLog).returning();
    return log;
  }

  // Automation Backups
  async backupAutomations(userId: string, instagramUserId: string, automationData: any[]): Promise<AutomationBackup> {
    // Delete any existing backup for this user/account combo
    await db.delete(automationBackups).where(
      and(
        eq(automationBackups.userId, userId),
        eq(automationBackups.instagramUserId, instagramUserId)
      )
    );
    
    const [backup] = await db.insert(automationBackups).values({
      userId,
      instagramUserId,
      automationData,
    }).returning();
    return backup;
  }

  async getAutomationBackup(userId: string, instagramUserId: string): Promise<AutomationBackup | undefined> {
    const [backup] = await db.select().from(automationBackups)
      .where(
        and(
          eq(automationBackups.userId, userId),
          eq(automationBackups.instagramUserId, instagramUserId)
        )
      )
      .limit(1);
    return backup;
  }

  async deleteAutomationBackup(userId: string, instagramUserId: string): Promise<void> {
    await db.delete(automationBackups).where(
      and(
        eq(automationBackups.userId, userId),
        eq(automationBackups.instagramUserId, instagramUserId)
      )
    );
  }

  // Soft delete for Instagram accounts
  async deactivateInstagramAccount(id: string): Promise<void> {
    await db.update(instagramAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(instagramAccounts.id, id));
  }

  async reactivateInstagramAccount(id: string, accessToken: string, expiresIn: number): Promise<void> {
    await db.update(instagramAccounts)
      .set({ 
        isActive: true, 
        accessToken, 
        expiresIn,
        updatedAt: new Date() 
      })
      .where(eq(instagramAccounts.id, id));
  }

  async getDeactivatedInstagramAccount(userId: string, instagramUserId: string): Promise<InstagramAccount | undefined> {
    const [account] = await db.select().from(instagramAccounts)
      .where(
        and(
          eq(instagramAccounts.userId, userId),
          eq(instagramAccounts.instagramUserId, instagramUserId),
          eq(instagramAccounts.isActive, false)
        )
      )
      .limit(1);
    return account;
  }

  // Automation Queue
  async addToQueue(item: InsertAutomationQueueItem): Promise<AutomationQueueItem> {
    const [queueItem] = await db.insert(automationQueue).values(item).returning();
    return queueItem;
  }

  async getQueuedItems(limit: number = 50): Promise<AutomationQueueItem[]> {
    return await db.select().from(automationQueue)
      .where(
        and(
          eq(automationQueue.status, "pending"),
          lte(automationQueue.scheduledFor, new Date())
        )
      )
      .orderBy(automationQueue.scheduledFor)
      .limit(limit);
  }

  async markQueueItemProcessed(id: string): Promise<void> {
    await db.update(automationQueue)
      .set({ 
        status: "completed", 
        processedAt: new Date(),
        attempts: sql`${automationQueue.attempts} + 1`
      })
      .where(eq(automationQueue.id, id));
  }

  async markQueueItemFailed(id: string, error: string): Promise<void> {
    await db.update(automationQueue)
      .set({ 
        status: "failed", 
        error,
        attempts: sql`${automationQueue.attempts} + 1`
      })
      .where(eq(automationQueue.id, id));
  }

  async getQueueItemsByAutomationId(automationId: string): Promise<AutomationQueueItem[]> {
    return await db.select().from(automationQueue)
      .where(eq(automationQueue.automationId, automationId))
      .orderBy(desc(automationQueue.createdAt));
  }

  async deleteQueueItemsByAutomationId(automationId: string): Promise<void> {
    await db.delete(automationQueue).where(eq(automationQueue.automationId, automationId));
  }
}

export const storage = new DatabaseStorage();
