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
      console.log(`[SERVER LOG] /api/story/choice received: userId=${userId}, nodeId=${nodeId}, choiceId=${choiceId}`); // Added log
      
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

      // Initialize newCurrentNode and newVisitedNodes based on current progress
      let newCurrentNode = progress.currentNode;
      let newVisitedNodes = [...progress.visitedNodes];

      if (choice.nextNode) {
        const targetNode = await storage.getStoryNode(choice.nextNode);
        if (!targetNode) {
          console.warn(`Attempted to navigate to non-existent node ID: '${choice.nextNode}' from node: '${nodeId}' via choice: '${choiceId}'. User remains on current node.`);
          // User remains on current node, newCurrentNode and newVisitedNodes are already set to current values.
        } else {
          // Valid target node, update current node and visited list
          newCurrentNode = choice.nextNode;
          if (!newVisitedNodes.includes(choice.nextNode)) {
            newVisitedNodes.push(choice.nextNode);
          }
        }
      }

      // Update progress with the new choice being made
      const newChoices = [...(progress.choices as any[]), {
        nodeId,
        choiceId,
        timestamp: new Date().toISOString(),
      }];

      const updatedProgress = await storage.updateUserProgress(userId, {
        visitedNodes: newVisitedNodes, // Use the (potentially updated) list
        currentNode: newCurrentNode,   // Use the (potentially updated) current node
        choices: newChoices,
      });

      console.log(`[SERVER LOG] User: ${userId}, Current Node: ${newCurrentNode}, Choice ID: ${choiceId}, Next Node: ${choice.nextNode || 'N/A'}, Visited Nodes: ${JSON.stringify(newVisitedNodes)}`); // Added log

      res.json(updatedProgress);
    } catch (error) {
      console.error(`[SERVER ERROR] /api/story/choice: ${error.message}`, error); // Added error log
      res.status(500).json({ message: "Failed to process choice" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
