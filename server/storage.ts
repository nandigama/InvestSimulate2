import { users, portfolios, transactions, subscriptions, payments } from "@shared/schema";
import type { 
  User, InsertUser, Portfolio, Transaction, 
  Trade, Subscription, Payment, UpdateTrader 
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
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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

    return traders.filter(trader => trader.monthlySubscriptionFee !== "0.00");
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
}

export const storage = new DatabaseStorage();