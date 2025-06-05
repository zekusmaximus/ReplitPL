import { useState, useEffect, useRef } from "react";
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

      // OrbitControls - optimized for 3D constellation viewing
      if (cameraRef.current && rendererRef.current.domElement) {
        const controls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controls.autoRotate = true; // Enable gentle auto-rotation to show 3D depth
        controls.autoRotateSpeed = 0.5; // Slow rotation to showcase constellation
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
  }, [nodes, visitedNodes, currentNodeId]); // Add dependencies here

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
    const FRACTAL_CHILD_OFFSET_RADIUS = 0.5;

    // Create and position new 3D nodes with proper constellation spread
    nodes.forEach((node, index) => {
      // Create a more spherical 3D distribution
      const baseRadius = 8;
      const radiusVariation = 3;
      
      // Use node position as seed for consistent but varied placement
      const seedX = node.x / 600;
      const seedY = node.y / 500;
      const seedZ = (seedX + seedY) % 1;
      
      // Convert to spherical coordinates for constellation effect
      const phi = seedX * Math.PI * 2; // Azimuth angle
      const theta = seedY * Math.PI; // Polar angle
      const radius = baseRadius + (seedZ - 0.5) * radiusVariation;
      
      const worldX = radius * Math.sin(theta) * Math.cos(phi);
      const worldY = radius * Math.cos(theta);
      const worldZ = radius * Math.sin(theta) * Math.sin(phi);

      const geometry = new THREE.IcosahedronGeometry(0.4, 1); // Adjusted size and detail
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Default white
        roughness: 0.4, // Adjusted roughness
        metalness: 0.2, // Adjusted metalness
      });

      const state = getNodeState(node.id); // Get node state

      let baseColorHex = 0xffffff;
      let emissiveColorHex = 0x000000;
      let emissiveIntensity = 1.0;
      material.transparent = false; // Reset transparency
      material.opacity = 1.0;       // Reset opacity

      if (state === "current") {
        baseColorHex = 0xffaa33; // Amber base
        emissiveColorHex = 0xffaa33; // Amber emissive
        emissiveIntensity = 1.5;
      } else if (state === "visited") {
        baseColorHex = 0x00aaff; // Cyan base
        emissiveColorHex = 0x00aaff;
        emissiveIntensity = 1.0;
      } else if (state === "available") {
        baseColorHex = 0x0077cc; // Darker Cyan/Blue base
        emissiveColorHex = 0x0077cc;
        emissiveIntensity = 0.7;
      } else { // locked
        baseColorHex = 0x555555; // Grey base
        emissiveColorHex = 0x111111; // Very dim emissive
        emissiveIntensity = 0.5;
        material.transparent = true;
        material.opacity = 0.7;
      }
      material.color.setHex(baseColorHex);
      material.emissive.setHex(emissiveColorHex);
      material.emissiveIntensity = emissiveIntensity;

      // Freshness effect
      const lastVisitedTimestamp = nodeVisitTimestamps[node.id];
      const now = Date.now();
      const MAX_FRESHNESS_DURATION = 30000; // 30 seconds
      const MIN_INTENSITY_FACTOR = 0.7;

      if (lastVisitedTimestamp && (state === 'current' || state === 'visited')) {
        const ageMillis = now - lastVisitedTimestamp;
        if (ageMillis < MAX_FRESHNESS_DURATION) {
          const freshnessFactor = 1 - (ageMillis / MAX_FRESHNESS_DURATION);
          const dynamicIntensityBonus = freshnessFactor * (1 - MIN_INTENSITY_FACTOR);
          material.emissiveIntensity *= (MIN_INTENSITY_FACTOR + dynamicIntensityBonus);
          if (state === 'current') {
            material.emissiveIntensity = Math.max(material.emissiveIntensity, 1.2);
          }
        } else if (state !== 'current') {
          material.emissiveIntensity *= MIN_INTENSITY_FACTOR;
        }
      } else if (state !== 'current' && state !== 'available' && state !== 'locked') {
         // For nodes that are 'visited' but somehow don't have a timestamp (e.g. initial state)
        material.emissiveIntensity *= MIN_INTENSITY_FACTOR;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(worldX, worldY, worldZ);
      mesh.userData = { nodeId: node.id, isFractalChild: false }; // Mark as not a fractal child

      nodesGroupRef.current.add(mesh);

      // Fractal Children
      const frequency = visitFrequency[node.id] || 0;
      if (frequency >= FRACTAL_THRESHOLD) {
        for (let i = 0; i < FRACTAL_CHILD_COUNT; i++) {
          const childGeometry = new THREE.IcosahedronGeometry(0.25 * FRACTAL_CHILD_SCALE, 0);
          // Ensure child material also reflects freshness, or has its own logic
          const childMaterial = new THREE.MeshStandardMaterial({
            color: material.color.clone(), // Inherit base color
            roughness: 0.7, // Slightly higher roughness for children
            metalness: material.metalness * 0.8, // Slightly less metalness
            emissive: material.emissive.clone(), // Inherit emissive color
            emissiveIntensity: material.emissiveIntensity * 0.5, // Children are less bright than parent
          });
          if (material.opacity < 1) { // Inherit transparency from parent
            childMaterial.transparent = true;
            childMaterial.opacity = material.opacity * 0.9; // Slightly less transparent than parent
          }

          const childMesh = new THREE.Mesh(childGeometry, childMaterial);
          const angle = (i / FRACTAL_CHILD_COUNT) * Math.PI * 2;

          // Position relative to the parent mesh's actual world position
          childMesh.position.x = mesh.position.x + Math.cos(angle) * FRACTAL_CHILD_OFFSET_RADIUS;
          childMesh.position.y = mesh.position.y + Math.sin(angle) * FRACTAL_CHILD_OFFSET_RADIUS;
          childMesh.position.z = mesh.position.z + (Math.random() - 0.5) * 0.2;

          childMesh.userData = {
            isFractalChild: true,
            parentNodeId: node.id
          };
          nodesGroupRef.current.add(childMesh);
        }
      }
    });

  }, [nodes, visitedNodes, currentNodeId, nodeVisitTimestamps, visitFrequency]); // Added visitFrequency


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
        } else {
          canvas.style.cursor = 'default';
          setHoveredNodeId(null);
        }
      } else {
        canvas.style.cursor = 'default';
        setHoveredNodeId(null);
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
    if (!sceneRef.current || !nodes) return;

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

          // Ensure we don't draw a line from a node to itself (though typically not in connectedNodes)
          if (node.id === connectedNode.id) return;

          // Calculate 3D positions for both nodes using same logic as node positioning
          const calculateNodePosition = (nodeData: any) => {
            const baseRadius = 8;
            const radiusVariation = 3;
            
            const seedX = nodeData.x / 600;
            const seedY = nodeData.y / 500;
            const seedZ = (seedX + seedY) % 1;
            
            const phi = seedX * Math.PI * 2;
            const theta = seedY * Math.PI;
            const radius = baseRadius + (seedZ - 0.5) * radiusVariation;
            
            return {
              x: radius * Math.sin(theta) * Math.cos(phi),
              y: radius * Math.cos(theta),
              z: radius * Math.sin(theta) * Math.sin(phi)
            };
          };

          const pos1 = calculateNodePosition(node);
          const pos2 = calculateNodePosition(connectedNode);

          const worldX1 = pos1.x;
          const worldY1 = pos1.y;
          const worldZ1 = pos1.z;

          const worldX2 = pos2.x;
          const worldY2 = pos2.y;
          const worldZ2 = pos2.z;

          const points = [
            new THREE.Vector3(worldX1, worldY1, worldZ1),
            new THREE.Vector3(worldX2, worldY2, worldZ2)
          ];

          const geometry = new THREE.BufferGeometry().setFromPoints(points);

          const isActive = visitedNodes.includes(node.id) && visitedNodes.includes(connectedNodeId);
          const material = new THREE.LineBasicMaterial({
            color: isActive ? 0x16C79A : 0x555555, // Active: Greenish-Cyan, Inactive: Grey
            opacity: isActive ? 0.8 : 0.3,
            transparent: true,
            linewidth: isActive ? 2 : 1, // Thicker for active lines (Note: linewidth might not be supported by all WebGL renderers)
          });
          // For LineDashedMaterial, if you want to use it later:
          // const material = new THREE.LineDashedMaterial({
          //   color: isActive ? 0x16C79A : 0x555555,
          //   dashSize: 0.1,
          //   gapSize: 0.05,
          //   opacity: isActive ? 0.8 : 0.3,
          //   transparent: true,
          // });

          const line = new THREE.Line(geometry, material);
          // line.computeLineDistances(); // Required for LineDashedMaterial

          line.userData = { isConnectionLine: true };
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

          {/* Tooltip Overlay - Kept for now, will need to be triggered by Three.js interactions later */}
          {hoveredNodeId && (() => {
            const hoveredNode = nodes.find(n => n.id === hoveredNodeId);
            if (!hoveredNode) return null;

            // const frequency = visitFrequency[hoveredNode.id] || 0; // SVG specific state
            const tooltipX = (hoveredNode.x / 600) * 100; // SVG specific coordinates
            const tooltipY = (hoveredNode.y / 500) * 100;

            return (
              <div
                className="absolute p-3 bg-navy/90 border border-cyan rounded-md shadow-xl text-sm text-soft-white max-w-xs tooltip-fade-in"
                style={{
                  left: `${tooltipX}%`,
                  top: `${tooltipY}%`,
                  transform: 'translate(-50%, -110%)',
                  pointerEvents: 'none',
                }}
              >
                <h4 className="font-orbitron text-base text-amber mb-1">{hoveredNode.title}</h4>
                <p className="text-xs text-cool-gray mb-2 whitespace-pre-wrap leading-relaxed" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {hoveredNode.content || "No additional details available."}
                </p>
                {/* <p className="text-xs text-cyan">Visit Count: {frequency}</p> */} {/* SVG specific state */}
              </div>
            );
          })()}
        {/* </div> */} {/* This div was wrapping the SVG and nodes, now mountRef is the direct child for Three.js */}

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
