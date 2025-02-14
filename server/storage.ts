import { User, InsertUser, Portfolio, Transaction, Trade } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private portfolios: Map<number, Portfolio[]>;
  private transactions: Transaction[];
  sessionStore: session.Store;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.portfolios = new Map();
    this.transactions = [];
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id,
      virtualBalance: "5000.00"
    };
    this.users.set(id, user);
    this.portfolios.set(id, []);
    return user;
  }

  async getPortfolio(userId: number): Promise<Portfolio[]> {
    return this.portfolios.get(userId) || [];
  }

  async executeTransaction(userId: number, trade: Trade): Promise<Transaction> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    // Mock price between $10-$100
    const price = (Math.random() * 90 + 10).toFixed(2);
    const total = parseFloat(price) * trade.shares;

    if (trade.type === "buy" && total > parseFloat(user.virtualBalance)) {
      throw new Error("Insufficient funds");
    }

    const transaction: Transaction = {
      id: this.currentId++,
      userId,
      symbol: trade.symbol,
      shares: trade.shares.toString(),
      price: price,
      type: trade.type,
      timestamp: new Date(),
    };

    this.transactions.push(transaction);

    // Update portfolio
    let portfolio = await this.getPortfolio(userId);
    const position = portfolio.find(p => p.symbol === trade.symbol);

    if (trade.type === "buy") {
      if (position) {
        const newShares = parseFloat(position.shares) + trade.shares;
        const newAvgPrice = ((parseFloat(position.averagePrice) + parseFloat(price)) / 2).toFixed(2);
        position.shares = newShares.toString();
        position.averagePrice = newAvgPrice;
      } else {
        portfolio.push({
          id: this.currentId++,
          userId,
          symbol: trade.symbol,
          shares: trade.shares.toString(),
          averagePrice: price,
          lastUpdated: new Date()
        });
      }
      await this.updateBalance(userId, -total);
    } else {
      if (!position || parseFloat(position.shares) < trade.shares) {
        throw new Error("Insufficient shares");
      }
      const newShares = parseFloat(position.shares) - trade.shares;
      position.shares = newShares.toString();
      if (newShares === 0) {
        portfolio = portfolio.filter(p => p.id !== position.id);
      }
      await this.updateBalance(userId, total);
    }

    this.portfolios.set(userId, portfolio);
    return transaction;
  }

  async getTransactions(userId: number): Promise<Transaction[]> {
    return this.transactions.filter(t => t.userId === userId);
  }

  async updateBalance(userId: number, amount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const newBalance = (parseFloat(user.virtualBalance) + amount).toFixed(2);
    user.virtualBalance = newBalance;
    this.users.set(userId, user);
    return user;
  }

  async getLeaderboard(): Promise<Array<{ username: string; totalValue: number }>> {
    const leaderboard = [];

    for (const user of Array.from(this.users.values())) {
      const portfolio = await this.getPortfolio(user.id);
      const portfolioValue = portfolio.reduce((total, position) => {
        // Mock current price between -10% and +10% of average price
        const currentPrice = parseFloat(position.averagePrice) * (0.9 + Math.random() * 0.2);
        return total + (parseFloat(position.shares) * currentPrice);
      }, 0);

      leaderboard.push({
        username: user.username,
        totalValue: portfolioValue + parseFloat(user.virtualBalance)
      });
    }

    return leaderboard.sort((a, b) => b.totalValue - a.totalValue);
  }
}

export const storage = new MemStorage();