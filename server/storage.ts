import { users, portfolios, transactions, subscriptions, payments, followers, copyTradingSettings, copiedTrades } from "@shared/schema";
import type { 
  User, InsertUser, Portfolio, Transaction, 
  Trade, Subscription, Payment, UpdateTrader,
  Follower, CopyTradingSettings, CopiedTrade,
  InsertCopyTradingSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { sql } from 'drizzle-orm';

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getPortfolio(userId: number): Promise<Portfolio[]>;
  executeTransaction(userId: number, trade: Trade): Promise<Transaction>;
  getTransactions(userId: number): Promise<Transaction[]>;
  updateBalance(userId: number, amount: number): Promise<User>;
  getLeaderboard(): Promise<Array<{ username: string; totalValue: number }>>;
  sessionStore: session.Store;

  // Social Trading Methods
  followTrader(followerId: number, followedId: number): Promise<Follower>;
  unfollowTrader(followerId: number, followedId: number): Promise<void>;
  getFollowers(userId: number): Promise<Follower[]>;
  isFollowing(followerId: number, followedId: number): Promise<boolean>;

  // Copy Trading Methods
  createCopyTradingSettings(userId: number, settings: InsertCopyTradingSettings): Promise<CopyTradingSettings>;
  updateCopyTradingSettings(id: number, settings: Partial<InsertCopyTradingSettings>): Promise<CopyTradingSettings>;
  getCopyTradingSettings(userId: number): Promise<CopyTradingSettings[]>;
  getCopiedTrades(userId: number): Promise<CopiedTrade[]>;
  processCopyTrade(originalTransactionId: number, settings: CopyTradingSettings): Promise<CopiedTrade>;

  // New methods for monetization
  updateTraderProfile(userId: number, update: UpdateTrader): Promise<User>;
  getTraders(): Promise<User[]>;
  createSubscription(subscriberId: number, traderId: number): Promise<Subscription>;
  getActiveSubscription(subscriberId: number, traderId: number): Promise<Subscription | undefined>;
  cancelSubscription(subscriptionId: number): Promise<void>;
  processPayment(subscriptionId: number): Promise<Payment>;
  getSubscriberCount(traderId: number): Promise<number>;
  getSubscriptionRevenue(traderId: number): Promise<string>;
  getActiveSubscriptions(userId: number): Promise<Subscription[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // First check if username exists (case insensitive)
    const existingUser = await this.getUserByUsername(insertUser.username);
    if (existingUser) {
      throw new Error("Username already exists");
    }

    // Store username as provided by user, but check case-insensitively
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getPortfolio(userId: number): Promise<Portfolio[]> {
    return db.select().from(portfolios).where(eq(portfolios.userId, userId));
  }

  async executeTransaction(userId: number, trade: Trade): Promise<Transaction> {
    // Get user for balance check
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    // Mock price between $10-$100
    const price = (Math.random() * 90 + 10).toFixed(2);
    const total = parseFloat(price) * trade.shares;

    if (trade.type === "buy" && total > parseFloat(user.virtualBalance)) {
      throw new Error("Insufficient funds");
    }

    // Start transaction
    return await db.transaction(async (tx) => {
      // Create transaction record
      const [transaction] = await tx
        .insert(transactions)
        .values({
          userId,
          symbol: trade.symbol,
          shares: trade.shares.toString(),
          price,
          type: trade.type,
        })
        .returning();

      // Update portfolio
      const [position] = await tx
        .select()
        .from(portfolios)
        .where(eq(portfolios.userId, userId))
        .where(eq(portfolios.symbol, trade.symbol));

      if (trade.type === "buy") {
        if (position) {
          const newShares = parseFloat(position.shares) + trade.shares;
          const newAvgPrice = ((parseFloat(position.averagePrice) + parseFloat(price)) / 2).toFixed(2);
          await tx
            .update(portfolios)
            .set({
              shares: newShares.toString(),
              averagePrice: newAvgPrice,
              lastUpdated: new Date(),
            })
            .where(eq(portfolios.id, position.id));
        } else {
          await tx.insert(portfolios).values({
            userId,
            symbol: trade.symbol,
            shares: trade.shares.toString(),
            averagePrice: price,
          });
        }
        await this.updateBalance(userId, -total);
      } else {
        if (!position || parseFloat(position.shares) < trade.shares) {
          throw new Error("Insufficient shares");
        }
        const newShares = parseFloat(position.shares) - trade.shares;
        if (newShares === 0) {
          await tx.delete(portfolios).where(eq(portfolios.id, position.id));
        } else {
          await tx
            .update(portfolios)
            .set({
              shares: newShares.toString(),
              lastUpdated: new Date(),
            })
            .where(eq(portfolios.id, position.id));
        }
        await this.updateBalance(userId, total);
      }

      return transaction;
    });
  }

  async getTransactions(userId: number): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.timestamp));
  }

  async updateBalance(userId: number, amount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const newBalance = (parseFloat(user.virtualBalance) + amount).toFixed(2);
    const [updatedUser] = await db
      .update(users)
      .set({ virtualBalance: newBalance })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  async getLeaderboard(): Promise<Array<{ username: string; totalValue: number }>> {
    const allUsers = await db.select().from(users);
    const leaderboard = [];

    for (const user of allUsers) {
      const portfolio = await this.getPortfolio(user.id);
      const portfolioValue = portfolio.reduce((total, position) => {
        // Mock current price between -10% and +10% of average price
        const currentPrice = parseFloat(position.averagePrice) * (0.9 + Math.random() * 0.2);
        return total + (parseFloat(position.shares) * currentPrice);
      }, 0);

      leaderboard.push({
        username: user.username,
        totalValue: portfolioValue + parseFloat(user.virtualBalance),
      });
    }

    return leaderboard.sort((a, b) => b.totalValue - a.totalValue);
  }

  async updateTraderProfile(userId: number, update: UpdateTrader): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        isTrader: true,
        monthlySubscriptionFee: update.monthlySubscriptionFee.toString(),
        bio: update.bio || null,
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Failed to update trader profile");
    }

    return updatedUser;
  }

  async getTraders(): Promise<User[]> {
    const traders = await db
      .select()
      .from(users)
      .where(eq(users.isTrader, true));

    // Include traders with any subscription fee (even 0) as long as they are marked as traders
    return traders;
  }

  async createSubscription(subscriberId: number, traderId: number): Promise<Subscription> {
    const trader = await this.getUser(traderId);
    if (!trader || !trader.isTrader) {
      throw new Error("Invalid trader");
    }

    const existingSubscription = await this.getActiveSubscription(subscriberId, traderId);
    if (existingSubscription) {
      throw new Error("Already subscribed to this trader");
    }

    const [subscription] = await db
      .insert(subscriptions)
      .values({
        subscriberId,
        traderId,
        status: "active",
        monthlyFee: trader.monthlySubscriptionFee,
      })
      .returning();

    return subscription;
  }

  async getActiveSubscription(subscriberId: number, traderId: number): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.subscriberId, subscriberId),
          eq(subscriptions.traderId, traderId),
          eq(subscriptions.status, "active")
        )
      );
    return subscription;
  }

  async cancelSubscription(subscriptionId: number): Promise<void> {
    await db
      .update(subscriptions)
      .set({
        status: "cancelled",
        endDate: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));
  }

  async processPayment(subscriptionId: number): Promise<Payment> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId));

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const [payment] = await db
      .insert(payments)
      .values({
        subscriptionId,
        amount: subscription.monthlyFee,
        status: "completed",
      })
      .returning();

    await db
      .update(subscriptions)
      .set({
        lastBillingDate: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));

    return payment;
  }

  async getSubscriberCount(traderId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.traderId, traderId),
          eq(subscriptions.status, "active")
        )
      );
    return result?.count || 0;
  }

  async getSubscriptionRevenue(traderId: number): Promise<string> {
    const [result] = await db
      .select({
        total: sql<string>`sum(amount)`
      })
      .from(payments)
      .innerJoin(
        subscriptions,
        eq(payments.subscriptionId, subscriptions.id)
      )
      .where(
        and(
          eq(subscriptions.traderId, traderId),
          eq(payments.status, "completed")
        )
      );
    return result?.total || "0";
  }

  async getActiveSubscriptions(userId: number): Promise<Subscription[]> {
    return db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.subscriberId, userId),
          eq(subscriptions.status, "active")
        )
      );
  }

  // Social Trading Methods Implementation
  async followTrader(followerId: number, followedId: number): Promise<Follower> {
    // Check if already following
    const isAlreadyFollowing = await this.isFollowing(followerId, followedId);
    if (isAlreadyFollowing) {
      throw new Error("Already following this trader");
    }

    const [follower] = await db
      .insert(followers)
      .values({
        followerId,
        followedId,
      })
      .returning();

    return follower;
  }

  async unfollowTrader(followerId: number, followedId: number): Promise<void> {
    await db
      .delete(followers)
      .where(
        and(
          eq(followers.followerId, followerId),
          eq(followers.followedId, followedId)
        )
      );
  }

  async getFollowers(userId: number): Promise<Follower[]> {
    return db
      .select()
      .from(followers)
      .where(eq(followers.followedId, userId));
  }

  async isFollowing(followerId: number, followedId: number): Promise<boolean> {
    const [follower] = await db
      .select()
      .from(followers)
      .where(
        and(
          eq(followers.followerId, followerId),
          eq(followers.followedId, followedId)
        )
      );
    return !!follower;
  }

  // Copy Trading Methods Implementation
  async createCopyTradingSettings(
    userId: number,
    settings: InsertCopyTradingSettings
  ): Promise<CopyTradingSettings> {
    const [copySettings] = await db
      .insert(copyTradingSettings)
      .values({
        ...settings,
        userId,
        copyAmount: settings.copyAmount.toString(),
        maxPositionSize: settings.maxPositionSize.toString(),
      })
      .returning();

    return copySettings;
  }

  async updateCopyTradingSettings(
    id: number,
    settings: Partial<InsertCopyTradingSettings>
  ): Promise<CopyTradingSettings> {
    const updateData: any = { ...settings };
    if (settings.copyAmount !== undefined) {
      updateData.copyAmount = settings.copyAmount.toString();
    }
    if (settings.maxPositionSize !== undefined) {
      updateData.maxPositionSize = settings.maxPositionSize.toString();
    }

    const [updated] = await db
      .update(copyTradingSettings)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(copyTradingSettings.id, id))
      .returning();

    return updated;
  }

  async getCopyTradingSettings(userId: number): Promise<CopyTradingSettings[]> {
    return db
      .select()
      .from(copyTradingSettings)
      .where(eq(copyTradingSettings.userId, userId));
  }

  async getCopiedTrades(userId: number): Promise<CopiedTrade[]> {
    return db
      .select()
      .from(copiedTrades)
      .where(eq(copiedTrades.copiedByUserId, userId))
      .orderBy(desc(copiedTrades.createdAt));
  }

  async processCopyTrade(
    originalTransactionId: number,
    settings: CopyTradingSettings
  ): Promise<CopiedTrade> {
    // Get the original transaction
    const [originalTrade] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, originalTransactionId));

    if (!originalTrade) {
      throw new Error("Original transaction not found");
    }

    // Calculate the copy trade amount based on settings
    const originalAmount = parseFloat(originalTrade.shares) * parseFloat(originalTrade.price);
    const copyAmount = Math.min(
      parseFloat(settings.copyAmount),
      parseFloat(settings.maxPositionSize),
      originalAmount
    );

    const copyShares = (copyAmount / parseFloat(originalTrade.price)).toFixed(6);

    // Create the copy trade record
    const [copiedTrade] = await db
      .insert(copiedTrades)
      .values({
        originalTransactionId,
        copiedByUserId: settings.userId,
        status: "pending",
        copiedShares: copyShares,
        copiedPrice: originalTrade.price,
      })
      .returning();

    // Execute the actual trade
    try {
      await this.executeTransaction(settings.userId, {
        symbol: originalTrade.symbol,
        shares: parseFloat(copyShares),
        type: originalTrade.type,
      });

      // Update the copy trade status to executed
      const [updatedCopiedTrade] = await db
        .update(copiedTrades)
        .set({ status: "executed" })
        .where(eq(copiedTrades.id, copiedTrade.id))
        .returning();

      return updatedCopiedTrade;
    } catch (error) {
      // Update the copy trade status to failed
      const [failedCopiedTrade] = await db
        .update(copiedTrades)
        .set({ status: "failed" })
        .where(eq(copiedTrades.id, copiedTrade.id))
        .returning();

      return failedCopiedTrade;
    }
  }
}

export const storage = new DatabaseStorage();