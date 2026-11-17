import * as THREE from 'three';
import type { Vec3Like } from './modelBounds';
import { smoothStep01, type GroupMotionState } from './explosionGroups';

export type MechanicalCategory = 'chassis_suspension' | 'v12_powertrain';

export interface IllustrativeMechanicalSpec {
  /** Unique node identifier in the scene graph */
  nodeName: string;
  /** Human-readable component name */
  plainName: string;
  category: MechanicalCategory;
  /** Explicit non-OEM attribution label required by specification */
  reconstructionTag: 'Illustrative mechanical reconstruction';
  /** Detailed engineering description */
  description: string;
  /** Base priority for on-model label layout */
  basePriority: number;
  /** Local rest center in centered SP3 coordinates (car length 12.248u = 4686mm) */
  restCenter: Vec3Like;
  /** World-space separation offset during Chapter 07 (Chassis & Powertrain, scrollProgress 0.70..1.00) */
  worldOffset: Vec3Like;
  /** Scroll progress [0..1] when this mechanical component starts separating */
  startProgress: number;
  /** Scroll progress [0..1] when this mechanical component finishes separating */
  endProgress: number;
}

export const ILLUSTRATIVE_RECONSTRUCTION_LABEL =
  'Illustrative mechanical reconstruction' as const;

/**
 * 13 detailed procedural mechanical sub-assemblies fitted inside the Ferrari Daytona SP3's
 * closed orthographic envelope (length 12.248u = 4686mm, width 5.252u = 2050mm, height 3.000u = 1142mm,
 * wheelbase 6.928u = 2651mm: front axle Z = +3.133, rear axle Z = -3.795).
 */
export const ILLUSTRATIVE_MECHANICAL_SPECS: readonly IllustrativeMechanicalSpec[] = [
  {
    nodeName: 'Mech_Carbon_Tub',
    plainName: 'Carbon-Fibre Monocoque Tub',
    category: 'chassis_suspension',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: central composite monocoque tub with integrated side impact sills, front pedal bulkhead, and rear engine firewall.',
    basePriority: 93,
    restCenter: { x: 0, y: -0.58, z: 0.65 },
    worldOffset: { x: 0, y: 0, z: 0 },
    startProgress: 0,
    endProgress: 0,
  },
  {
    nodeName: 'Mech_Front_Subframe',
    plainName: 'Front Aluminium Subframe',
    category: 'chassis_suspension',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: extruded aluminium twin-rail front subframe, suspension mounting towers, and forward crash absorption structure.',
    basePriority: 84,
    restCenter: { x: 0, y: -0.54, z: 3.35 },
    worldOffset: { x: 0, y: -0.25, z: 2.35 },
    startProgress: 0.72,
    endProgress: 0.94,
  },
  {
    nodeName: 'Mech_Rear_Subframe',
    plainName: 'Rear Spaceframe Engine Cradle',
    category: 'chassis_suspension',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: triangulated tubular steel and cast-node rear subframe cradling the longitudinal V12 and transaxle.',
    basePriority: 85,
    restCenter: { x: 0, y: -0.52, z: -2.85 },
    worldOffset: { x: 0, y: -0.55, z: -2.15 },
    startProgress: 0.72,
    endProgress: 0.94,
  },
  {
    nodeName: 'Mech_Front_Suspension',
    plainName: 'Front Double-Wishbone Arms',
    category: 'chassis_suspension',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: left and right forged aluminium upper and lower A-arm wishbones, steering tie rods, and CNC billet uprights.',
    basePriority: 80,
    restCenter: { x: 0, y: -0.58, z: 3.13 },
    worldOffset: { x: 0, y: -0.15, z: 1.55 },
    startProgress: 0.73,
    endProgress: 0.95,
  },
  {
    nodeName: 'Mech_Rear_Suspension',
    plainName: 'Rear Multi-Link Wishbone Arms',
    category: 'chassis_suspension',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: rear upper and lower wishbone control arms, toe links, and hollow-cast rear wheel carriers.',
    basePriority: 79,
    restCenter: { x: 0, y: -0.52, z: -3.79 },
    worldOffset: { x: 0, y: -0.15, z: -1.65 },
    startProgress: 0.73,
    endProgress: 0.95,
  },
  {
    nodeName: 'Mech_Pushrod_Dampers',
    plainName: 'Inboard Pushrod & Coilover Dampers',
    category: 'chassis_suspension',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: diagonal suspension pushrods, billet bellcrank rockers, helical coilover springs, and piggyback spool-valve dampers.',
    basePriority: 83,
    restCenter: { x: 0, y: -0.18, z: -0.25 },
    worldOffset: { x: 0, y: 0.92, z: 0.15 },
    startProgress: 0.74,
    endProgress: 0.96,
  },
  {
    nodeName: 'Mech_V12_Engine_Block',
    plainName: '65° 6.5L V12 Engine Block',
    category: 'v12_powertrain',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: sand-cast aluminium 65-degree V12 cylinder block, crankcase webbing, front timing chest, and accessory drive pulleys.',
    basePriority: 96,
    restCenter: { x: 0, y: -0.34, z: -2.05 },
    worldOffset: { x: 0, y: 0.25, z: -0.35 },
    startProgress: 0.74,
    endProgress: 0.96,
  },
  {
    nodeName: 'Mech_Twin_Cam_Covers',
    plainName: 'Twin Red Anodized Cam Covers',
    category: 'v12_powertrain',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: signature Rosso Corsa wrinkle-finish quad-cam cylinder head covers with machined ribs and ignition coil rails.',
    basePriority: 94,
    restCenter: { x: 0, y: 0.14, z: -2.05 },
    worldOffset: { x: 0, y: 1.15, z: -0.35 },
    startProgress: 0.75,
    endProgress: 0.97,
  },
  {
    nodeName: 'Mech_Intake_Runners',
    plainName: '12 Velocity-Stack Intake Runners',
    category: 'v12_powertrain',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: two banks of six machined billet aluminium variable-length intake trumpets nested inside the 65° V-valley.',
    basePriority: 92,
    restCenter: { x: 0, y: 0.34, z: -2.05 },
    worldOffset: { x: 0, y: 1.85, z: -0.35 },
    startProgress: 0.76,
    endProgress: 0.98,
  },
  {
    nodeName: 'Mech_Intake_Plenums',
    plainName: 'Twin Carbon Intake Plenums',
    category: 'v12_powertrain',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: autoclave carbon-fibre high-volume acoustic intake plenums and dual drive-by-wire throttle bodies.',
    basePriority: 95,
    restCenter: { x: 0, y: 0.45, z: -2.12 },
    worldOffset: { x: 0, y: 2.55, z: -0.38 },
    startProgress: 0.77,
    endProgress: 0.99,
  },
  {
    nodeName: 'Mech_Exhaust_Headers',
    plainName: '6-into-1 Inconel Exhaust Headers',
    category: 'v12_powertrain',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: equal-length hydroformed Inconel 6-into-1 primary exhaust headers, merge collectors, and twin rear outlets.',
    basePriority: 89,
    restCenter: { x: 0, y: -0.22, z: -2.75 },
    worldOffset: { x: 0, y: 0.55, z: -1.45 },
    startProgress: 0.75,
    endProgress: 0.98,
  },
  {
    nodeName: 'Mech_Dry_Sump',
    plainName: 'Dry-Sump Oil Pan & Scavenge Pump',
    category: 'v12_powertrain',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: ultra-low profile finned cast aluminium dry-sump oil pan, multi-stage scavenge pump, and braided stainless oil lines.',
    basePriority: 81,
    restCenter: { x: 0, y: -0.78, z: -2.05 },
    worldOffset: { x: 0, y: -1.18, z: -0.35 },
    startProgress: 0.75,
    endProgress: 0.97,
  },
  {
    nodeName: 'Mech_Transaxle_Gearbox',
    plainName: '7-Speed Transaxle & Differential',
    category: 'v12_powertrain',
    reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
    description:
      'Illustrative mechanical reconstruction: longitudinal 7-speed dual-clutch ribbed magnesium transaxle casing, electronic limited-slip differential, and constant-velocity half-shafts.',
    basePriority: 91,
    restCenter: { x: 0, y: -0.44, z: -3.75 },
    worldOffset: { x: 0, y: 0.12, z: -2.85 },
    startProgress: 0.75,
    endProgress: 0.99,
  },
] as const;

export interface CapturedMechanicalBinding {
  spec: IllustrativeMechanicalSpec;
  object: THREE.Group;
  parent: THREE.Object3D;
  origLocalPosition: THREE.Vector3;
  origLocalQuaternion: THREE.Quaternion;
  origLocalScale: THREE.Vector3;
  origWorldBox: THREE.Box3;
  origWorldCenter: THREE.Vector3;
  /** Child sub-parts with lateral/divergent sub-offsets during deep explosion */
  lateralSubParts: Array<{
    mesh: THREE.Object3D;
    origPos: THREE.Vector3;
    delta: THREE.Vector3;
  }>;
}

export function getIllustrativeMechanicalSpec(
  nodeName: string | null | undefined,
): IllustrativeMechanicalSpec | null {
  if (!nodeName) return null;
  return (
    ILLUSTRATIVE_MECHANICAL_SPECS.find((s) => s.nodeName === nodeName) ?? null
  );
}

export function computeMechanicalGroupProgress(
  spec: IllustrativeMechanicalSpec,
  scrollProgress: number,
): { localProgress: number; state: GroupMotionState } {
  if (spec.endProgress <= spec.startProgress) {
    return { localProgress: 0, state: 'fixed' };
  }
  const p = Math.max(0, Math.min(1, scrollProgress));
  if (p <= spec.startProgress + 1e-4) {
    return { localProgress: 0, state: 'assembled' };
  }
  if (p >= spec.endProgress - 1e-4) {
    return { localProgress: 1, state: 'separated' };
  }
  const raw = (p - spec.startProgress) / (spec.endProgress - spec.startProgress);
  return {
    localProgress: smoothStep01(raw),
    state: 'moving',
  };
}

/**
 * Generates a tileable procedural carbon-fibre weave bump/roughness texture in memory
 * (works both in browser HTML5 canvas and falls back gracefully in headless Node unit tests).
 */
function createProceduralCarbonTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#22262e';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const shift = ((x + y) / 8) % 2 === 0;
      ctx.fillStyle = shift ? '#383e4a' : '#171a20';
      ctx.fillRect(x, y, 4, 4);
      ctx.fillStyle = shift ? '#171a20' : '#383e4a';
      ctx.fillRect(x + 4, y + 4, 4, 4);
      ctx.fillStyle = '#2b303a';
      ctx.fillRect(x + 4, y, 4, 4);
      ctx.fillRect(x, y + 4, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

export interface MechanicalLayerBuildResult {
  rootGroup: THREE.Group;
  bindings: CapturedMechanicalBinding[];
  materials: THREE.Material[];
}

/**
 * Builds the 13 detailed procedural illustrative mid-rear V12 & chassis sub-assemblies
 * fitted inside the centered Daytona SP3 model coordinate system.
 */
export function buildIllustrativeMechanicalLayer(): MechanicalLayerBuildResult {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Illustrative_Mechanical_Layer';

  const carbonTex = createProceduralCarbonTexture();

  // Calibrated PBR Material Palette (distinct roughness/metalness contrast >= 0.25 across adjacent parts)
  const carbonWeaveMat = new THREE.MeshPhysicalMaterial({
    name: 'Illust_Carbon_Weave',
    color: 0x1a1d24,
    roughness: 0.34,
    metalness: 0.18,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    bumpMap: carbonTex,
    bumpScale: 0.015,
    fog: false,
  });

  const castAluminiumMat = new THREE.MeshStandardMaterial({
    name: 'Illust_Cast_Aluminium',
    color: 0x9aa3b0,
    roughness: 0.56,
    metalness: 0.82,
    fog: false,
  });

  const machinedBilletMat = new THREE.MeshPhysicalMaterial({
    name: 'Illust_Machined_Billet',
    color: 0xd8e0ec,
    roughness: 0.16,
    metalness: 0.94,
    clearcoat: 0.35,
    clearcoatRoughness: 0.1,
    fog: false,
  });

  const redCrinkleCamMat = new THREE.MeshPhysicalMaterial({
    name: 'Illust_Rosso_Cam_Cover',
    color: 0xc8141e,
    roughness: 0.48,
    metalness: 0.22,
    clearcoat: 0.28,
    clearcoatRoughness: 0.35,
    fog: false,
  });

  const inconelExhaustMat = new THREE.MeshPhysicalMaterial({
    name: 'Illust_Inconel_Header',
    color: 0xb89f82,
    roughness: 0.26,
    metalness: 0.9,
    iridescence: 0.38,
    iridescenceIOR: 1.4,
    fog: false,
  });

  const magnesiumGearboxMat = new THREE.MeshStandardMaterial({
    name: 'Illust_Magnesium_Casing',
    color: 0x6d7480,
    roughness: 0.62,
    metalness: 0.76,
    fog: false,
  });

  const titaniumSubframeMat = new THREE.MeshStandardMaterial({
    name: 'Illust_Titanium_Trellis',
    color: 0x7e8794,
    roughness: 0.38,
    metalness: 0.86,
    fog: false,
  });

  const goldAnodizedMat = new THREE.MeshStandardMaterial({
    name: 'Illust_Gold_Damper',
    color: 0xd99b26,
    roughness: 0.24,
    metalness: 0.88,
    fog: false,
  });

  const coilSpringRedMat = new THREE.MeshStandardMaterial({
    name: 'Illust_Coil_Spring',
    color: 0xd91b26,
    roughness: 0.32,
    metalness: 0.45,
    fog: false,
  });

  const darkGraphiteMat = new THREE.MeshStandardMaterial({
    name: 'Illust_Dark_Graphite',
    color: 0x252932,
    roughness: 0.64,
    metalness: 0.52,
    fog: false,
  });

  const allMaterials: THREE.Material[] = [
    carbonWeaveMat,
    castAluminiumMat,
    machinedBilletMat,
    redCrinkleCamMat,
    inconelExhaustMat,
    magnesiumGearboxMat,
    titaniumSubframeMat,
    goldAnodizedMat,
    coilSpringRedMat,
    darkGraphiteMat,
  ];

  const groupMap = new Map<
    string,
    {
      group: THREE.Group;
      lateralSubParts: Array<{
        mesh: THREE.Object3D;
        origPos: THREE.Vector3;
        delta: THREE.Vector3;
      }>;
    }
  >();

  for (const spec of ILLUSTRATIVE_MECHANICAL_SPECS) {
    const g = new THREE.Group();
    g.name = spec.nodeName;
    g.userData.illustrativeReconstruction = true;
    g.userData.reconstructionTag = ILLUSTRATIVE_RECONSTRUCTION_LABEL;
    rootGroup.add(g);
    groupMap.set(spec.nodeName, { group: g, lateralSubParts: [] });
  }

  const addTubeStrut = (
    parent: THREE.Group,
    p1: [number, number, number],
    p2: [number, number, number],
    radius: number,
    mat: THREE.Material,
  ): THREE.Mesh => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    const dist = v1.distanceTo(v2);
    const geo = new THREE.CylinderGeometry(radius, radius, dist, 10, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(v1).add(v2).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      v2.clone().sub(v1).normalize(),
    );
    parent.add(mesh);
    return mesh;
  };

  // ---------------------------------------------------------------------------
  // 1. Mech_Carbon_Tub — Carbon-Fibre Monocoque Tub (z = -0.92 .. +2.35)
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Carbon_Tub')!;
    const g = entry.group;

    // Lower composite floor pan with venturi step
    const floorGeo = new THREE.BoxGeometry(2.42, 0.11, 3.26);
    const floorMesh = new THREE.Mesh(floorGeo, carbonWeaveMat);
    floorMesh.position.set(0, -0.96, 0.72);
    g.add(floorMesh);

    // Central tunnel spine inside cockpit
    const spineGeo = new THREE.BoxGeometry(0.34, 0.36, 2.95);
    const spineMesh = new THREE.Mesh(spineGeo, carbonWeaveMat);
    spineMesh.position.set(0, -0.74, 0.72);
    g.add(spineMesh);

    // High-sill left & right composite side members
    for (const side of [-1, 1] as const) {
      const sillShape = new THREE.Shape();
      sillShape.moveTo(0, 0);
      sillShape.lineTo(3.15, 0);
      sillShape.lineTo(3.05, 0.52);
      sillShape.lineTo(2.25, 0.44);
      sillShape.lineTo(0.35, 0.44);
      sillShape.lineTo(0, 0.62);
      sillShape.closePath();

      const sillGeo = new THREE.ExtrudeGeometry(sillShape, {
        depth: 0.24,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.025,
        bevelSegments: 2,
      });
      sillGeo.rotateY(Math.PI / 2);
      const sillMesh = new THREE.Mesh(sillGeo, carbonWeaveMat);
      sillMesh.position.set(side * 1.16 - 0.12, -0.94, 2.28);
      g.add(sillMesh);
    }

    // Front pedalbox bulkhead (z = +2.26)
    const frontBulkhead = new THREE.Mesh(
      new THREE.BoxGeometry(2.28, 0.76, 0.14),
      carbonWeaveMat,
    );
    frontBulkhead.position.set(0, -0.54, 2.26);
    g.add(frontBulkhead);

    // Rear firewall & roll-hoop bulkhead (z = -0.88)
    const rearBulkhead = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.94, 0.16),
      carbonWeaveMat,
    );
    rearBulkhead.position.set(0, -0.45, -0.88);
    g.add(rearBulkhead);

    // Twin billet chassis mounting bosses on rear firewall
    for (const sx of [-0.78, 0.78]) {
      for (const sy of [-0.68, -0.18]) {
        const boss = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.065, 0.22, 12),
          machinedBilletMat,
        );
        boss.rotation.x = Math.PI / 2;
        boss.position.set(sx, sy, -0.88);
        g.add(boss);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Mech_Front_Subframe — Front Aluminium Subframe & Crash Box (z = +2.30 .. +4.70)
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Front_Subframe')!;
    const g = entry.group;

    // Cross-members at z = +2.55 and z = +3.65
    for (const zPos of [2.55, 3.68]) {
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(1.66, 0.11, 0.14),
        castAluminiumMat,
      );
      cross.position.set(0, -0.74, zPos);
      g.add(cross);
    }

    // Left & right longitudinal extruded rails + suspension shock towers + crash boxes
    for (const side of [-1, 1] as const) {
      addTubeStrut(
        g,
        [side * 0.76, -0.72, 2.26],
        [side * 0.68, -0.68, 4.45],
        0.055,
        castAluminiumMat,
      );
      addTubeStrut(
        g,
        [side * 0.78, -0.26, 2.26],
        [side * 0.72, -0.28, 3.55],
        0.045,
        titaniumSubframeMat,
      );
      addTubeStrut(
        g,
        [side * 0.72, -0.28, 3.55],
        [side * 0.68, -0.68, 4.45],
        0.042,
        titaniumSubframeMat,
      );

      // Cast suspension tower at front axle Z = +3.133
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.15, 0.56, 12),
        castAluminiumMat,
      );
      tower.position.set(side * 0.78, -0.46, 3.13);
      g.add(tower);

      // Forward honeycomb crash structure nose box
      const crashBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.22, 0.55),
        darkGraphiteMat,
      );
      crashBox.position.set(side * 0.56, -0.66, 4.55);
      g.add(crashBox);
    }

    // Twin inclined front radiators inside nose airflow ducts
    for (const side of [-1, 1] as const) {
      const rad = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.34, 0.08),
        castAluminiumMat,
      );
      rad.rotation.x = -0.42;
      rad.rotation.y = side * 0.28;
      rad.position.set(side * 0.96, -0.52, 3.92);
      g.add(rad);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Mech_Rear_Subframe — Rear Spaceframe Engine Cradle (z = -0.90 .. -4.65)
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Rear_Subframe')!;
    const g = entry.group;

    for (const side of [-1, 1] as const) {
      // Lower longitudinal engine cradle rails
      addTubeStrut(
        g,
        [side * 0.78, -0.78, -0.88],
        [side * 0.74, -0.76, -4.35],
        0.052,
        titaniumSubframeMat,
      );
      // Upper triangulated trellis struts
      addTubeStrut(
        g,
        [side * 0.76, -0.18, -0.88],
        [side * 0.84, -0.22, -2.55],
        0.044,
        titaniumSubframeMat,
      );
      addTubeStrut(
        g,
        [side * 0.84, -0.22, -2.55],
        [side * 0.76, -0.18, -3.95],
        0.044,
        titaniumSubframeMat,
      );
      // Diagonal triangulation struts
      addTubeStrut(
        g,
        [side * 0.78, -0.78, -0.88],
        [side * 0.84, -0.22, -2.55],
        0.036,
        titaniumSubframeMat,
      );
      addTubeStrut(
        g,
        [side * 0.84, -0.22, -2.55],
        [side * 0.74, -0.76, -3.85],
        0.036,
        titaniumSubframeMat,
      );
      // Rear suspension cast upright mount tower at Z = -3.795
      const rearTower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.62, 12),
        castAluminiumMat,
      );
      rearTower.position.set(side * 0.78, -0.44, -3.79);
      g.add(rearTower);
    }

    // Rear cross-bridges
    for (const zPos of [-1.25, -2.95, -4.25]) {
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(1.56, 0.09, 0.12),
        castAluminiumMat,
      );
      bridge.position.set(0, -0.78, zPos);
      g.add(bridge);
    }

    // Rear carbon crash box between diffuser channels
    const rearCrash = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.24, 0.62),
      carbonWeaveMat,
    );
    rearCrash.position.set(0, -0.62, -4.62);
    g.add(rearCrash);
  }

  // ---------------------------------------------------------------------------
  // 4. Mech_Front_Suspension — Front Double-Wishbone Arms (axle Z = +3.133)
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Front_Suspension')!;
    const g = entry.group;

    for (const side of [-1, 1] as const) {
      const sideGroup = new THREE.Group();
      const zAxle = 3.133;
      const xIn = side * 0.76;
      const xOut = side * 1.92;

      // Lower A-arm (two converging tubular legs)
      addTubeStrut(
        sideGroup,
        [xIn, -0.74, zAxle + 0.34],
        [xOut, -0.72, zAxle],
        0.028,
        machinedBilletMat,
      );
      addTubeStrut(
        sideGroup,
        [xIn, -0.74, zAxle - 0.34],
        [xOut, -0.72, zAxle],
        0.028,
        machinedBilletMat,
      );

      // Upper A-arm
      addTubeStrut(
        sideGroup,
        [xIn, -0.34, zAxle + 0.28],
        [xOut * 0.96, -0.36, zAxle],
        0.025,
        machinedBilletMat,
      );
      addTubeStrut(
        sideGroup,
        [xIn, -0.34, zAxle - 0.28],
        [xOut * 0.96, -0.36, zAxle],
        0.025,
        machinedBilletMat,
      );

      // Steering tie-rod
      addTubeStrut(
        sideGroup,
        [xIn, -0.58, zAxle + 0.44],
        [xOut * 0.98, -0.58, zAxle + 0.18],
        0.02,
        titaniumSubframeMat,
      );

      // CNC Billet Wheel Upright Knuckle
      const upright = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.15, 0.44, 14),
        castAluminiumMat,
      );
      upright.position.set(xOut, -0.54, zAxle);
      sideGroup.add(upright);

      g.add(sideGroup);
      entry.lateralSubParts.push({
        mesh: sideGroup,
        origPos: sideGroup.position.clone(),
        delta: new THREE.Vector3(side * 0.95, 0, 0),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Mech_Rear_Suspension — Rear Multi-Link Wishbone Arms (axle Z = -3.795)
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Rear_Suspension')!;
    const g = entry.group;

    for (const side of [-1, 1] as const) {
      const sideGroup = new THREE.Group();
      const zAxle = -3.795;
      const xIn = side * 0.74;
      const xOut = side * 1.88;

      // Lower wishbone
      addTubeStrut(
        sideGroup,
        [xIn, -0.72, zAxle + 0.36],
        [xOut, -0.68, zAxle],
        0.03,
        machinedBilletMat,
      );
      addTubeStrut(
        sideGroup,
        [xIn, -0.72, zAxle - 0.36],
        [xOut, -0.68, zAxle],
        0.03,
        machinedBilletMat,
      );

      // Upper wishbone
      addTubeStrut(
        sideGroup,
        [xIn, -0.28, zAxle + 0.3],
        [xOut * 0.96, -0.31, zAxle],
        0.026,
        machinedBilletMat,
      );
      addTubeStrut(
        sideGroup,
        [xIn, -0.28, zAxle - 0.3],
        [xOut * 0.96, -0.31, zAxle],
        0.026,
        machinedBilletMat,
      );

      // Rear toe-control link
      addTubeStrut(
        sideGroup,
        [xIn, -0.54, zAxle - 0.42],
        [xOut * 0.97, -0.52, zAxle - 0.16],
        0.022,
        titaniumSubframeMat,
      );

      // Hollow-cast Rear Upright Carrier
      const upright = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 0.46, 14),
        castAluminiumMat,
      );
      upright.position.set(xOut, -0.49, zAxle);
      sideGroup.add(upright);

      g.add(sideGroup);
      entry.lateralSubParts.push({
        mesh: sideGroup,
        origPos: sideGroup.position.clone(),
        delta: new THREE.Vector3(side * 0.95, 0, 0),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Mech_Pushrod_Dampers — Inboard Pushrod & Coilover Damper Units
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Pushrod_Dampers')!;
    const g = entry.group;

    const buildDamperCorner = (
      side: -1 | 1,
      zAxle: number,
      zInboard: number,
    ) => {
      const cornerGroup = new THREE.Group();
      // Diagonal pushrod from lower wishbone out-point to inboard bellcrank
      addTubeStrut(
        cornerGroup,
        [side * 1.78, -0.66, zAxle],
        [side * 0.58, -0.14, zInboard],
        0.02,
        machinedBilletMat,
      );

      // Billet triangular bellcrank rocker
      const rocker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.05, 3),
        machinedBilletMat,
      );
      rocker.rotation.z = Math.PI / 2;
      rocker.position.set(side * 0.56, -0.14, zInboard);
      cornerGroup.add(rocker);

      // Inboard coilover damper body + piggyback gold reservoir + red helical spring rings
      const damperDir = new THREE.Vector3(-side * 0.36, 0.08, 0);
      const damperStart: [number, number, number] = [
        side * 0.54,
        -0.14,
        zInboard,
      ];
      const damperEnd: [number, number, number] = [
        side * 0.16,
        -0.06,
        zInboard,
      ];
      addTubeStrut(
        cornerGroup,
        damperStart,
        damperEnd,
        0.036,
        goldAnodizedMat,
      );

      // Helical spring coils along the damper shaft
      for (let c = 0; c < 6; c++) {
        const t = (c + 1) / 7;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.058, 0.013, 8, 16),
          coilSpringRedMat,
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.set(
          damperStart[0] + damperDir.x * t,
          damperStart[1] + damperDir.y * t,
          zInboard,
        );
        cornerGroup.add(ring);
      }

      // Piggyback nitrogen reservoir canister
      const reservoir = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.22, 12),
        goldAnodizedMat,
      );
      reservoir.rotation.z = Math.PI / 2;
      reservoir.position.set(side * 0.35, -0.02, zInboard + 0.09);
      cornerGroup.add(reservoir);

      g.add(cornerGroup);
      entry.lateralSubParts.push({
        mesh: cornerGroup,
        origPos: cornerGroup.position.clone(),
        delta: new THREE.Vector3(side * 0.42, 0, 0),
      });
    };

    buildDamperCorner(-1, 3.133, 2.98);
    buildDamperCorner(1, 3.133, 2.98);
    buildDamperCorner(-1, -3.795, -3.56);
    buildDamperCorner(1, -3.795, -3.56);
  }

  // ---------------------------------------------------------------------------
  // 7. Mech_V12_Engine_Block — 65° 6.5L V12 Engine Block (z = -1.15 .. -2.95)
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_V12_Engine_Block')!;
    const g = entry.group;

    // Lower deep-skirt crankcase block
    const crankcase = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.38, 1.72),
      castAluminiumMat,
    );
    crankcase.position.set(0, -0.48, -2.05);
    g.add(crankcase);

    // 65° Cylinder Banks (±32.5° from vertical)
    const halfAngleRad = (32.5 * Math.PI) / 180;
    for (const side of [-1, 1] as const) {
      const bankGroup = new THREE.Group();
      bankGroup.position.set(side * 0.16, -0.34, -2.05);
      bankGroup.rotation.z = -side * halfAngleRad;

      const bankBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.52, 1.68),
        castAluminiumMat,
      );
      bankBlock.position.set(0, 0.22, 0);
      bankGroup.add(bankBlock);

      // 6 Cylinder barrels & structural casting ribs per bank
      for (let i = 0; i < 6; i++) {
        const zLocal = -0.68 + i * 0.272;
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.125, 0.48, 14),
          castAluminiumMat,
        );
        barrel.position.set(0, 0.22, zLocal);
        bankGroup.add(barrel);

        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.46, 0.028),
          machinedBilletMat,
        );
        rib.position.set(0, 0.22, zLocal + 0.136);
        bankGroup.add(rib);
      }

      g.add(bankGroup);
    }

    // Front timing chain cover & harmonic damper pulley at z = -1.16
    const timingCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.56, 0.12),
      castAluminiumMat,
    );
    timingCover.position.set(0, -0.34, -1.16);
    g.add(timingCover);

    for (const [px, py, r] of [
      [0, -0.52, 0.13],
      [-0.24, -0.28, 0.085],
      [0.24, -0.28, 0.085],
    ]) {
      const pulley = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.06, 16),
        machinedBilletMat,
      );
      pulley.rotation.x = Math.PI / 2;
      pulley.position.set(px, py, -1.08);
      g.add(pulley);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Mech_Twin_Cam_Covers — Twin Red Anodized Quad-Cam Covers
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Twin_Cam_Covers')!;
    const g = entry.group;
    const halfAngleRad = (32.5 * Math.PI) / 180;

    for (const side of [-1, 1] as const) {
      const coverGroup = new THREE.Group();
      coverGroup.position.set(side * 0.44, 0.08, -2.05);
      coverGroup.rotation.z = -side * halfAngleRad;

      // Main red crinkle quad-cam head cover
      const mainCover = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.14, 1.66),
        redCrinkleCamMat,
      );
      coverGroup.add(mainCover);

      // Twin camshaft lobe humps along each cover
      for (const camX of [-0.11, 0.11]) {
        const camHump = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.068, 1.68, 14),
          redCrinkleCamMat,
        );
        camHump.rotation.x = Math.PI / 2;
        camHump.position.set(camX, 0.05, 0);
        coverGroup.add(camHump);
      }

      // Machined silver cooling fins & 6 ignition coil bosses per bank
      for (let i = 0; i < 6; i++) {
        const zLocal = -0.68 + i * 0.272;
        const coilBoss = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.04, 0.11, 10),
          machinedBilletMat,
        );
        coilBoss.position.set(0, 0.09, zLocal);
        coverGroup.add(coilBoss);
      }

      // Billet oil filler cap on left bank
      if (side === -1) {
        const oilCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.06, 14),
          machinedBilletMat,
        );
        oilCap.position.set(0.08, 0.11, 0.62);
        coverGroup.add(oilCap);
      }

      g.add(coverGroup);
      entry.lateralSubParts.push({
        mesh: coverGroup,
        origPos: coverGroup.position.clone(),
        delta: new THREE.Vector3(side * 0.35, 0.12, 0),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Mech_Intake_Runners — 12 Machined Velocity-Stack Intake Runners
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Intake_Runners')!;
    const g = entry.group;

    // Lathe profile for a flared billet velocity stack trumpet
    const lathePoints = [
      new THREE.Vector2(0.042, 0.0),
      new THREE.Vector2(0.042, 0.16),
      new THREE.Vector2(0.048, 0.24),
      new THREE.Vector2(0.064, 0.30),
      new THREE.Vector2(0.082, 0.33),
      new THREE.Vector2(0.052, 0.335),
    ];
    const stackGeo = new THREE.LatheGeometry(lathePoints, 18);

    // Fuel rail tubes along both banks
    for (const side of [-1, 1] as const) {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.58, 12),
        machinedBilletMat,
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * 0.24, 0.21, -2.05);
      g.add(rail);
    }

    // 12 individual velocity stacks (6 left bank, 6 right bank, staggered & canted inward)
    for (let i = 0; i < 6; i++) {
      const zBase = -1.36 - i * 0.272;
      for (const side of [-1, 1] as const) {
        const stackMesh = new THREE.Mesh(stackGeo, machinedBilletMat);
        stackMesh.position.set(
          side * 0.18,
          0.16,
          zBase + (side === 1 ? -0.04 : 0.04),
        );
        stackMesh.rotation.z = side * 0.22;
        g.add(stackMesh);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Mech_Intake_Plenums — Twin Carbon-Fibre Acoustic Intake Plenums
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Intake_Plenums')!;
    const g = entry.group;

    for (const side of [-1, 1] as const) {
      const plenumGroup = new THREE.Group();

      // Sculpted rounded carbon airbox chamber
      const shape = new THREE.Shape();
      shape.moveTo(-0.18, -0.08);
      shape.lineTo(0.18, -0.08);
      shape.quadraticCurveTo(0.22, 0.04, 0.15, 0.12);
      shape.lineTo(-0.15, 0.12);
      shape.quadraticCurveTo(-0.22, 0.04, -0.18, -0.08);

      const plenumGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 1.62,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.035,
        bevelSegments: 3,
      });
      const plenumMesh = new THREE.Mesh(plenumGeo, carbonWeaveMat);
      plenumMesh.position.set(side * 0.25, 0.44, -2.86);
      plenumGroup.add(plenumMesh);

      // Rear throttle body & carbon snorkel duct feeding each plenum
      const throttleBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.095, 0.22, 16),
        machinedBilletMat,
      );
      throttleBody.rotation.x = Math.PI / 2;
      throttleBody.position.set(side * 0.26, 0.46, -2.98);
      plenumGroup.add(throttleBody);

      // Side ram-air feed snorkel curving toward side intake
      const ductCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.26, 0.46, -3.08),
        new THREE.Vector3(side * 0.58, 0.42, -2.65),
        new THREE.Vector3(side * 0.98, 0.28, -1.65),
      ]);
      const ductGeo = new THREE.TubeGeometry(ductCurve, 18, 0.075, 12, false);
      const ductMesh = new THREE.Mesh(ductGeo, carbonWeaveMat);
      plenumGroup.add(ductMesh);

      g.add(plenumGroup);
      entry.lateralSubParts.push({
        mesh: plenumGroup,
        origPos: plenumGroup.position.clone(),
        delta: new THREE.Vector3(side * 0.36, 0, 0),
      });
    }

    // Central Rosso balance bridge plate between twin carbon plenums
    const bridgePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.04, 1.38),
      redCrinkleCamMat,
    );
    bridgePlate.position.set(0, 0.54, -2.05);
    g.add(bridgePlate);
  }

  // ---------------------------------------------------------------------------
  // 11. Mech_Exhaust_Headers — 6-into-1 Inconel Equal-Length Exhaust Headers
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Exhaust_Headers')!;
    const g = entry.group;

    for (const side of [-1, 1] as const) {
      const headerBankGroup = new THREE.Group();
      const collectorPos = new THREE.Vector3(side * 0.56, -0.34, -3.12);

      // 6 primary snaking Inconel header tubes per bank
      for (let i = 0; i < 6; i++) {
        const zPort = -1.36 - i * 0.272;
        const archY = -0.16 + ((i % 3) - 1) * 0.06;
        const outerX = side * (0.68 + (i % 2) * 0.07);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.42, -0.14, zPort),
          new THREE.Vector3(outerX, archY, zPort - 0.14),
          new THREE.Vector3(outerX * 0.96, -0.28, (zPort + collectorPos.z) * 0.5),
          collectorPos.clone().add(
            new THREE.Vector3(
              Math.cos((i / 6) * Math.PI * 2) * 0.04,
              Math.sin((i / 6) * Math.PI * 2) * 0.04,
              0,
            ),
          ),
        ]);
        const pipeGeo = new THREE.TubeGeometry(curve, 18, 0.032, 10, false);
        const pipeMesh = new THREE.Mesh(pipeGeo, inconelExhaustMat);
        headerBankGroup.add(pipeMesh);
      }

      // 6-into-1 Merge collector cone & catalytic heat-shielded canister
      const collector = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.125, 0.42, 14),
        inconelExhaustMat,
      );
      collector.rotation.x = Math.PI / 2;
      collector.position.set(side * 0.54, -0.34, -3.32);
      headerBankGroup.add(collector);

      // Secondary exhaust pipe routing to high central SP3 rear tailpipes (z = -5.15, y = -0.05)
      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.54, -0.34, -3.52),
        new THREE.Vector3(side * 0.46, -0.18, -4.25),
        new THREE.Vector3(side * 0.22, -0.04, -5.05),
      ]);
      const tailPipe = new THREE.Mesh(
        new THREE.TubeGeometry(tailCurve, 18, 0.058, 12, false),
        inconelExhaustMat,
      );
      headerBankGroup.add(tailPipe);

      // Twin machined exhaust finisher tips
      const tip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.072, 0.18, 16, 1, true),
        machinedBilletMat,
      );
      tip.rotation.x = Math.PI / 2;
      tip.position.set(side * 0.22, -0.04, -5.12);
      headerBankGroup.add(tip);

      g.add(headerBankGroup);
      entry.lateralSubParts.push({
        mesh: headerBankGroup,
        origPos: headerBankGroup.position.clone(),
        delta: new THREE.Vector3(side * 0.85, 0, 0),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Mech_Dry_Sump — Dry-Sump Oil Pan, Scavenge Pump & Lines
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Dry_Sump')!;
    const g = entry.group;

    const sumpPan = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.14, 1.74),
      castAluminiumMat,
    );
    sumpPan.position.set(0, -0.76, -2.05);
    g.add(sumpPan);

    // Longitudinal cooling fins along the underside of the dry sump
    for (let f = -5; f <= 5; f++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.04, 1.68),
        machinedBilletMat,
      );
      fin.position.set(f * 0.058, -0.84, -2.05);
      g.add(fin);
    }

    // Side-mounted multi-stage scavenge oil pump & braided line
    const scavengePump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.58, 14),
      magnesiumGearboxMat,
    );
    scavengePump.rotation.x = Math.PI / 2;
    scavengePump.position.set(0.46, -0.72, -1.95);
    g.add(scavengePump);

    const oilLineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.46, -0.72, -1.64),
      new THREE.Vector3(0.62, -0.56, -1.25),
      new THREE.Vector3(0.58, -0.22, -1.02),
    ]);
    const oilLine = new THREE.Mesh(
      new THREE.TubeGeometry(oilLineCurve, 14, 0.022, 8, false),
      machinedBilletMat,
    );
    g.add(oilLine);
  }

  // ---------------------------------------------------------------------------
  // 13. Mech_Transaxle_Gearbox — 7-Speed Dual-Clutch Transaxle & E-Diff
  // ---------------------------------------------------------------------------
  {
    const entry = groupMap.get('Mech_Transaxle_Gearbox')!;
    const g = entry.group;

    // Bellhousing at z = -2.95 .. -3.35
    const bellhousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.36, 0.46, 16),
      magnesiumGearboxMat,
    );
    bellhousing.rotation.x = Math.PI / 2;
    bellhousing.position.set(0, -0.46, -3.14);
    g.add(bellhousing);

    // Main 7-speed dual-clutch ribbed magnesium gearbox casing
    const mainCase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.27, 0.98, 16),
      magnesiumGearboxMat,
    );
    mainCase.rotation.x = Math.PI / 2;
    mainCase.position.set(0, -0.44, -3.82);
    g.add(mainCase);

    // Structural strengthening ribs around the transaxle casing
    for (let r = 0; r < 5; r++) {
      const ribRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.285 - r * 0.01, 0.285 - r * 0.01, 0.03, 16),
        castAluminiumMat,
      );
      ribRing.rotation.x = Math.PI / 2;
      ribRing.position.set(0, -0.44, -3.42 - r * 0.2);
      g.add(ribRing);
    }

    // Integrated E-Diff housing & Left/Right CV Half-Shafts aligned to rear axle Z = -3.795
    const diffHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.68, 16),
      castAluminiumMat,
    );
    diffHousing.rotation.z = Math.PI / 2;
    diffHousing.position.set(0, -0.48, -3.795);
    g.add(diffHousing);

    for (const side of [-1, 1] as const) {
      addTubeStrut(
        g,
        [side * 0.34, -0.48, -3.795],
        [side * 1.84, -0.49, -3.795],
        0.036,
        darkGraphiteMat,
      );
      // Inner and outer CV joint boots
      for (const xBoot of [side * 0.42, side * 1.72]) {
        const boot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.055, 0.14, 12),
          darkGraphiteMat,
        );
        boot.rotation.z = Math.PI / 2;
        boot.position.set(xBoot, -0.485, -3.795);
        g.add(boot);
      }
    }
  }

  // Compute rest transforms & bounding boxes
  rootGroup.updateMatrixWorld(true);
  const bindings: CapturedMechanicalBinding[] = [];

  for (const spec of ILLUSTRATIVE_MECHANICAL_SPECS) {
    const entry = groupMap.get(spec.nodeName)!;
    const obj = entry.group;
    const origWorldBox = new THREE.Box3().setFromObject(obj);
    const origWorldCenter = new THREE.Vector3(
      spec.restCenter.x,
      spec.restCenter.y,
      spec.restCenter.z,
    );
    if (!origWorldBox.isEmpty()) {
      origWorldBox.getCenter(origWorldCenter);
    }

    bindings.push({
      spec,
      object: obj,
      parent: rootGroup,
      origLocalPosition: obj.position.clone(),
      origLocalQuaternion: obj.quaternion.clone(),
      origLocalScale: obj.scale.clone(),
      origWorldBox,
      origWorldCenter,
      lateralSubParts: entry.lateralSubParts,
    });
  }

  return {
    rootGroup,
    bindings,
    materials: allMaterials,
  };
}

export const ILLUSTRATIVE_MECHANICAL_GROUPS = ILLUSTRATIVE_MECHANICAL_SPECS;

/**
 * Applies reversible scroll-driven separation to the 13 illustrative mechanical assemblies
 * during Chapter 07 (Chassis & Powertrain, scrollProgress 0.72..1.00).
 * At scrollProgress <= 0.72 (or 0), every mechanical group and lateral sub-part returns
 * to its exact rest pose inside the car.
 */
export function applyMechanicalLayerExplosion(
  bindings: readonly CapturedMechanicalBinding[],
  scrollProgress: number,
  modelScaleRatio = 1,
  spreadMultiplier = 2.0,
): { maxMechanicalDelta: number; tubDelta: number } {
  const p = Math.max(0, Math.min(1, scrollProgress));
  const clampedSpread = Math.max(1.0, Math.min(3.0, spreadMultiplier));
  let maxMechanicalDelta = 0;
  let tubDelta = 0;

  for (const b of bindings) {
    const { localProgress } = computeMechanicalGroupProgress(b.spec, p);
    if (localProgress <= 0) {
      b.object.position.copy(b.origLocalPosition);
      b.object.quaternion.copy(b.origLocalQuaternion);
      b.object.scale.copy(b.origLocalScale);
      for (const sub of b.lateralSubParts) {
        sub.mesh.position.copy(sub.origPos);
      }
      if (b.spec.nodeName === 'Mech_Carbon_Tub') {
        tubDelta = b.object.position.distanceTo(b.origLocalPosition);
      }
      continue;
    }

    const effScale = modelScaleRatio * (0.65 + 0.35 * clampedSpread) * localProgress;
    b.object.position.set(
      b.origLocalPosition.x + b.spec.worldOffset.x * effScale,
      b.origLocalPosition.y + b.spec.worldOffset.y * effScale,
      b.origLocalPosition.z + b.spec.worldOffset.z * effScale,
    );
    b.object.quaternion.copy(b.origLocalQuaternion);
    b.object.scale.copy(b.origLocalScale);

    for (const sub of b.lateralSubParts) {
      sub.mesh.position.set(
        sub.origPos.x + sub.delta.x * effScale,
        sub.origPos.y + sub.delta.y * effScale,
        sub.origPos.z + sub.delta.z * effScale,
      );
    }

    const d = b.object.position.distanceTo(b.origLocalPosition);
    if (b.spec.nodeName === 'Mech_Carbon_Tub') {
      tubDelta = d;
    } else if (d > maxMechanicalDelta) {
      maxMechanicalDelta = d;
    }
  }

  return { maxMechanicalDelta, tubDelta };
}
