import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const instagramAccounts = pgTable("instagram_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  instagramUserId: text("instagram_user_id").notNull(),
  igBusinessAccountId: text("ig_business_account_id"),
  username: text("username").notNull(),
  accessToken: text("access_token").notNull(),
  pageAccessToken: text("page_access_token"),
  pageId: text("page_id"),
  tokenType: text("token_type").default("bearer"),
  expiresIn: integer("expires_in"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  instagramAccountId: varchar("instagram_account_id").notNull().references(() => instagramAccounts.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false),
  config: jsonb("config").$type<{
    prompt?: string;
    triggerWords?: string[];
    responseTemplate?: string;
    delaySeconds?: number;
    keywords?: string[];
    mediaId?: string;
    mediaPermalink?: string;
    messageTemplate?: string;
    links?: { label?: string; url: string }[];
    commentReplyEnabled?: boolean;
    commentReplyTemplate?: string;
  }>(),
  stats: jsonb("stats").$type<{
    totalReplies?: number;
    lastTriggered?: string;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const generatedContent = pgTable("generated_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  topic: text("topic").notNull(),
  tone: text("tone"),
  additionalInstructions: text("additional_instructions"),
  generatedText: text("generated_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  automationId: varchar("automation_id").references(() => automations.id),
  action: text("action").notNull(),
  targetUsername: text("target_username"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationBackups = pgTable("automation_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  instagramUserId: text("instagram_user_id").notNull(),
  automationData: jsonb("automation_data").$type<{
    type: string;
    title: string;
    description?: string | null;
    config?: any;
    stats?: any;
  }[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationQueue = pgTable("automation_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id").notNull().references(() => automations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  payload: jsonb("payload").$type<{
    commentId?: string;
    commentText?: string;
    commenterUsername?: string;
    commenterUserId?: string;
    mediaId?: string;
    messageType?: string;
  }>().notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").default(0),
  error: text("error"),
  scheduledFor: timestamp("scheduled_for").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertInstagramAccountSchema = createInsertSchema(instagramAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAutomationSchema = createInsertSchema(automations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGeneratedContentSchema = createInsertSchema(generatedContent).omit({ id: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, createdAt: true });
export const insertAutomationBackupSchema = createInsertSchema(automationBackups).omit({ id: true, createdAt: true });
export const insertAutomationQueueSchema = createInsertSchema(automationQueue).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type InstagramAccount = typeof instagramAccounts.$inferSelect;
export type InsertInstagramAccount = z.infer<typeof insertInstagramAccountSchema>;

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;

export type GeneratedContent = typeof generatedContent.$inferSelect;
export type InsertGeneratedContent = z.infer<typeof insertGeneratedContentSchema>;

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type AutomationBackup = typeof automationBackups.$inferSelect;
export type InsertAutomationBackup = z.infer<typeof insertAutomationBackupSchema>;

export type AutomationQueueItem = typeof automationQueue.$inferSelect;
export type InsertAutomationQueueItem = z.infer<typeof insertAutomationQueueSchema>;
