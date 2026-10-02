import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Procedural Three.js 3D Gym Environment
 * Features:
 * - Hexagonal metallic dumbbells floating in 3D parallax
 * - Olympic barbell with layered bumper plates
 * - Industrial gym power rack & overhead structural rafters with neon LED strips
 * - Infinite cyber gym floor grid with perspective depth fog
 * - Atmospheric floating dust motes & kinetic gym lighting
 * - Smooth scroll-driven camera orbit & 3D parallax
 */
export default function Gym3DScene({ scrollProgress = 0 }) {
  const mountRef = useRef(null);
  const scrollRef = useRef(scrollProgress);

  // Keep scrollRef updated for 60fps RAF loop
  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. SCENE & FOG
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.032);

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 9.5);

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 4. LIGHTING
    const ambientLight = new THREE.AmbientLight(0x1a2638, 1.4);
    scene.add(ambientLight);

    // Cyan Overhead Key Light
    const cyanSpot = new THREE.SpotLight(0x00f0ff, 8.0, 30, Math.PI / 4, 0.6);
    cyanSpot.position.set(0, 10, 4);
    scene.add(cyanSpot);

    // Violet Rim / Fill Light
    const violetLight = new THREE.PointLight(0x818cf8, 4.5, 25);
    violetLight.position.set(-6, 4, -2);
    scene.add(violetLight);

    // Warm Accent Back Light
    const warmLight = new THREE.PointLight(0xf59e0b, 3.2, 20);
    warmLight.position.set(6, 3, -4);
    scene.add(warmLight);

    // 5. 3D GYM FLOOR & CYBER GRID
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050811,
      roughness: 0.35,
      metalness: 0.65,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -2.8;
    scene.add(floorMesh);

    // Glowing Cyan Perspective Grid
    const gridHelper = new THREE.GridHelper(80, 50, 0x00f0ff, 0x0e223d);
    gridHelper.position.y = -2.78;
    scene.add(gridHelper);

    // Concentric Glowing Cyber Floor Rings
    const ringGeo1 = new THREE.RingGeometry(2.2, 2.32, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = -2.77;
    scene.add(ring1);

    const ringGeo2 = new THREE.RingGeometry(3.6, 3.68, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = -2.77;
    scene.add(ring2);

    // 6. PROCEDURAL 3D GYM EQUIPMENT
    // --- Helper: Create Metallic Hex Dumbbell ---
    const createDumbbell = (scale = 1.0) => {
      const group = new THREE.Group();

      // Chrome Knurled Handle
      const barGeo = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 1.2 * scale, 16);
      const barMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.18,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.rotation.z = Math.PI / 2;
      group.add(bar);

      // Hex Weight Material
      const hexMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.7,
        roughness: 0.35,
      });
      const accentMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
      });

      // Left & Right Hex Heads (6-sided cylinders)
      const headGeo = new THREE.CylinderGeometry(0.42 * scale, 0.42 * scale, 0.44 * scale, 6);
      const accentGeo = new THREE.TorusGeometry(0.43 * scale, 0.02 * scale, 8, 24);

      const leftHead = new THREE.Mesh(headGeo, hexMat);
      leftHead.rotation.z = Math.PI / 2;
      leftHead.position.x = -0.6 * scale;
      group.add(leftHead);

      const leftRing = new THREE.Mesh(accentGeo, accentMat);
      leftRing.rotation.y = Math.PI / 2;
      leftRing.position.x = -0.42 * scale;
      group.add(leftRing);

      const rightHead = new THREE.Mesh(headGeo, hexMat);
      rightHead.rotation.z = Math.PI / 2;
      rightHead.position.x = 0.6 * scale;
      group.add(rightHead);

      const rightRing = new THREE.Mesh(accentGeo, accentMat);
      rightRing.rotation.y = Math.PI / 2;
      rightRing.position.x = 0.42 * scale;
      group.add(rightRing);

      return group;
    };

    // --- Helper: Create Olympic Barbell & Weight Stack ---
    const createBarbell = () => {
      const group = new THREE.Group();

      // Main Steel Bar
      const barGeo = new THREE.CylinderGeometry(0.065, 0.065, 9.5, 20);
      const barMat = new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        metalness: 0.92,
        roughness: 0.22,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.rotation.z = Math.PI / 2;
      group.add(bar);

      // Bumper Plate Materials
      const plateMatDark = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.5,
        roughness: 0.5,
      });
      const cyanRimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

      // Add stacks of Olympic plates on both ends
      [-3.6, -3.95, -4.25, 3.6, 3.95, 4.25].forEach((pos, idx) => {
        const radius = 0.75 - (idx % 3) * 0.08;
        const plateGeo = new THREE.CylinderGeometry(radius, radius, 0.18, 24);
        const plate = new THREE.Mesh(plateGeo, plateMatDark);
        plate.rotation.z = Math.PI / 2;
        plate.position.x = pos;
        group.add(plate);

        // Neon groove ring
        const grooveGeo = new THREE.TorusGeometry(radius * 0.92, 0.015, 8, 32);
        const groove = new THREE.Mesh(grooveGeo, cyanRimMat);
        groove.rotation.y = Math.PI / 2;
        groove.position.x = pos + (pos < 0 ? 0.095 : -0.095);
        group.add(groove);
      });

      return group;
    };

    // --- Helper: Create Cast-Iron Kettlebell ---
    const createKettlebell = () => {
      const group = new THREE.Group();

      const bodyGeo = new THREE.SphereGeometry(0.55, 24, 24);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.8,
        roughness: 0.3,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0;
      group.add(body);

      const handleGeo = new THREE.TorusGeometry(0.32, 0.065, 12, 28, Math.PI);
      const handleMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.9,
        roughness: 0.2,
      });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.y = 0.5;
      group.add(handle);

      const neonStripe = new THREE.Mesh(
        new THREE.RingGeometry(0.48, 0.52, 32),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
      );
      neonStripe.rotation.x = Math.PI / 2;
      group.add(neonStripe);

      return group;
    };

    // Instantiate 3D Gym Objects in Scene
    // Left Floating Hex Dumbbell (Framing left upper quadrant)
    const leftDumbbell = createDumbbell(1.2);
    leftDumbbell.position.set(-3.7, 1.3, 1.8);
    leftDumbbell.rotation.set(0.35, 0.45, 0.25);
    scene.add(leftDumbbell);

    // Right Floating Hex Dumbbell (Framing right upper quadrant)
    const rightDumbbell = createDumbbell(1.1);
    rightDumbbell.position.set(3.7, 1.1, 1.8);
    rightDumbbell.rotation.set(-0.3, -0.5, -0.2);
    scene.add(rightDumbbell);

    // Deep Olympic Barbell resting on rear gym racks
    const barbell = createBarbell();
    barbell.position.set(0, 0.8, -3.8);
    barbell.rotation.set(0.02, 0, 0);
    scene.add(barbell);

    // Floor Kettlebell
    const kettlebell = createKettlebell();
    kettlebell.position.set(-2.8, -2.1, 0.6);
    kettlebell.rotation.set(0, 0.4, 0);
    scene.add(kettlebell);

    // 7. INDUSTRIAL GYM POWER RACK & ROOF TRUSSES
    const rackGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1e2638,
      metalness: 0.85,
      roughness: 0.3,
    });
    const neonLightMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    // 4 Heavy Uprights
    const uprightGeo = new THREE.BoxGeometry(0.22, 9.0, 0.22);
    [
      [-4.5, -3.5],
      [4.5, -3.5],
      [-4.5, -7.5],
      [4.5, -7.5],
    ].forEach(([x, z]) => {
      const upright = new THREE.Mesh(uprightGeo, steelMat);
      upright.position.set(x, 1.6, z);
      rackGroup.add(upright);
    });

    // Top Cross Trusses
    const trussXGeo = new THREE.BoxGeometry(9.2, 0.2, 0.2);
    const topTruss1 = new THREE.Mesh(trussXGeo, steelMat);
    topTruss1.position.set(0, 5.8, -3.5);
    rackGroup.add(topTruss1);

    const topTruss2 = new THREE.Mesh(trussXGeo, steelMat);
    topTruss2.position.set(0, 5.8, -7.5);
    rackGroup.add(topTruss2);

    // Overhead Glowing Neon Tubes
    const neonGeo = new THREE.BoxGeometry(8.0, 0.05, 0.05);
    const neon1 = new THREE.Mesh(neonGeo, neonLightMat);
    neon1.position.set(0, 5.7, -3.5);
    rackGroup.add(neon1);

    const neon2 = new THREE.Mesh(neonGeo, neonLightMat);
    neon2.position.set(0, 5.7, -7.5);
    rackGroup.add(neon2);

    scene.add(rackGroup);

    // 8. FLOATING KINETIC DUST PARTICLES
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 24;
      particlePos[i + 1] = Math.random() * 12 - 2;
      particlePos[i + 2] = (Math.random() - 0.5) * 16;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.065,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 9. ANIMATION & RENDER LOOP
    let animId;
    let clock = new THREE.Clock();

    const renderLoop = () => {
      const elapsedTime = clock.getElapsedTime();
      const progress = scrollRef.current || 0;

      // Camera 3D Orbit based on Scroll Progress & Subtle Breathing Motion
      const targetCamX = Math.sin(progress * Math.PI * 2) * 1.6;
      const targetCamY = 2.2 + (progress - 0.5) * 0.8 + Math.sin(elapsedTime * 0.8) * 0.05;
      const targetCamZ = 9.5 - Math.sin(progress * Math.PI) * 0.6;

      camera.position.x += (targetCamX - camera.position.x) * 0.08;
      camera.position.y += (targetCamY - camera.position.y) * 0.08;
      camera.position.z += (targetCamZ - camera.position.z) * 0.08;
      camera.lookAt(0, 0.4, 0);

      // Floor rings rotation
      ring1.rotation.z = elapsedTime * 0.2 + progress * Math.PI * 2;
      ring2.rotation.z = -elapsedTime * 0.15 - progress * Math.PI * 2;

      // Floating Dumbbells slow hover & scroll tilt
      leftDumbbell.position.y = 0.8 + Math.sin(elapsedTime * 1.2) * 0.12;
      leftDumbbell.rotation.y = elapsedTime * 0.4 + progress * Math.PI * 1.5;
      leftDumbbell.rotation.x = 0.4 + Math.sin(elapsedTime * 0.7) * 0.1;

      rightDumbbell.position.y = -0.2 + Math.cos(elapsedTime * 1.1) * 0.1;
      rightDumbbell.rotation.y = -elapsedTime * 0.35 - progress * Math.PI * 1.5;
      rightDumbbell.rotation.z = -0.2 + Math.cos(elapsedTime * 0.8) * 0.1;

      kettlebell.position.y = -2.2 + Math.sin(elapsedTime * 0.9) * 0.05;
      kettlebell.rotation.y = elapsedTime * 0.25;

      // Barbell subtle sway
      barbell.rotation.y = Math.sin(progress * Math.PI) * 0.08;

      // Particle gentle drift
      const positions = particleGeo.attributes.position.array;
      for (let i = 1; i < particleCount * 3; i += 3) {
        positions[i] += 0.0035;
        if (positions[i] > 10) positions[i] = -2;
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // 10. RESIZE HANDLER
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // CLEANUP
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
