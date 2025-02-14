import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import {
  tradeSchema,
  updateTraderSchema,
  createSubscriptionSchema,
  followTraderSchema,
  copyTradingSettingsSchema
} from "@shared/schema";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Existing routes
  app.get("/api/portfolio", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const portfolio = await storage.getPortfolio(req.user.id);
    res.json(portfolio);
  });

  app.post("/api/trade", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parseResult = tradeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      // Execute the original trade
      const transaction = await storage.executeTransaction(req.user.id, parseResult.data);

      // If the trade is successful and the user is a trader, process copy trades for followers
      if (req.user.isTrader) {
        // Get all copy trading settings that follow this trader
        const followers = await storage.getFollowers(req.user.id);

        // Process copy trades for each follower
        const copyTradePromises = followers.map(async (follower) => {
          try {
            const settings = await storage.getCopyTradingSettings(follower.followerId);

            // Find the active copy trading setting for this trader
            const activeSetting = settings.find(
              setting => setting.enabled &&
              setting.followedTraderId === req.user!.id
            );

            if (activeSetting) {
              console.log(`Processing copy trade for follower ${follower.followerId} with settings:`, activeSetting);

              return await storage.processCopyTrade(transaction.id, activeSetting);
            }
          } catch (error) {
            console.error(
              `Failed to copy trade for follower ${follower.followerId}:`,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        });

        // Wait for all copy trades to be processed
        await Promise.all(copyTradePromises);
      }

      res.json(transaction);
    } catch (err: any) {
      console.error('Trade execution failed:', err);
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const transactions = await storage.getTransactions(req.user.id);
    res.json(transactions);
  });

  app.get("/api/leaderboard", async (_req, res) => {
    const leaderboard = await storage.getLeaderboard();
    res.json(leaderboard);
  });

  // New monetization routes
  app.post("/api/trader/profile", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parseResult = updateTraderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const user = await storage.updateTraderProfile(req.user.id, parseResult.data);
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/traders", async (_req, res) => {
    const traders = await storage.getTraders();
    res.json(traders);
  });

  app.post("/api/subscribe", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parseResult = createSubscriptionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const subscription = await storage.createSubscription(
        req.user.id,
        parseResult.data.traderId
      );
      res.json(subscription);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/subscription/:id/cancel", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      await storage.cancelSubscription(parseInt(req.params.id));
      res.sendStatus(200);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/subscriptions", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const subscriptions = await storage.getActiveSubscriptions(req.user.id);
    res.json(subscriptions);
  });

  // Social Trading Routes
  app.post("/api/traders/:id/follow", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parseResult = followTraderSchema.safeParse({ followedId: parseInt(req.params.id) });
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const follower = await storage.followTrader(req.user.id, parseResult.data.followedId);
      res.json(follower);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/traders/:id/follow", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      await storage.unfollowTrader(req.user.id, parseInt(req.params.id));
      res.sendStatus(200);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/traders/:id/followers", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const followers = await storage.getFollowers(parseInt(req.params.id));
      res.json(followers);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Copy Trading Routes
  app.post("/api/copy-trading/settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parseResult = copyTradingSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const settings = await storage.createCopyTradingSettings(req.user.id, parseResult.data);
      res.json(settings);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/copy-trading/settings/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parseResult = copyTradingSettingsSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const settings = await storage.updateCopyTradingSettings(
        parseInt(req.params.id),
        parseResult.data
      );
      res.json(settings);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/copy-trading/settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const settings = await storage.getCopyTradingSettings(req.user.id);
      res.json(settings);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/copy-trading/trades", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const trades = await storage.getCopiedTrades(req.user.id);
      res.json(trades);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}