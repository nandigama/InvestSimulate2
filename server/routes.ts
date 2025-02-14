import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { tradeSchema, updateTraderSchema, createSubscriptionSchema } from "@shared/schema";

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
      const transaction = await storage.executeTransaction(req.user.id, parseResult.data);
      res.json(transaction);
    } catch (err: any) {
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

  const httpServer = createServer(app);
  return httpServer;
}