import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import MapPanel from "@/components/MapPanel";
import StoryPanel from "@/components/StoryPanel";
import MobileStoryModal from "@/components/MobileStoryModal";
import { apiRequest } from "@/lib/queryClient";
import type { StoryNode, UserProgress } from "@shared/schema";

export default function StoryPage() {
  const [userId] = useState(() => `user_${Date.now()}`);
  const [isMobileStoryOpen, setIsMobileStoryOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch all story nodes
  const { data: nodes = [] } = useQuery<StoryNode[]>({
    queryKey: ["/api/story/nodes"],
  });

  // Fetch user progress
  const { data: progress } = useQuery<UserProgress>({
    queryKey: [`/api/progress/${userId}`],
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async (newProgress: Partial<UserProgress>) => {
      const response = await apiRequest("PATCH", `/api/progress/${userId}`, newProgress);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/progress/${userId}`] });
    },
  });

  // Make choice mutation
  const makeChoiceMutation = useMutation({
    mutationFn: async ({ nodeId, choiceId }: { nodeId: string; choiceId: string }) => {
      console.log(`[CLIENT LOG] makeChoiceMutation: Making choice on node '${nodeId}' with choiceId '${choiceId}' for userId '${userId}'`); // Added log
      const response = await apiRequest("POST", "/api/story/choice", {
        userId,
        nodeId,
        choiceId,
      });
      if (!response.ok) { // Check if response is ok
        const errorData = await response.json().catch(() => ({ message: "Unknown error structure" }));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => { // data is the response from the server
      console.log("[CLIENT LOG] makeChoiceMutation successful. New progress:", data); // Added log
      // Automatically navigate to the new current node
      setSelectedNodeId(data.currentNode);
      queryClient.invalidateQueries({ queryKey: [`/api/progress/${userId}`] });
    },
    onError: (error) => { // Added onError
      console.error("[CLIENT ERROR] makeChoiceMutation failed:", error);
    }
  });

  const currentNode = progress?.currentNode ? nodes.find(n => n.id === progress.currentNode) : nodes.find(n => n.id === 'origin');
  const visitedNodes = progress?.visitedNodes || ['origin'];

  const handleNodeClick = (nodeId: string) => {
    if (!visitedNodes.includes(nodeId)) {
      return; // Node is locked
    }
    
    setSelectedNodeId(nodeId);
    updateProgressMutation.mutate({ currentNode: nodeId });
    
    // Open mobile modal on small screens
    if (window.innerWidth < 1024) {
      setIsMobileStoryOpen(true);
    }
  };

  const handleChoice = (choiceId: string) => {
    if (!currentNode) return;
    
    makeChoiceMutation.mutate({ 
      nodeId: currentNode.id, 
      choiceId 
    });
  };

  const saveProgress = () => {
    const saveData = {
      visitedNodes: progress?.visitedNodes || [],
      currentNode: progress?.currentNode || 'origin',
      choices: progress?.choices || [],
      isAudioEnabled: progress?.isAudioEnabled ?? true,
    };
    
    localStorage.setItem('project-leibniz-save', JSON.stringify(saveData));
    
    // Show success notification
    const event = new CustomEvent('show-toast', {
      detail: { message: 'Progress saved successfully' }
    });
    window.dispatchEvent(event);
  };

  const loadProgress = () => {
    const savedData = localStorage.getItem('project-leibniz-save');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        updateProgressMutation.mutate(data);
        
        const event = new CustomEvent('show-toast', {
          detail: { message: 'Progress loaded successfully' }
        });
        window.dispatchEvent(event);
      } catch (error) {
        const event = new CustomEvent('show-toast', {
          detail: { message: 'Failed to load progress' }
        });
        window.dispatchEvent(event);
      }
    }
  };

  const toggleAudio = () => {
    const newAudioState = !(progress?.isAudioEnabled ?? true);
    updateProgressMutation.mutate({ isAudioEnabled: newAudioState });
  };

  // Calculate progress percentage
  const progressPercentage = Math.round((visitedNodes.length / nodes.length) * 100);

  // Handle mobile responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileStoryOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-space text-soft-white font-inter overflow-hidden">
      <Header
        visitedNodesCount={visitedNodes.length}
        totalNodesCount={nodes.length}
        progressPercentage={progressPercentage}
        isAudioEnabled={progress?.isAudioEnabled ?? true}
        currentLocation={currentNode?.location || "Quantum Laboratory"}
        onSaveProgress={saveProgress}
        onLoadProgress={loadProgress}
        onToggleAudio={toggleAudio}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <MapPanel
          nodes={nodes}
          visitedNodes={visitedNodes}
          currentNodeId={progress?.currentNode || 'origin'}
          onNodeClick={handleNodeClick}
        />
        
        <div className="hidden lg:block lg:w-1/2">
          <StoryPanel
            currentNode={selectedNodeId ? nodes.find(n => n.id === selectedNodeId) || currentNode : currentNode}
            onChoice={handleChoice}
            isLoading={makeChoiceMutation.isPending}
          />
        </div>
      </div>

      <MobileStoryModal
        isOpen={isMobileStoryOpen}
        onClose={() => setIsMobileStoryOpen(false)}
        currentNode={selectedNodeId ? nodes.find(n => n.id === selectedNodeId) || currentNode : currentNode}
        onChoice={handleChoice}
        isLoading={makeChoiceMutation.isPending}
      />

      {/* Mobile breadcrumb */}
      <div className="lg:hidden px-6 py-3 bg-navy/50 border-t border-cyan/20">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-cool-gray">Path:</span>
          {visitedNodes.slice(-3).map((nodeId, index, arr) => {
            const node = nodes.find(n => n.id === nodeId);
            const isLast = index === arr.length - 1;
            return (
              <div key={nodeId} className="flex items-center space-x-2">
                <span className={isLast ? "text-amber" : "text-cyan"}>
                  {node?.title || nodeId}
                </span>
                {!isLast && <i className="fas fa-chevron-right text-cool-gray text-xs" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
