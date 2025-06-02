import { 
  users, 
  storyNodes, 
  userProgress, 
  type User, 
  type InsertUser, 
  type StoryNode, 
  type InsertStoryNode,
  type UserProgress,
  type InsertUserProgress 
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getStoryNode(id: string): Promise<StoryNode | undefined>;
  getAllStoryNodes(): Promise<StoryNode[]>;
  createStoryNode(node: InsertStoryNode): Promise<StoryNode>;
  
  getUserProgress(userId: string): Promise<UserProgress | undefined>;
  updateUserProgress(userId: string, progress: Partial<UserProgress>): Promise<UserProgress>;
  createUserProgress(progress: InsertUserProgress): Promise<UserProgress>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private storyNodes: Map<string, StoryNode>;
  private userProgress: Map<string, UserProgress>;
  private currentUserId: number;
  private currentProgressId: number;

  constructor() {
    this.users = new Map();
    this.storyNodes = new Map();
    this.userProgress = new Map();
    this.currentUserId = 1;
    this.currentProgressId = 1;
    
    this.initializeStoryNodes();
  }

  private initializeStoryNodes() {
    const additionalNodes: InsertStoryNode[] = [
      {
        id: "evacuation",
        title: "The Evacuation Protocol",
        content: "Following protocol, Sarah triggered the alarm. Sirens blared, and emergency lights bathed the lab in a pulsing red glow. Within minutes, security teams were storming the facility, their faces grim. Dr. Chen was quickly escorted to a secure debriefing room, the fate of her discovery now out of her hands. The official report would later state that a 'minor equipment malfunction' had occurred, and the public would remain unaware of the dimensional breach. Sarah knew the truth, but her voice was silenced by layers of bureaucracy and national security.",
        location: "Secure Debriefing Room - Sector C",
        readTime: "3 min read",
        x: 450,
        y: 50,
        isLocked: false,
        connectedNodes: ["origin"], // Leads back or to a new "silenced" node
        choices: [
          {
            id: "accept-fate",
            text: "Accept the official story",
            description: "Move on and try to forget what you saw.",
            icon: "fas fa-door-closed",
            nextNode: "origin" // Or a new "life-after" node
          }
        ]
      },
      {
        id: "isolation",
        title: "Dimensional Isolation",
        content: "Sarah, prioritizing the safety of her own dimension, worked tirelessly to sever the connection. The entities on the other side seemed to understand, their final transmission a melancholic acceptance of their fate. The breach was sealed, the lab returned to normal, but Sarah was forever changed. The knowledge of what lay beyond, and the choice she made, weighed heavily on her. Was it an act of preservation, or a betrayal of a civilization that had reached out in desperation?",
        location: "Quantum Research Laboratory - Control Room",
        readTime: "4 min read",
        x: 100,
        y: 480,
        isLocked: false,
        connectedNodes: ["origin"], // Or a "haunted-by-choice" node
        choices: [
          {
            id: "reflect",
            text: "Reflect on the decision",
            description: "Live with the consequences of her choice.",
            icon: "fas fa-glasses",
            nextNode: "origin" // Or a new "reflection-node"
          }
        ]
      }
    ];

    const expansionNodes: InsertStoryNode[] = [
      {
        id: "conspiracy",
        title: "The Government Conspiracy",
        content: "Cooperating with the authorities, Sarah was drawn into a shadowy world of secrets and misinformation. She learned that governments had known about parallel dimensions for decades, using the knowledge for their own gain. Her discovery was not a breakthrough, but an unwelcome exposure of their activities. Sarah found herself a pawn in a much larger game, her scientific curiosity replaced by a growing sense of unease and complicity.",
        location: "Black Site Research Facility",
        readTime: "5 min read",
        x: -50,
        y: 350,
        isLocked: false,
        connectedNodes: ["deep-state", "escape"],
        choices: [
          {
            id: "play-along",
            text: "Play along with their agenda",
            description: "Try to uncover more from the inside.",
            icon: "fas fa-theater-masks",
            nextNode: "deep-state"
          },
          {
            id: "attempt-escape",
            text: "Attempt to escape and expose them",
            description: "Risk everything to reveal the truth.",
            icon: "fas fa-running",
            nextNode: "escape"
          }
        ]
      },
      {
        id: "resistance",
        title: "The Resistance Movement",
        content: "Choosing to resist, Sarah became a fugitive. She connected with an underground network of scientists, activists, and whistleblowers who were aware of the government's dimensional activities and were fighting to expose them. Her knowledge of the Genesis Protocol became a valuable asset to the resistance. Life on the run was dangerous, but Sarah felt a renewed sense of purpose, fighting for transparency and the ethical use of science.",
        location: "Hidden Resistance Hideout",
        readTime: "5 min read",
        x: 250,
        y: 350,
        isLocked: false,
        connectedNodes: ["underground-network", "final-stand"],
        choices: [
          {
            id: "lead-mission",
            text: "Lead a critical mission",
            description: "Use your knowledge to strike a blow against the conspiracy.",
            icon: "fas fa-bullseye",
            nextNode: "underground-network"
          },
          {
            id: "seek-asylum",
            text: "Seek asylum in a neutral country",
            description: "Try to expose the truth from a safe haven.",
            icon: "fas fa-flag",
            nextNode: "final-stand"
          }
        ]
      }
    ];

    const nodes: InsertStoryNode[] = [
      {
        id: "origin",
        title: "The Genesis Protocol",
        content: `The laboratory hummed with an otherworldly resonance as Dr. Sarah Chen approached the quantum containment field. The equations that had consumed her thoughts for months suddenly crystallized into a singular, terrifying realization.

"The parallel dimensions aren't theoretical," she whispered to herself, watching the particles dance in impossible patterns within the containment field. "They're bleeding through."

The discovery would change everything. Reality itself was more fragile than anyone had imagined, and the barriers between dimensions were weakening with each passing moment.`,
        location: "Quantum Research Laboratory - Level B7",
        readTime: "3 min read",
        x: 150,
        y: 100,
        isLocked: false,
        connectedNodes: ["discovery", "alternative-path"],
        choices: [
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
        ]
      },
      {
        id: "discovery",
        title: "The Quantum Discovery",
        content: `Sarah's decision to investigate led her deeper into the mystery. The quantum field pulsed with increasing intensity, and the readings were unlike anything in the scientific literature.

As she manipulated the field controls, reality seemed to ripple around her. Through the containment field, she could see glimpses of another world - one where the laws of physics operated differently.

"System log: Quantum fluctuation detected at 15:42:07. Dimensional barrier stability: 73.2%. Recommended action: Immediate evacuation."

But Sarah couldn't leave. Not when she was so close to understanding the nature of reality itself.`,
        location: "Research Laboratory - Level B7",
        readTime: "4 min read",
        x: 300,
        y: 150,
        isLocked: false,
        connectedNodes: ["revelation", "paradox"],
        choices: [
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
      },
      {
        id: "revelation",
        title: "The Stabilization Attempt",
        content: `Working frantically with the quantum field controls, Sarah managed to reduce the fluctuations. The dimensional breach began to stabilize, but not before she caught a clear glimpse of the other side.

What she saw challenged everything she thought she knew about the universe. The parallel dimension wasn't just different - it was inhabited. And the beings there were trying to communicate.

The stabilization held, but the connection remained. Sarah realized she had become the first human to establish contact with a parallel dimension. The implications were staggering.`,
        location: "Research Laboratory - Level B7",
        readTime: "3 min read",
        x: 300,
        y: 280,
        isLocked: false,
        connectedNodes: ["contact", "isolation"],
        choices: [
          {
            id: "communicate",
            text: "Attempt to communicate with the entities",
            description: "Try to establish a dialogue across dimensions.",
            icon: "fas fa-comments",
            nextNode: "contact"
          },
          {
            id: "isolate",
            text: "Isolate the dimensional breach",
            description: "Prevent any further contact for safety.",
            icon: "fas fa-shield-alt",
            nextNode: "isolation"
          }
        ]
      },
      {
        id: "alternative-path",
        title: "The Authority Response",
        content: `Sarah's decision to contact the authorities set in motion a chain of events she couldn't have anticipated. Within hours, the laboratory was swarming with government officials, military personnel, and scientists from classified programs.

"Dr. Chen," the lead official said, his expression grave, "what you've discovered has been theorized for decades. We've been preparing for this moment."

It became clear that the government had been aware of dimensional research and its implications. Sarah found herself at the center of a much larger conspiracy.`,
        location: "Secure Government Facility",
        readTime: "4 min read",
        x: 100,
        y: 250,
        isLocked: false,
        connectedNodes: ["conspiracy", "resistance"],
        choices: [
          {
            id: "cooperate",
            text: "Cooperate with the authorities",
            description: "Work within the system to understand the implications.",
            icon: "fas fa-handshake",
            nextNode: "conspiracy"
          },
          {
            id: "resist",
            text: "Resist the government takeover",
            description: "Fight to keep the research independent.",
            icon: "fas fa-fist-raised",
            nextNode: "resistance"
          }
        ]
      },
      {
        id: "contact",
        title: "First Contact Protocol",
        content: `The communication attempt succeeded beyond Sarah's wildest dreams. The entities from the parallel dimension were not only intelligent but had been trying to contact this dimension for years.

Through a complex system of quantum entanglement patterns, they conveyed a warning: their dimension was collapsing, and the dimensional breaches were becoming more frequent. They needed help to prevent a catastrophic merger of realities.

Sarah realized she held the key to preventing an interdimensional catastrophe - or potentially causing one.`,
        location: "Interdimensional Communication Hub",
        readTime: "5 min read",
        x: 180,
        y: 380,
        isLocked: false,
        connectedNodes: ["salvation", "sacrifice"],
        choices: [
          {
            id: "help",
            text: "Agree to help stabilize their dimension",
            description: "Work together to prevent dimensional collapse.",
            icon: "fas fa-hands-helping",
            nextNode: "salvation"
          },
          {
            id: "refuse",
            text: "Refuse to risk our dimension",
            description: "Prioritize the safety of our own reality.",
            icon: "fas fa-times-circle",
            nextNode: "sacrifice"
          }
        ]
      },
      {
        id: "paradox",
        title: "The Paradox Unveiled",
        content: `Stepping through the dimensional breach, Sarah found herself in a world that was hauntingly familiar yet utterly alien. The laws of physics operated differently here, and time seemed to flow in strange patterns.

But the most shocking discovery was yet to come. In this parallel dimension, she encountered another version of herself - one who had made different choices and lived a different life.

"You shouldn't have come here," her alternate self warned. "The barriers are weakening. Soon, all realities will collapse into one, and only the strongest version will survive."`,
        location: "Parallel Dimension - Mirror Laboratory",
        readTime: "6 min read",
        x: 420,
        y: 380,
        isLocked: false,
        connectedNodes: ["merge", "conflict"],
        choices: [
          {
            id: "merge",
            text: "Attempt to merge the realities safely",
            description: "Work with your alternate self to control the merger.",
            icon: "fas fa-link",
            nextNode: "merge"
          },
          {
            id: "fight",
            text: "Fight for dimensional supremacy",
            description: "Ensure your reality remains dominant.",
            icon: "fas fa-sword",
            nextNode: "conflict"
          }
        ]
      }
    ].concat(additionalNodes, expansionNodes);

    nodes.forEach(node => {
      this.storyNodes.set(node.id, node as StoryNode);
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
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getStoryNode(id: string): Promise<StoryNode | undefined> {
    return this.storyNodes.get(id);
  }

  async getAllStoryNodes(): Promise<StoryNode[]> {
    return Array.from(this.storyNodes.values());
  }

  async createStoryNode(node: InsertStoryNode): Promise<StoryNode> {
    const storyNode: StoryNode = node as StoryNode;
    this.storyNodes.set(node.id, storyNode);
    return storyNode;
  }

  async getUserProgress(userId: string): Promise<UserProgress | undefined> {
    return this.userProgress.get(userId);
  }

  async updateUserProgress(userId: string, progress: Partial<UserProgress>): Promise<UserProgress> {
    const existing = this.userProgress.get(userId);
    if (!existing) {
      throw new Error("User progress not found");
    }
    
    const updated: UserProgress = {
      ...existing,
      ...progress,
      updatedAt: new Date(),
    };
    
    this.userProgress.set(userId, updated);
    return updated;
  }

  async createUserProgress(progress: InsertUserProgress): Promise<UserProgress> {
    const id = this.currentProgressId++;
    const userProgress: UserProgress = {
      id,
      ...progress,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.userProgress.set(progress.userId, userProgress);
    return userProgress;
  }
}

export const storage = new MemStorage();
