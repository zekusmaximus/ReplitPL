import type { Choice } from "@shared/schema";

export const defaultChoices: Record<string, Choice[]> = {
  origin: [
    {
      id: "investigate",
      text: "Investigate the anomaly further",
      description: "Risk everything to understand the dimensional breach.",
      icon: "fas fa-search",
      nextNode: "discovery"
    },
    {
      id: "report",
      text: "Report to the authorities",
      description: "Alert the research council about the discovery.",
      icon: "fas fa-phone",
      nextNode: "alternative-path"
    }
  ],
  discovery: [
    {
      id: "stabilize",
      text: "Attempt to stabilize the field",
      description: "Try to contain the breach using available equipment.",
      icon: "fas fa-cog",
      nextNode: "revelation"
    },
    {
      id: "enter",
      text: "Step through the dimensional breach",
      description: "Cross into the parallel dimension to explore.",
      icon: "fas fa-portal",
      nextNode: "paradox"
    },
    {
      id: "evacuate",
      text: "Follow evacuation protocol",
      description: "Alert the authorities and evacuate immediately.",
      icon: "fas fa-running",
      nextNode: "evacuation"
    }
  ]
};

export const storyConnections: Record<string, string[]> = {
  origin: ["discovery", "alternative-path"],
  discovery: ["revelation", "paradox"],
  revelation: ["contact", "isolation"],
  "alternative-path": ["conspiracy", "resistance"],
  contact: ["salvation", "sacrifice"],
  paradox: ["merge", "conflict"]
};
