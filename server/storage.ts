import { users, portfolios, transactions } from "@shared/schema";
import type { User, InsertUser, Portfolio, Transaction, Trade } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

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
}

export const storage = new DatabaseStorage();