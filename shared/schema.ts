import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const storyNodes = pgTable("story_nodes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  location: text("location").notNull(),
  readTime: text("read_time").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  isLocked: boolean("is_locked").default(false),
  connectedNodes: text("connected_nodes").array(),
  choices: jsonb("choices"),
});

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  visitedNodes: text("visited_nodes").array().default([]),
  currentNode: text("current_node"),
  choices: jsonb("choices").default([]),
  isAudioEnabled: boolean("is_audio_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertStoryNodeSchema = createInsertSchema(storyNodes);

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type StoryNode = typeof storyNodes.$inferSelect;
export type InsertStoryNode = z.infer<typeof insertStoryNodeSchema>;

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;

// Additional types for story system
export type Choice = {
  id: string;
  text: string;
  description: string;
  icon: string;
  nextNode?: string;
  unlocks?: string[];
};

export type NodeState = "locked" | "available" | "visited" | "current";
