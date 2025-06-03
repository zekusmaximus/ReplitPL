import { useState, useEffect, useRef } from "react";
import type { StoryNode } from "@shared/schema";

interface Transition {
  id: string; // Unique ID for React key
  fromNodeId: string;
  toNodeId: string;
  timestamp: number;
}
const MAX_TRAILS = 3; // Max number of trails to show
const TRAIL_DURATION = 5000; // 5 seconds in milliseconds

interface MapPanelProps {
  nodes: StoryNode[];
  visitedNodes: string[];
  currentNodeId: string;
  onNodeClick: (nodeId: string) => void;
}

export default function MapPanel({ nodes, visitedNodes, currentNodeId, onNodeClick }: MapPanelProps) {
  const [visitFrequency, setVisitFrequency] = useState<Record<string, number>>({});
  const [recentTransitions, setRecentTransitions] = useState<Transition[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [traversalFrequency, setTraversalFrequency] = useState<Record<string, number>>({});
  const [nodeVisitTimestamps, setNodeVisitTimestamps] = useState<Record<string, number>>({});
  const prevNodeIdRef = useRef<string | null>(null);

  const getEdgeKey = (nodeId1: string, nodeId2: string): string => {
    return [nodeId1, nodeId2].sort().join('-');
  };

  useEffect(() => {
    if (currentNodeId) {
      // Update visit frequency
      setVisitFrequency(prevFrequency => ({
        ...prevFrequency,
        [currentNodeId]: (prevFrequency[currentNodeId] || 0) + 1,
      }));

      // Add new transition if prevNodeId exists
      if (prevNodeIdRef.current && prevNodeIdRef.current !== currentNodeId) {
        const newTransition: Transition = {
          id: `trail-${Date.now()}-${prevNodeIdRef.current}-${currentNodeId}`,
          fromNodeId: prevNodeIdRef.current,
          toNodeId: currentNodeId,
          timestamp: Date.now(),
        };
        setRecentTransitions(prev => [newTransition, ...prev.slice(0, MAX_TRAILS - 1)]);

        const edgeKey = getEdgeKey(prevNodeIdRef.current, currentNodeId);
        setTraversalFrequency(prevFreq => ({
          ...prevFreq,
          [edgeKey]: (prevFreq[edgeKey] || 0) + 1,
        }));
      }
      prevNodeIdRef.current = currentNodeId;
      setNodeVisitTimestamps(prevTimestamps => ({
        ...prevTimestamps,
        [currentNodeId]: Date.now(),
      }));
    }
  }, [currentNodeId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setRecentTransitions(prevTransitions =>
        prevTransitions.filter(t => now - t.timestamp < TRAIL_DURATION)
      );
    }, 1000); // Check every second
    return () => clearInterval(timer);
  }, []);

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

  const isNodeClickable = (nodeId: string) => {
    const state = getNodeState(nodeId);
    return state === "visited" || state === "current" || state === "available";
  };

  const getNodeBackgroundStyle = (nodeId: string, state: string): React.CSSProperties => {
    const lastVisitedTimestamp = nodeVisitTimestamps[nodeId];
    const now = Date.now();
    let baseFromColor = "hsl(225, 6%, 25%)";
    let baseToColor = "hsla(225, 6%, 25%, 0.6)";

    let fromHue = 225, fromSat = 6, fromLight = 25;
    let toHue = 225, toSat = 6, toLight = 25, toAlpha = 0.6;

    if (state === "current") {
      fromHue = 35; fromSat = 91; fromLight = 51;
      toHue = 35; toSat = 91; toLight = 51; toAlpha = 0.6;
    } else if (state === "visited" || state === "available") {
      fromHue = 195; fromSat = 80; fromLight = 50;
      toHue = 195; toSat = 80; toLight = 50; toAlpha = 0.6;
    }

    if (lastVisitedTimestamp && (state === "current" || state === "visited")) {
      const ageMillis = now - lastVisitedTimestamp;
      const maxFreshnessDuration = 15000;

      if (ageMillis < maxFreshnessDuration) {
        const freshnessFactor = 1 - (ageMillis / maxFreshnessDuration);

        fromLight = Math.min(100, fromLight + freshnessFactor * 15);
        fromSat = Math.min(100, fromSat + freshnessFactor * 15);
        toLight = Math.min(100, toLight + freshnessFactor * 15);
        toAlpha = Math.min(1, toAlpha + freshnessFactor * 0.3);
      }
    }

    baseFromColor = `hsl(${fromHue}, ${fromSat}%, ${fromLight}%)`;
    baseToColor = `hsla(${toHue}, ${toSat}%, ${toLight}%, ${toAlpha})`;

    return {
      background: `linear-gradient(to bottom right, ${baseFromColor}, ${baseToColor})`,
    };
  };

  const getGlowStyle = (nodeId: string, state: string) => {
    const frequency = visitFrequency[nodeId] || 0;
    let glowColor = "rgba(74, 222, 128, 0)"; // Default transparent glow
    const baseBlur = 5;
    const baseSpread = 3;

    if (state === "current") {
      glowColor = "rgba(251, 191, 36, 0.6)"; // Amber for current
    } else if (state === "visited" || state === "available") {
      glowColor = "rgba(56, 189, 248, 0.5)"; // Cyan for visited/available
    }

    if (frequency > 0 && state !== "locked") {
      const intensity = Math.min(frequency / 5, 1); // Cap intensity at 5 visits
      const blur = baseBlur + intensity * 15; // Max blur e.g. 20px
      const spread = baseSpread + intensity * 7; // Max spread e.g. 10px
      const alpha = 0.3 + intensity * 0.4; // Max alpha e.g. 0.7 for visited

      if (state === "current") {
          glowColor = `rgba(251, 191, 36, ${0.5 + intensity * 0.3})`; // Current node more intense
      } else {
          glowColor = `rgba(56, 189, 248, ${alpha})`;
      }
      return { boxShadow: `0 0 ${blur}px ${spread}px ${glowColor}` };
    }
    return { boxShadow: `0 0 ${baseBlur}px ${baseSpread}px ${glowColor}`};
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

                const edgeKey = getEdgeKey(node.id, connectedId);
                const frequency = traversalFrequency[edgeKey] || 0;

                const baseStrokeWidth = 2.5;
                const maxStrokeWidth = 6;
                const dynamicStrokeWidth = Math.min(baseStrokeWidth + frequency * 0.5, maxStrokeWidth);
                
                return (
                  <line
                    key={`${node.id}-${connectedId}`}
                    x1={node.x}
                    y1={node.y}
                    x2={connectedNode.x}
                    y2={connectedNode.y}
                    className="connection-line"
                    strokeWidth={dynamicStrokeWidth}
                    filter="url(#glow)"
                  />
                );
              })
            )).flat().filter(Boolean)}

            {/* Memory Trails */}
            {recentTransitions.map(transition => {
              const fromNode = nodes.find(n => n.id === transition.fromNodeId);
              const toNode = nodes.find(n => n.id === transition.toNodeId);

              if (!fromNode || !toNode) return null;

              const age = Date.now() - transition.timestamp;
              const opacity = Math.max(0, 1 - age / TRAIL_DURATION); // Fades out

              return (
                <line
                  key={transition.id}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  className="memory-trail-line"
                  strokeOpacity={opacity}
                  filter="url(#glow)"
                />
              );
            })}

            {/* Energy Flow Animation */}
            {(() => {
              if (recentTransitions.length > 0) {
                const activeTransition = recentTransitions[0];
                const fromNode = nodes.find(n => n.id === activeTransition.fromNodeId);
                const toNode = nodes.find(n => n.id === activeTransition.toNodeId);
                const age = Date.now() - activeTransition.timestamp;
                const animationDuration = 1500; // 1.5 seconds in milliseconds

                if (fromNode && toNode && age < animationDuration) {
                  return (
                    <line
                      key={`energy-${activeTransition.id}`}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      className="energy-flow-line"
                    />
                  );
                }
              }
              return null;
            })()}
          </svg>

          {/* Story Nodes Positioned Absolutely */}
          {nodes.map(node => {
            const state = getNodeState(node.id);
            // const colors = getNodeColors(state); // No longer used for button background
            const isClickable = isNodeClickable(node.id);
            const isLocked = state === "locked";
            
            const currentGlowStyle = getGlowStyle(node.id, state);
            const currentBackgroundStyle = getNodeBackgroundStyle(node.id, state);

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
                    w-16 h-16 rounded-full
                    flex items-center justify-center text-space font-orbitron font-bold text-sm
                    transition-all duration-300
                    ${isClickable && !isLocked ? 'hover:text-white cursor-pointer' : ''}
                    ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
                    ${state === "current" ? 'animate-pulse-strong' : ''}
                  `}
                  style={{ ...currentGlowStyle, ...currentBackgroundStyle }}
                  onClick={() => isClickable && onNodeClick(node.id)}
                  disabled={!isClickable}
                  onMouseEnter={() => {
                    if (!isLocked) setHoveredNodeId(node.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredNodeId(null);
                  }}
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

          {/* Tooltip Overlay */}
          {hoveredNodeId && (() => {
            const hoveredNode = nodes.find(n => n.id === hoveredNodeId);
            if (!hoveredNode) return null;

            const frequency = visitFrequency[hoveredNode.id] || 0;
            const tooltipX = (hoveredNode.x / 600) * 100; // percentage
            const tooltipY = (hoveredNode.y / 500) * 100; // percentage

            return (
              <div
                className="absolute p-3 bg-navy/90 border border-cyan rounded-md shadow-xl text-sm text-soft-white max-w-xs tooltip-fade-in"
                style={{
                  left: `${tooltipX}%`,
                  top: `${tooltipY}%`,
                  transform: 'translate(-50%, -110%)', // Position above and centered
                  pointerEvents: 'none', // Ensure tooltip doesn't interfere with mouse events on nodes
                }}
              >
                <h4 className="font-orbitron text-base text-amber mb-1">{hoveredNode.title}</h4>
                <p className="text-xs text-cool-gray mb-2 whitespace-pre-wrap leading-relaxed" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {hoveredNode.content || "No additional details available."}
                </p>
                <p className="text-xs text-cyan">Visit Count: {frequency}</p>
              </div>
            );
          })()}
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
