import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserProgressSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all story nodes
  app.get("/api/story/nodes", async (req, res) => {
    try {
      const nodes = await storage.getAllStoryNodes();
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch story nodes" });
    }
  });

  // Get specific story node
  app.get("/api/story/nodes/:id", async (req, res) => {
    try {
      const node = await storage.getStoryNode(req.params.id);
      if (!node) {
        return res.status(404).json({ message: "Story node not found" });
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch story node" });
    }
  });

  // Get user progress
  app.get("/api/progress/:userId", async (req, res) => {
    try {
      const progress = await storage.getUserProgress(req.params.userId);
      if (!progress) {
        // Create default progress for new user
        const defaultProgress = await storage.createUserProgress({
          userId: req.params.userId,
          visitedNodes: ["origin"],
          currentNode: "origin",
          choices: [],
          isAudioEnabled: true,
        });
        return res.json(defaultProgress);
      }
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user progress" });
    }
  });

  // Update user progress
  app.patch("/api/progress/:userId", async (req, res) => {
    try {
      const progressData = req.body;
      const progress = await storage.updateUserProgress(req.params.userId, progressData);
      res.json(progress);
    } catch (error) {
      if (error instanceof Error && error.message === "User progress not found") {
        // Create new progress if it doesn't exist
        try {
          const newProgress = await storage.createUserProgress({
            userId: req.params.userId,
            ...req.body,
          });
          return res.json(newProgress);
        } catch (createError) {
          return res.status(500).json({ message: "Failed to create user progress" });
        }
      }
      res.status(500).json({ message: "Failed to update user progress" });
    }
  });

  // Make a story choice
  app.post("/api/story/choice", async (req, res) => {
    try {
      const { userId, nodeId, choiceId } = req.body;
      
      // Get current progress
      let progress = await storage.getUserProgress(userId);
      if (!progress) {
        progress = await storage.createUserProgress({
          userId,
          visitedNodes: ["origin"],
          currentNode: "origin",
          choices: [],
          isAudioEnabled: true,
        });
      }

      // Get the current node to find the choice
      const currentNode = await storage.getStoryNode(nodeId);
      if (!currentNode || !currentNode.choices) {
        return res.status(400).json({ message: "Invalid node or choices" });
      }

      const choice = (currentNode.choices as any[]).find(c => c.id === choiceId);
      if (!choice) {
        return res.status(400).json({ message: "Invalid choice" });
      }

      // Update progress with the new choice
      const newChoices = [...(progress.choices as any[]), {
        nodeId,
        choiceId,
        timestamp: new Date().toISOString(),
      }];

      let newVisitedNodes = [...progress.visitedNodes];
      let newCurrentNode = progress.currentNode;

      if (choice.nextNode) {
        newCurrentNode = choice.nextNode;
        if (!newVisitedNodes.includes(choice.nextNode)) {
          newVisitedNodes.push(choice.nextNode);
        }
      }

      const updatedProgress = await storage.updateUserProgress(userId, {
        visitedNodes: newVisitedNodes,
        currentNode: newCurrentNode,
        choices: newChoices,
      });

      res.json(updatedProgress);
    } catch (error) {
      res.status(500).json({ message: "Failed to process choice" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
