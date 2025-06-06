import { useState, useEffect, useRef, useCallback } from "react"; // Added useCallback
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StoryNode } from "@shared/schema";

// interface Transition {
//   id: string; // Unique ID for React key
//   fromNodeId: string;
//   toNodeId: string;
//   timestamp: number;
// }
// const MAX_TRAILS = 3; // Max number of trails to show
// const TRAIL_DURATION = 5000; // 5 seconds in milliseconds

// Define triangleNodeConfiguration near the top of the file
const triangleNodeConfiguration = {
  // ARCHAEOLOGIST CHARACTER (Discovery & Ancient Knowledge)
  'origin': { characterType: 'archaeologist', nodeRole: 'center' },
  'discovery': { characterType: 'archaeologist', nodeRole: 'perspective', characterIndex: 0 },
  'revelation': { characterType: 'archaeologist', nodeRole: 'perspective', characterIndex: 1 },
  'contact': { characterType: 'archaeologist', nodeRole: 'perspective', characterIndex: 2 },

  // ALGORITHM CHARACTER (Digital Consciousness & AI)
  'paradox': { characterType: 'algorithm', nodeRole: 'center' },
  'merge': { characterType: 'algorithm', nodeRole: 'perspective', characterIndex: 0 },
  'conflict': { characterType: 'algorithm', nodeRole: 'perspective', characterIndex: 1 },
  'alternative-path': { characterType: 'algorithm', nodeRole: 'perspective', characterIndex: 2 },

  // LAST HUMAN CHARACTER (Isolation & Choice)
  'isolation': { characterType: 'last-human', nodeRole: 'center' },
  'salvation': { characterType: 'last-human', nodeRole: 'perspective', characterIndex: 0 },
  'sacrifice': { characterType: 'last-human', nodeRole: 'perspective', characterIndex: 1 },
  'evacuation': { characterType: 'last-human', nodeRole: 'perspective', characterIndex: 2 }
};

// Implement calculateTrianglePosition
const calculateTrianglePosition = (nodeId: string): { x: number, y: number, z: number } => {
  const nodeConfig = triangleNodeConfiguration[nodeId as keyof typeof triangleNodeConfiguration];
  if (!nodeConfig) {
    console.warn(`No triangle configuration found for node ID: ${nodeId}`);
    return { x: 0, y: 0, z: 0 }; // Default position if node not in config
  }

  const characterPositions = {
    'archaeologist': { angle: Math.PI / 2, radius: 12, x: 0, y: 0, z: 0 }, // Top
    'algorithm': { angle: 7 * Math.PI / 6, radius: 12, x: 0, y: 0, z: 0 }, // Bottom left
    'last-human': { angle: 11 * Math.PI / 6, radius: 12, x: 0, y: 0, z: 0 } // Bottom right
  };

  // Calculate center positions first
  Object.keys(characterPositions).forEach(charType => {
    const charKey = charType as keyof typeof characterPositions;
    characterPositions[charKey].x = characterPositions[charKey].radius * Math.cos(characterPositions[charKey].angle);
    characterPositions[charKey].y = characterPositions[charKey].radius * Math.sin(characterPositions[charKey].angle);
  });

  const centerPos = characterPositions[nodeConfig.characterType as keyof typeof characterPositions];

  if (nodeConfig.nodeRole === 'center') {
    return {
      x: centerPos.x,
      y: centerPos.y,
      z: 0
    };
  } else if (nodeConfig.nodeRole === 'perspective' && 'characterIndex' in nodeConfig) {
    const subRadius = 4;
    // Ensure characterIndex is treated as a number for calculations
    const charIndex = Number(nodeConfig.characterIndex);
    const subAngle = centerPos.angle + (charIndex * 2 * Math.PI / 3) + (Math.PI / 6); // Add offset for sub-triangle rotation

    return {
      x: centerPos.x + subRadius * Math.cos(subAngle),
      y: centerPos.y + subRadius * Math.sin(subAngle),
      z: (charIndex - 1) * 2 // Slight Z variation for depth
    };
  } else {
    // Fallback for unexpected config
    return {
      x: centerPos.x,
      y: centerPos.y,
      z: 0
    };
  }
};

// Implement projectToScreen
const projectToScreen = (worldPosition: THREE.Vector3, camera: THREE.Camera, renderer: THREE.WebGLRenderer): { x: number, y: number } | null => {
  if (!camera || !renderer) return null; // Guard against null camera/renderer

  const vector = worldPosition.clone();
  vector.project(camera);

  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Check if the point is behind the camera
  // if (vector.z > 1) { // This check might be needed if points behind camera cause issues
  //   return null;
  // }

  return {
    x: ((vector.x + 1) / 2) * rect.width + rect.left, // Add rect.left for absolute screen position
    y: ((-vector.y + 1) / 2) * rect.height + rect.top // Add rect.top for absolute screen position
  };
};

interface MapPanelProps {
  nodes: StoryNode[];
  visitedNodes: string[];
  currentNodeId: string;
  onNodeClick: (nodeId: string) => void;
}

export default function MapPanel({ nodes, visitedNodes, currentNodeId, onNodeClick }: MapPanelProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const requestRef = useRef<number | null>(null);
  const nodesGroupRef = useRef<THREE.Group>(new THREE.Group());
  const testCubeRef = useRef<THREE.Mesh | null>(null); // Ref for the test cube
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);

  const [visitFrequency, setVisitFrequency] = useState<Record<string, number>>({});
  // const [recentTransitions, setRecentTransitions] = useState<Transition[]>([]); // Still for SVG, can be removed if not adapted
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null); // Keep for HTML tooltips for now
  // const [traversalFrequency, setTraversalFrequency] = useState<Record<string, number>>({}); // Still for SVG
  const [nodeVisitTimestamps, setNodeVisitTimestamps] = useState<Record<string, number>>({});
  const [tooltipScreenPosition, setTooltipScreenPosition] = useState<{x: number, y: number} | null>(null); // New state for tooltip
  const prevNodeIdRef = useRef<string | null>(null);

  const getNodeState = (nodeId: string) => {
    if (nodeId === currentNodeId) return "current";
    if (visitedNodes.includes(nodeId)) return "visited";
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return "locked";
    
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

  // const getEdgeKey = (nodeId1: string, nodeId2: string): string => { // For SVG edges
  //   return [nodeId1, nodeId2].sort().join('-');
  // };

  useEffect(() => {
    // Three.js Initialization
    if (mountRef.current) {
      const currentMount = mountRef.current;
      // Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.add(nodesGroupRef.current); // Add the group to the scene

      // Camera - positioned for better 3D constellation viewing
      const camera = new THREE.PerspectiveCamera(
        60,
        currentMount.clientWidth / currentMount.clientHeight,
        0.1,
        100
      );
      camera.position.set(15, 10, 15); // Better angle to see the 3D constellation
      camera.lookAt(0, 0, 0); // Look at the center of the constellation
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      currentMount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Adjusted intensity
      scene.add(ambientLight);
      ambientLightRef.current = ambientLight;

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Adjusted intensity
      directionalLight.position.set(5, 10, 10); // Adjusted Z position
      scene.add(directionalLight);
      directionalLightRef.current = directionalLight;

      // OrbitControls - user-controlled only
      if (cameraRef.current && rendererRef.current.domElement) {
        const controls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controls.autoRotate = false; // Disable auto-rotation, user controls only
        controls.enableDamping = true;
        controls.dampingFactor = 0.05; // Smoother movement
        controls.enableZoom = true;
        controls.enablePan = true; // Allow panning to explore the constellation
        controls.minDistance = 8; // Closer minimum for detail viewing
        controls.maxDistance = 35; // Further maximum for full constellation view
        controls.target.set(0, 0, 0); // Center on constellation
        controls.minPolarAngle = 0; // Allow full vertical rotation
        controls.maxPolarAngle = Math.PI; // Allow full vertical rotation
        orbitControlsRef.current = controls;
      }

      // Particle System
      const particleCount = 500;
      const positions = new Float32Array(particleCount * 3);
      const particleGeometry = new THREE.BufferGeometry();
      const spread = 15;

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spread; // x
        positions[i * 3 + 1] = (Math.random() - 0.5) * spread; // y
        positions[i * 3 + 2] = (Math.random() - 0.5) * spread; // z
      }
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0x555555,
        size: 0.04, // Adjusted size
        transparent: true,
        opacity: 0.6, // Adjusted opacity
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      particleSystemRef.current = particles;
      scene.add(particleSystemRef.current);


      // Example Cube (keep it for now, but store in ref)
      const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2); // Smaller cube
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
      testCubeRef.current = new THREE.Mesh(geometry, material);
      // scene.add(testCubeRef.current); // Add it if you want to see it for debugging

      // Animation loop
      const animate = () => {
        orbitControlsRef.current?.update(); // Update controls

        if (particleSystemRef.current) {
          particleSystemRef.current.rotation.y += 0.0002;
          particleSystemRef.current.rotation.x += 0.0001;
        }

        nodesGroupRef.current.children.forEach(child => {
          const mesh = child as THREE.Mesh; // Cast to Mesh
          if (mesh.userData.nodeId) {
            const state = getNodeState(mesh.userData.nodeId);
            let rotationSpeedX = 0;
            let rotationSpeedY = 0;

            if (state === "current") {
              rotationSpeedX = 0.005;
              rotationSpeedY = 0.007;
            } else if (state === "visited") {
              rotationSpeedX = 0.002;
              rotationSpeedY = 0.003;
            } else if (state === "available") {
              rotationSpeedX = 0.001;
              rotationSpeedY = 0.001;
            }
            // 'locked' nodes will have 0 speed by default

            mesh.rotation.x += rotationSpeedX;
            mesh.rotation.y += rotationSpeedY;
          }
        });

        // Animate shimmer effect on active connection lines
        if (sceneRef.current) {
          sceneRef.current.children.forEach(child => {
            if (child.userData.isConnectionLine && child.userData.isActive) {
              const line = child as THREE.Line;
              const material = line.material as THREE.LineBasicMaterial;
              const time = Date.now() * 0.003; // Time-based animation
              const shimmerPhase = child.userData.shimmerPhase || 0;
              
              // Create shimmer effect by oscillating opacity
              const shimmerIntensity = 0.3; // How much the opacity varies
              const shimmerSpeed = 2.0; // How fast it shimmers
              const baseOpacity = child.userData.baseOpacity || 0.8;
              
              material.opacity = baseOpacity + Math.sin(time * shimmerSpeed + shimmerPhase) * shimmerIntensity;
              material.opacity = Math.max(0.2, Math.min(1.0, material.opacity)); // Clamp between 0.2 and 1.0
            }
          });
        }

        // testCubeRef.current?.rotation.x += 0.01; // Example animation for the test cube
        // testCubeRef.current?.rotation.y += 0.01;
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        requestRef.current = requestAnimationFrame(animate);
      };
      animate();

      // Handle Resize
      const handleResize = () => {
        if (cameraRef.current && rendererRef.current && currentMount) {
          cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
        }
      };
      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
        if (rendererRef.current) {
          rendererRef.current.dispose();
          if (rendererRef.current.domElement.parentElement === currentMount) {
             currentMount.removeChild(rendererRef.current.domElement);
          }
        }
        // sceneRef.current?.clear(); // Dispose geometries, materials etc. if needed
        nodesGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        nodesGroupRef.current.clear();
        if (testCubeRef.current) {
            testCubeRef.current.geometry.dispose();
            const material = testCubeRef.current.material;
            if (Array.isArray(material)) {
              material.forEach(mat => mat.dispose());
            } else {
              material.dispose();
            }
        }
        orbitControlsRef.current?.dispose();
        if (particleSystemRef.current) {
          particleSystemRef.current.geometry?.dispose();
          const pMaterial = particleSystemRef.current.material as THREE.Material;
          pMaterial?.dispose();
          sceneRef.current?.remove(particleSystemRef.current);
        }
        // Lights don't strictly need disposal unless properties change a lot, but good practice:
        if (ambientLightRef.current) sceneRef.current?.remove(ambientLightRef.current);
        if (directionalLightRef.current) sceneRef.current?.remove(directionalLightRef.current);
        // No dispose method for lights themselves, they are just removed.
      };
    }
  }, [nodes]); // Remove currentNodeId to prevent camera jumping

  useEffect(() => {
    if (!sceneRef.current || !nodes || !nodesGroupRef.current) return;

    // Clear previous nodes
    nodesGroupRef.current.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    nodesGroupRef.current.clear(); // Remove all children from the group

    // Fractal constants
    const FRACTAL_THRESHOLD = 3;
    const FRACTAL_CHILD_COUNT = 3;
    const FRACTAL_CHILD_SCALE = 0.3;
    const FRACTAL_CHILD_OFFSET_RADIUS = 0.5; // This is relative to parent's position

    const characterColors = {
      'archaeologist': { base: 0x8B4513, emissive: 0xCD853F, accent: 0xDEB887 },
      'algorithm': { base: 0x0066CC, emissive: 0x00AAFF, accent: 0x4CAF50 },
      'last-human': { base: 0x8B0000, emissive: 0xFF4444, accent: 0xFF6B6B }
    };

    // Create and position new 3D nodes
    nodes.forEach((node) => {
      const nodeConfig = triangleNodeConfiguration[node.id as keyof typeof triangleNodeConfiguration];
      if (!nodeConfig) {
        console.warn(`Node ${node.id} not in triangleConfiguration, skipping mesh creation.`);
        return;
      }

      const { x: worldX, y: worldY, z: worldZ } = calculateTrianglePosition(node.id);

      const geometry = new THREE.IcosahedronGeometry(0.4, 1); // Adjusted size and detail

      const charColors = characterColors[nodeConfig.characterType as keyof typeof characterColors];
      const baseColorHex = charColors.base;
      let emissiveColorHex = 0x000000; // Default no emission
      let emissiveIntensity = 1.0;

      const material = new THREE.MeshStandardMaterial({
        color: baseColorHex, // Set base color initially
        roughness: 0.4,
        metalness: 0.2,
        transparent: false,
        opacity: 1.0,
      });

      const state = getNodeState(node.id);

      if (state === "current") {
        emissiveColorHex = charColors.emissive;
        emissiveIntensity = 1.5;
      } else if (state === "visited") {
        emissiveColorHex = charColors.emissive;
        emissiveIntensity = 1.0;
      } else if (state === "available") {
        emissiveColorHex = charColors.emissive; // Or a muted version: new THREE.Color(charColors.emissive).multiplyScalar(0.7).getHex();
        emissiveIntensity = 0.7;
        material.color.multiplyScalar(0.8); // Darken base slightly for available
      } else { // locked
        material.color.multiplyScalar(0.4); // Darken base significantly for locked
        emissiveColorHex = 0x111111; // Very dim emissive
        emissiveIntensity = 0.3;
        material.transparent = true;
        material.opacity = 0.6;
      }

      material.emissive.setHex(emissiveColorHex);
      material.emissiveIntensity = emissiveIntensity;

      // Freshness effect (applied on top of state-based emissive properties)
      const lastVisitedTimestamp = nodeVisitTimestamps[node.id];
      const now = Date.now();
      const MAX_FRESHNESS_DURATION = 30000; // 30 seconds
      const MIN_INTENSITY_FACTOR = 0.7;

      if (lastVisitedTimestamp && (state === 'current' || state === 'visited')) {
        const ageMillis = now - lastVisitedTimestamp;
        if (ageMillis < MAX_FRESHNESS_DURATION) {
          const freshnessFactor = 1 - (ageMillis / MAX_FRESHNESS_DURATION);
          const dynamicIntensityBonus = freshnessFactor * (1 - MIN_INTENSITY_FACTOR);
          // Apply freshness to the already state-modified intensity
          material.emissiveIntensity = (material.emissiveIntensity * MIN_INTENSITY_FACTOR) + (material.emissiveIntensity * dynamicIntensityBonus);
          if (state === 'current') {
            // Ensure current node maintains a minimum brightness if freshness would reduce it too much
            material.emissiveIntensity = Math.max(material.emissiveIntensity, 1.2);
          }
        } else if (state !== 'current') { // If older than max freshness duration and not current
          material.emissiveIntensity *= MIN_INTENSITY_FACTOR;
        }
      } else if (state !== 'current' && state !== 'available' && state !== 'locked') {
         // For 'visited' nodes without a timestamp (e.g., initial state), apply min intensity factor
        material.emissiveIntensity *= MIN_INTENSITY_FACTOR;
      }


      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(worldX, worldY, worldZ);
      mesh.userData = {
        nodeId: node.id,
        isFractalChild: false,
        characterType: nodeConfig.characterType,
        nodeRole: nodeConfig.nodeRole
      };
      nodesGroupRef.current.add(mesh);

      // Fractal Children
      const frequency = visitFrequency[node.id] || 0;
      if (frequency >= FRACTAL_THRESHOLD) {
        for (let i = 0; i < FRACTAL_CHILD_COUNT; i++) {
          const childGeometry = new THREE.IcosahedronGeometry(0.25 * FRACTAL_CHILD_SCALE, 0);
          const childMaterial = new THREE.MeshStandardMaterial({
            color: material.color.clone(), // Inherit base character color (already state adjusted)
            roughness: 0.7,
            metalness: material.metalness * 0.8,
            emissive: material.emissive.clone(), // Inherit emissive color (already state adjusted)
            emissiveIntensity: material.emissiveIntensity * 0.5, // Children less bright
          });
          if (material.opacity < 1) { // Inherit transparency
            childMaterial.transparent = true;
            childMaterial.opacity = material.opacity * 0.9;
          }

          const childMesh = new THREE.Mesh(childGeometry, childMaterial);
          const angle = (i / FRACTAL_CHILD_COUNT) * Math.PI * 2;

          // Position relative to the parent mesh's new world position
          childMesh.position.x = worldX + Math.cos(angle) * FRACTAL_CHILD_OFFSET_RADIUS;
          childMesh.position.y = worldY + Math.sin(angle) * FRACTAL_CHILD_OFFSET_RADIUS;
          childMesh.position.z = worldZ + (Math.random() - 0.5) * 0.2; // Keep Z variation

          childMesh.userData = {
            isFractalChild: true,
            parentNodeId: node.id
          };
          nodesGroupRef.current.add(childMesh);
        }
      }
    });

  }, [nodes, visitedNodes, currentNodeId, nodeVisitTimestamps, visitFrequency]); // Keep currentNodeId for visual updates only


  useEffect(() => {
    if (currentNodeId) {
      // Update visit frequency
      setVisitFrequency(prevFrequency => ({
        ...prevFrequency,
        [currentNodeId]: (prevFrequency[currentNodeId] || 0) + 1,
      }));

      // // Add new transition if prevNodeId exists - SVG specific, can be removed or adapted
      // if (prevNodeIdRef.current && prevNodeIdRef.current !== currentNodeId) {
      //   const newTransition: Transition = {
      //     id: `trail-${Date.now()}-${prevNodeIdRef.current}-${currentNodeId}`,
      //     fromNodeId: prevNodeIdRef.current,
      //     toNodeId: currentNodeId,
      //     timestamp: Date.now(),
      //   };
      //   setRecentTransitions(prev => [newTransition, ...prev.slice(0, MAX_TRAILS - 1)]);

      //   const edgeKey = getEdgeKey(prevNodeIdRef.current, currentNodeId);
      //   setTraversalFrequency(prevFreq => ({
      //     ...prevFreq,
      //     [edgeKey]: (prevFreq[edgeKey] || 0) + 1,
      //   }));
      // }
      prevNodeIdRef.current = currentNodeId;
      setNodeVisitTimestamps(prevTimestamps => ({
        ...prevTimestamps,
        [currentNodeId]: Date.now(),
      }));
    }
  }, [currentNodeId]);

  // useEffect(() => { // SVG specific for trails, can be removed
  //   const timer = setInterval(() => {
  //     const now = Date.now();
  //     setRecentTransitions(prevTransitions =>
  //       prevTransitions.filter(t => now - t.timestamp < TRAIL_DURATION)
  //     );
  //   }, 1000); // Check every second
  //   return () => clearInterval(timer);
  // }, []);

  useEffect(() => {
    if (
      !rendererRef.current ||
      !cameraRef.current ||
      !sceneRef.current ||
      !mountRef.current ||
      !nodesGroupRef.current
    ) {
      return;
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const currentMount = mountRef.current; // Capture for use in handleClick

    const handleClick = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current || !sceneRef.current || !nodesGroupRef.current || !currentMount) return;

      const rect = currentMount.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      const nodeMeshes = nodesGroupRef.current.children.filter(
        (child): child is THREE.Mesh =>
          child instanceof THREE.Mesh &&
          child.userData.nodeId &&
          !child.userData.isFractalChild
      );

      const intersects = raycaster.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh; // First intersected object
        const nodeId = clickedMesh.userData.nodeId;
        if (nodeId && isNodeClickable(nodeId)) {
          onNodeClick(nodeId);
        }
      }
    };

    const canvas = rendererRef.current.domElement;
    canvas.addEventListener('click', handleClick);

    const handleMouseMove = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current || !sceneRef.current || !nodesGroupRef.current || !currentMount) return;

      const rect = currentMount.getBoundingClientRect();
      if (!rect) return;

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      const nodeMeshes = nodesGroupRef.current.children.filter(
        (child): child is THREE.Mesh =>
          child instanceof THREE.Mesh &&
          child.userData.nodeId &&
          !child.userData.isFractalChild
      );

      const intersects = raycaster.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object as THREE.Mesh;
        const nodeId = hoveredMesh.userData.nodeId;

        if (nodeId && isNodeClickable(nodeId)) {
          canvas.style.cursor = 'pointer';
          setHoveredNodeId(nodeId);
          const worldPos3D = calculateTrianglePosition(nodeId);
          if (cameraRef.current && rendererRef.current) {
            const screenPos = projectToScreen(
              new THREE.Vector3(worldPos3D.x, worldPos3D.y, worldPos3D.z),
              cameraRef.current,
              rendererRef.current
            );
            setTooltipScreenPosition(screenPos);
          } else {
            setTooltipScreenPosition(null);
          }
        } else {
          canvas.style.cursor = 'default';
          setHoveredNodeId(null);
          setTooltipScreenPosition(null);
        }
      } else {
        canvas.style.cursor = 'default';
        setHoveredNodeId(null);
        setTooltipScreenPosition(null);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      // Reset cursor on cleanup in case it was left as pointer
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    };
  }, [nodes, visitedNodes, currentNodeId, onNodeClick, rendererRef, cameraRef, sceneRef, nodesGroupRef, mountRef, isNodeClickable, setHoveredNodeId]);

  useEffect(() => {
    if (!sceneRef.current || !nodes) return; // Hook for lines should also be reviewed for new positions

    // Remove existing lines
    const childrenToRemove = sceneRef.current.children.slice(); // Create a copy to iterate over
    childrenToRemove.forEach(child => {
      if (child.userData.isConnectionLine) {
        sceneRef.current!.remove(child);
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose(); // Type assertion for material
        }
      }
    });

    // Create new lines
    nodes.forEach(node => {
      if (node.connectedNodes) {
        node.connectedNodes.forEach(connectedNodeId => {
          const connectedNode = nodes.find(n => n.id === connectedNodeId);
          if (!connectedNode) return;

          // Ensure we don't draw a line from a node to itself
          if (node.id === connectedNode.id) return;

          // Calculate 3D positions for both nodes using the new calculateTrianglePosition function
          const pos1Config = triangleNodeConfiguration[node.id as keyof typeof triangleNodeConfiguration];
          const pos2Config = triangleNodeConfiguration[connectedNode.id as keyof typeof triangleNodeConfiguration];

          // Skip line if either node is not in the triangle configuration (should not happen if nodes prop is filtered)
          if (!pos1Config || !pos2Config) return;

          const pos1 = calculateTrianglePosition(node.id);
          const pos2 = calculateTrianglePosition(connectedNode.id);

          const points = [
            new THREE.Vector3(pos1.x, pos1.y, pos1.z),
            new THREE.Vector3(pos2.x, pos2.y, pos2.z)
          ];

          const geometry = new THREE.BufferGeometry().setFromPoints(points);

          const isActive = visitedNodes.includes(node.id) && visitedNodes.includes(connectedNodeId);
          const material = new THREE.LineBasicMaterial({
            color: isActive ? 0x16C79A : 0x555555, // Active: Greenish-Cyan, Inactive: Grey
            opacity: isActive ? 0.8 : 0.0, // Hide inactive lines completely
            transparent: true,
            linewidth: isActive ? 2 : 1, // Thicker for active lines (Note: linewidth might not be supported by all WebGL renderers)
          });

          const line = new THREE.Line(geometry, material);
          line.userData = { 
            isConnectionLine: true, 
            isActive: isActive,
            baseOpacity: isActive ? 0.8 : 0.0,
            shimmerPhase: Math.random() * Math.PI * 2 // Random phase for shimmer variation
          };
          sceneRef.current!.add(line);
        });
      }
    });
  }, [nodes, visitedNodes, currentNodeId, sceneRef]); // Dependencies for line updates

  // const getNodeBackgroundStyle = (nodeId: string, state: string): React.CSSProperties => {
  //   const lastVisitedTimestamp = nodeVisitTimestamps[nodeId];
  //   const now = Date.now();
  //   let baseFromColor = "hsl(225, 6%, 25%)";
  //   let baseToColor = "hsla(225, 6%, 25%, 0.6)";

  //   let fromHue = 225, fromSat = 6, fromLight = 25;
  //   let toHue = 225, toSat = 6, toLight = 25, toAlpha = 0.6;

  //   if (state === "current") {
  //     fromHue = 35; fromSat = 91; fromLight = 51;
  //     toHue = 35; toSat = 91; toLight = 51; toAlpha = 0.6;
  //   } else if (state === "visited" || state === "available") {
  //     fromHue = 195; fromSat = 80; fromLight = 50;
  //     toHue = 195; toSat = 80; toLight = 50; toAlpha = 0.6;
  //   }

  //   if (lastVisitedTimestamp && (state === "current" || state === "visited")) {
  //     const ageMillis = now - lastVisitedTimestamp;
  //     const maxFreshnessDuration = 15000;

  //     if (ageMillis < maxFreshnessDuration) {
  //       const freshnessFactor = 1 - (ageMillis / maxFreshnessDuration);

  //       fromLight = Math.min(100, fromLight + freshnessFactor * 15);
  //       fromSat = Math.min(100, fromSat + freshnessFactor * 15);
  //       toLight = Math.min(100, toLight + freshnessFactor * 15);
  //       toAlpha = Math.min(1, toAlpha + freshnessFactor * 0.3);
  //     }
  //   }

  //   baseFromColor = `hsl(${fromHue}, ${fromSat}%, ${fromLight}%)`;
  //   baseToColor = `hsla(${toHue}, ${toSat}%, ${toLight}%, ${toAlpha})`;

  //   return {
  //     background: `linear-gradient(to bottom right, ${baseFromColor}, ${baseToColor})`,
  //   };
  // };

  // const getGlowStyle = (nodeId: string, state: string) => {
  //   const frequency = visitFrequency[nodeId] || 0;
  //   let glowColor = "rgba(74, 222, 128, 0)"; // Default transparent glow
  //   const baseBlur = 5;
  //   const baseSpread = 3;

  //   if (state === "current") {
  //     glowColor = "rgba(251, 191, 36, 0.6)"; // Amber for current
  //   } else if (state === "visited" || state === "available") {
  //     glowColor = "rgba(56, 189, 248, 0.5)"; // Cyan for visited/available
  //   }

  //   if (frequency > 0 && state !== "locked") {
  //     const intensity = Math.min(frequency / 5, 1); // Cap intensity at 5 visits
  //     const blur = baseBlur + intensity * 15; // Max blur e.g. 20px
  //     const spread = baseSpread + intensity * 7; // Max spread e.g. 10px
  //     const alpha = 0.3 + intensity * 0.4; // Max alpha e.g. 0.7 for visited

  //     if (state === "current") {
  //         glowColor = `rgba(251, 191, 36, ${0.5 + intensity * 0.3})`; // Current node more intense
  //     } else {
  //         glowColor = `rgba(56, 189, 248, ${alpha})`;
  //     }
  //     return { boxShadow: `0 0 ${blur}px ${spread}px ${glowColor}` };
  //   }
  //   return { boxShadow: `0 0 ${baseBlur}px ${baseSpread}px ${glowColor}`};
  // };

  return (
    <div className="w-full lg:w-1/2 bg-gradient-to-br from-space to-navy relative overflow-hidden">
      {/* Particle Effects Background - Kept for now, can be removed later */}
      {/* <div className="absolute inset-0 overflow-hidden">
        <div className="particle" style={{ left: '20%', animationDelay: '0s' }}></div>
        <div className="particle" style={{ left: '60%', animationDelay: '2s' }}></div>
        <div className="particle" style={{ left: '80%', animationDelay: '4s' }}></div>
        <div className="particle" style={{ left: '40%', animationDelay: '1s' }}></div>
      </div> */}

      {/* Map Container */}
      <div className="relative h-full p-8">
        <div className="text-center mb-6">
          <h2 className="font-orbitron text-xl text-cyan mb-2">Narrative Constellation</h2>
          <p className="text-sm text-cool-gray">Click nodes to explore the story</p>
        </div>

        {/* Three.js Canvas Container */}
        <div ref={mountRef} className="relative w-full h-full" />

          {/* Story Nodes Positioned Absolutely - Commented out, replaced by Three.js rendering */}
          {/* {nodes.map(node => {
            const state = getNodeState(node.id);
            const isClickable = isNodeClickable(node.id);
            const isLocked = state === "locked";
            
            const placeholderStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${(node.x / 600) * 100}%`,
                top: `${(node.y / 500) * 100}%`,
                transform: 'translate(-50%, -50%)',
                padding: '10px',
                background: state === "current" ? "gold" : state === "visited" ? "cyan" : state === "available" ? "lightgreen" : "grey",
                borderRadius: '50%',
                color: 'black',
                cursor: isClickable ? 'pointer' : 'default',
                opacity: isLocked ? 0.5 : 1,
            };

            return (
              <div
                key={node.id}
                style={placeholderStyle}
                onClick={() => isClickable && onNodeClick(node.id)}
                onMouseEnter={() => {
                  if (!isLocked) setHoveredNodeId(node.id);
                }}
                onMouseLeave={() => {
                  setHoveredNodeId(null);
                }}
              >
                <button
                  className={`
                    w-16 h-16 rounded-full
                    flex items-center justify-center text-space font-orbitron font-bold text-sm
                    transition-all duration-300
                    ${isClickable && !isLocked ? 'hover:text-white' : ''}
                    ${isLocked ? 'cursor-not-allowed' : ''}
                    ${state === "current" ? 'animate-pulse-strong' : ''}
                  `}
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
          })} */}

          {/* Tooltip Overlay - Updated for new screen positioning */}
          {hoveredNodeId && tooltipScreenPosition && (() => {
            const hoveredNode = nodes.find(n => n.id === hoveredNodeId);
            if (!hoveredNode) return null;

            return (
              <div
                className="p-3 bg-navy/90 border border-cyan rounded-md shadow-xl text-sm text-soft-white max-w-xs tooltip-fade-in"
                style={{
                  position: 'fixed',
                  left: `${tooltipScreenPosition.x}px`,
                  top: `${tooltipScreenPosition.y - 100}px`, // Apply fixed offset as per plan
                  transform: 'translateX(-50%)', // Center horizontally
                  pointerEvents: 'none',
                }}
              >
                <h4 className="font-orbitron text-base text-amber mb-1">{hoveredNode.title}</h4>
                <p className="text-xs text-cool-gray mb-2 whitespace-pre-wrap leading-relaxed" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {hoveredNode.content || "No additional details available."}
                </p>
                 {/* <p className="text-xs text-cyan">Visit Count: {visitFrequency[hoveredNode.id] || 0}</p> */}
              </div>
            );
          })()}
        {/* </div> */}

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
