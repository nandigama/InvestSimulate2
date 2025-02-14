import { pgTable, text, serial, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  virtualBalance: decimal("virtual_balance").notNull().default("5000.00"),
  isTrader: boolean("is_trader").notNull().default(false),
  monthlySubscriptionFee: decimal("monthly_subscription_fee").default("0.00"),
  bio: text("bio"),
});

export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  shares: decimal("shares").notNull(),
  averagePrice: decimal("average_price").notNull(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  shares: decimal("shares").notNull(),
  price: decimal("price").notNull(),
  type: text("type", { enum: ["buy", "sell"] }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  subscriberId: integer("subscriber_id").notNull(),
  traderId: integer("trader_id").notNull(),
  status: text("status", { enum: ["active", "cancelled"] }).notNull(),
  monthlyFee: decimal("monthly_fee").notNull(),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  lastBillingDate: timestamp("last_billing_date").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull(),
  amount: decimal("amount").notNull(),
  status: text("status", { enum: ["pending", "completed", "failed"] }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const followers = pgTable("followers", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  followedId: integer("followed_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const copyTradingSettings = pgTable("copy_trading_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  followedTraderId: integer("followed_trader_id").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  copyAmount: decimal("copy_amount").notNull(),
  riskLevel: text("risk_level", { enum: ["low", "medium", "high"] }).notNull(),
  maxPositionSize: decimal("max_position_size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const copiedTrades = pgTable("copied_trades", {
  id: serial("id").primaryKey(),
  originalTransactionId: integer("original_transaction_id").notNull(),
  copiedByUserId: integer("copied_by_user_id").notNull(),
  status: text("status", { enum: ["pending", "executed", "failed"] }).notNull(),
  copiedShares: decimal("copied_shares").notNull(),
  copiedPrice: decimal("copied_price").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const updateTraderSchema = z.object({
  monthlySubscriptionFee: z.number().min(0).max(100),
  bio: z.string().max(500).optional(),
});

export const createSubscriptionSchema = z.object({
  traderId: z.number(),
});

export const tradeSchema = z.object({
  symbol: z.string().min(1).max(10),
  shares: z.number().positive(),
  type: z.enum(["buy", "sell"]),
});

export const followTraderSchema = z.object({
  followedId: z.number(),
});

export const copyTradingSettingsSchema = createInsertSchema(copyTradingSettings)
  .omit({ id: true, createdAt: true, updatedAt: true, userId: true })
  .extend({
    copyAmount: z.number().min(0),
    maxPositionSize: z.number().min(0),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type UpdateTrader = z.infer<typeof updateTraderSchema>;
export type CreateSubscription = z.infer<typeof createSubscriptionSchema>;
export type Trade = z.infer<typeof tradeSchema>;
export type Follower = typeof followers.$inferSelect;
export type CopyTradingSettings = typeof copyTradingSettings.$inferSelect;
export type CopiedTrade = typeof copiedTrades.$inferSelect;
export type FollowTrader = z.infer<typeof followTraderSchema>;
export type InsertCopyTradingSettings = z.infer<typeof copyTradingSettingsSchema>;