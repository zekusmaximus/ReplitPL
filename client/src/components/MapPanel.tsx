import type { StoryNode } from "@shared/schema";

interface MapPanelProps {
  nodes: StoryNode[];
  visitedNodes: string[];
  currentNodeId: string;
  onNodeClick: (nodeId: string) => void;
}

export default function MapPanel({ nodes, visitedNodes, currentNodeId, onNodeClick }: MapPanelProps) {
  const getNodeState = (nodeId: string) => {
    if (nodeId === currentNodeId) return "current";
    if (visitedNodes.includes(nodeId)) return "visited";
    
    // Check if node should be unlocked based on visited nodes
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return "locked";
    
    // A node is available if any of its connected nodes have been visited
    // or if it's connected to the origin and origin has been visited
    const hasConnectedVisitedNode = nodes.some(n => 
      visitedNodes.includes(n.id) && 
      n.connectedNodes?.includes(nodeId)
    );
    
    if (hasConnectedVisitedNode || (nodeId === "origin")) {
      return "available";
    }
    
    return "locked";
  };

  const getNodeColors = (state: string) => {
    switch (state) {
      case "current":
        return "from-amber to-amber/60 shadow-amber/30";
      case "visited":
        return "from-cyan to-cyan/60 shadow-cyan/30";
      case "available":
        return "from-cyan to-cyan/60 shadow-cyan/30";
      case "locked":
        return "from-cool-gray to-cool-gray/60 shadow-cool-gray/20";
      default:
        return "from-cool-gray to-cool-gray/60 shadow-cool-gray/20";
    }
  };

  const isNodeClickable = (nodeId: string) => {
    const state = getNodeState(nodeId);
    return state === "visited" || state === "current" || state === "available";
  };

  return (
    <div className="w-full lg:w-1/2 bg-gradient-to-br from-space to-navy relative overflow-hidden">
      {/* Particle Effects Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="particle" style={{ left: '20%', animationDelay: '0s' }}></div>
        <div className="particle" style={{ left: '60%', animationDelay: '2s' }}></div>
        <div className="particle" style={{ left: '80%', animationDelay: '4s' }}></div>
        <div className="particle" style={{ left: '40%', animationDelay: '1s' }}></div>
      </div>

      {/* Map Container */}
      <div className="relative h-full p-8">
        <div className="text-center mb-6">
          <h2 className="font-orbitron text-xl text-cyan mb-2">Narrative Constellation</h2>
          <p className="text-sm text-cool-gray">Click nodes to explore the story</p>
        </div>

        {/* SVG Map with Connections */}
        <div className="relative w-full h-full">
          <svg className="w-full h-full" viewBox="0 0 600 500">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Connection Lines */}
            {nodes.map(node => (
              node.connectedNodes?.map(connectedId => {
                const connectedNode = nodes.find(n => n.id === connectedId);
                if (!connectedNode) return null;
                
                return (
                  <line
                    key={`${node.id}-${connectedId}`}
                    x1={node.x}
                    y1={node.y}
                    x2={connectedNode.x}
                    y2={connectedNode.y}
                    className="connection-line"
                    filter="url(#glow)"
                  />
                );
              })
            )).flat().filter(Boolean)}
          </svg>

          {/* Story Nodes Positioned Absolutely */}
          {nodes.map(node => {
            const state = getNodeState(node.id);
            const colors = getNodeColors(state);
            const isClickable = isNodeClickable(node.id);
            const isLocked = state === "locked";
            
            return (
              <div
                key={node.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(node.x / 600) * 100}%`,
                  top: `${(node.y / 500) * 100}%`,
                }}
              >
                <button
                  className={`
                    w-16 h-16 bg-gradient-to-br ${colors} rounded-full 
                    flex items-center justify-center text-space font-orbitron font-bold text-sm
                    transition-all duration-300
                    ${isClickable && !isLocked ? 'node-glow hover:text-white cursor-pointer' : ''}
                    ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
                    ${state === "current" ? 'animate-pulse' : ''}
                  `}
                  onClick={() => isClickable && onNodeClick(node.id)}
                  disabled={!isClickable}
                >
                  {isLocked ? "?" : node.id.slice(0, 2).toUpperCase()}
                </button>
                <div className={`
                  mt-2 text-xs text-center font-medium
                  ${state === "current" ? "text-amber" : 
                    state === "visited" || state === "available" ? "text-cyan" : "text-cool-gray"}
                `}>
                  {isLocked ? "Locked" : node.title.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Zoom Controls */}
        <div className="absolute bottom-4 right-4 lg:hidden flex flex-col space-y-2">
          <button className="w-10 h-10 bg-navy/80 rounded-lg flex items-center justify-center text-cyan">
            <i className="fas fa-plus"></i>
          </button>
          <button className="w-10 h-10 bg-navy/80 rounded-lg flex items-center justify-center text-cyan">
            <i className="fas fa-minus"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
