import * as THREE from 'three';
import type { Vec3Like } from './modelBounds';
import {
  EXTERIOR_PAINT_MATERIAL_SUFFIX,
  LABEL_DENSITY_OPTIONS,
  PAINT_SWATCHES,
  type LabelDensityMode,
  type PaintSwatchId,
} from '../types/studio';
import {
  ILLUSTRATIVE_MECHANICAL_SPECS,
  ILLUSTRATIVE_RECONSTRUCTION_LABEL,
  computeMechanicalGroupProgress,
  type CapturedMechanicalBinding,
  type MechanicalCategory,
} from './illustrativeMechanicalLayer';

export type PresentationGroupCategory =
  | 'fixed'
  | 'wheels'
  | 'brakes'
  | 'bodywork'
  | 'glazing_mirrors'
  | MechanicalCategory;

export type GroupMotionState = 'fixed' | 'assembled' | 'moving' | 'separated';

export interface PresentationGroupSpec {
  /** Exact node name inside daytona-sp3-web.glb */
  nodeName: string;
  /** Plain human-readable name for the visitor UI */
  plainName: string;
  category: PresentationGroupCategory;
  /** Authentic description of the existing geometry inside this presentation group */
  description: string;
  /** True if hidden when Structure Mode is enabled (outer bodywork & glazing) */
  hiddenInStructureMode: boolean;
  /** Base priority for on-model callout label visibility */
  basePriority: number;
  /** Base (1x) world-space displacement (in world units for the 12.25u car) when separated */
  worldOffset: Vec3Like;
  /** Scroll timeline progress [0..1] when this group starts separating */
  startProgress: number;
  /** Scroll timeline progress [0..1] when this group finishes separating */
  endProgress: number;
  /** Optional attribution tag for illustrative reconstruction components */
  reconstructionTag?: string;
}

export const DEFAULT_EXPLOSION_SPREAD = 2.0;
export const MIN_EXPLOSION_SPREAD = 1.0;
export const MAX_EXPLOSION_SPREAD = 3.0;

/**
 * The 19 existing presentation assembly groups inside /models/daytona-sp3-web.glb.
 * Underbody_and_trim remains fixed at (0, 0, 0) as the structural reference core.
 * Exterior separation completes at scrollProgress = 0.70 so Chapter 07 (0.72..1.00)
 * reveals and separates the illustrative mid-rear V12 & chassis reconstruction layer.
 */
export const DAYTONA_PRESENTATION_GROUPS: readonly PresentationGroupSpec[] = [
  {
    nodeName: 'Underbody_and_trim',
    plainName: 'Underbody & Trim',
    category: 'fixed',
    description:
      'Fixed reference core containing the floorpan, front splitter, rear diffuser, grilles, badging, and exterior trim.',
    hiddenInStructureMode: false,
    basePriority: 95,
    worldOffset: { x: 0, y: 0, z: 0 },
    startProgress: 0,
    endProgress: 0,
  },
  // 1. Wheels
  {
    nodeName: 'Front_left_wheel',
    plainName: 'Front Left Wheel',
    category: 'wheels',
    description:
      'Front-left 5-spoke alloy wheel, tyre, center badge, and inner wheel-house liner assembly.',
    hiddenInStructureMode: false,
    basePriority: 82,
    worldOffset: { x: -3.2, y: 0, z: 0.45 },
    startProgress: 0.08,
    endProgress: 0.34,
  },
  {
    nodeName: 'Front_right_wheel',
    plainName: 'Front Right Wheel',
    category: 'wheels',
    description:
      'Front-right 5-spoke alloy wheel, tyre, center badge, and inner wheel-house liner assembly.',
    hiddenInStructureMode: false,
    basePriority: 60,
    worldOffset: { x: 3.2, y: 0, z: 0.45 },
    startProgress: 0.08,
    endProgress: 0.34,
  },
  {
    nodeName: 'Rear_left_wheel',
    plainName: 'Rear Left Wheel',
    category: 'wheels',
    description:
      'Rear-left wide alloy wheel, tyre, center badge, and rear wheel-arch liner assembly.',
    hiddenInStructureMode: false,
    basePriority: 78,
    worldOffset: { x: -3.2, y: 0, z: -0.45 },
    startProgress: 0.08,
    endProgress: 0.34,
  },
  {
    nodeName: 'Rear_right_wheel',
    plainName: 'Rear Right Wheel',
    category: 'wheels',
    description:
      'Rear-right wide alloy wheel, tyre, center badge, and rear wheel-arch liner assembly.',
    hiddenInStructureMode: false,
    basePriority: 58,
    worldOffset: { x: 3.2, y: 0, z: -0.45 },
    startProgress: 0.08,
    endProgress: 0.34,
  },
  // 2. Brakes
  {
    nodeName: 'Front_left_brake',
    plainName: 'Front Left Brake',
    category: 'brakes',
    description:
      'Front-left ventilated carbon-ceramic brake rotor and red caliper assembly.',
    hiddenInStructureMode: false,
    basePriority: 76,
    worldOffset: { x: -1.75, y: 0.12, z: 0.22 },
    startProgress: 0.16,
    endProgress: 0.42,
  },
  {
    nodeName: 'Front_right_brake',
    plainName: 'Front Right Brake',
    category: 'brakes',
    description:
      'Front-right ventilated carbon-ceramic brake rotor and red caliper assembly.',
    hiddenInStructureMode: false,
    basePriority: 54,
    worldOffset: { x: 1.75, y: 0.12, z: 0.22 },
    startProgress: 0.16,
    endProgress: 0.42,
  },
  {
    nodeName: 'Rear_left_brake',
    plainName: 'Rear Left Brake',
    category: 'brakes',
    description:
      'Rear-left ventilated carbon-ceramic brake rotor and red caliper assembly.',
    hiddenInStructureMode: false,
    basePriority: 72,
    worldOffset: { x: -1.75, y: 0.12, z: -0.22 },
    startProgress: 0.16,
    endProgress: 0.42,
  },
  {
    nodeName: 'Rear_right_brake',
    plainName: 'Rear Right Brake',
    category: 'brakes',
    description:
      'Rear-right ventilated carbon-ceramic brake rotor and red caliper assembly.',
    hiddenInStructureMode: false,
    basePriority: 52,
    worldOffset: { x: 1.75, y: 0.12, z: -0.22 },
    startProgress: 0.16,
    endProgress: 0.42,
  },
  // 3. Bodywork, Lighting & Cabin
  {
    nodeName: 'Front_bodywork',
    plainName: 'Front Bodywork & Lid',
    category: 'bodywork',
    description:
      'Front clam bodywork, nose cone, aero flicks, sculpted front fenders, and hinged front luggage lid.',
    hiddenInStructureMode: true,
    basePriority: 92,
    worldOffset: { x: 0, y: 0.45, z: 3.4 },
    startProgress: 0.30,
    endProgress: 0.56,
  },
  {
    nodeName: 'Rear_bodywork',
    plainName: 'Rear Bodywork & Engine Cover',
    category: 'bodywork',
    description:
      'Rear deck bodywork, horizontal strake fascia, rear quarter panels, and hinged central rear engine cover.',
    hiddenInStructureMode: true,
    basePriority: 90,
    worldOffset: { x: 0, y: 0.55, z: -3.5 },
    startProgress: 0.30,
    endProgress: 0.56,
  },
  {
    nodeName: 'Left_bodywork',
    plainName: 'Left Door & Side Bodywork',
    category: 'bodywork',
    description:
      'Left butterfly door assembly with front-side dihedral hinge and sculpted side intake bodywork.',
    hiddenInStructureMode: true,
    basePriority: 84,
    worldOffset: { x: -2.55, y: 0.35, z: 0 },
    startProgress: 0.32,
    endProgress: 0.58,
  },
  {
    nodeName: 'Right_bodywork',
    plainName: 'Right Door & Side Bodywork',
    category: 'bodywork',
    description:
      'Right butterfly door assembly with front-side dihedral hinge and sculpted side intake bodywork.',
    hiddenInStructureMode: true,
    basePriority: 64,
    worldOffset: { x: 2.55, y: 0.35, z: 0 },
    startProgress: 0.32,
    endProgress: 0.58,
  },
  {
    nodeName: 'Upper_bodywork',
    plainName: 'Upper Bodywork',
    category: 'bodywork',
    description:
      'Upper targa roof crown, engine deck surround, and central spine bodywork finished in exterior paint.',
    hiddenInStructureMode: true,
    basePriority: 94,
    worldOffset: { x: 0, y: 2.35, z: -0.35 },
    startProgress: 0.34,
    endProgress: 0.60,
  },
  {
    nodeName: 'Lighting',
    plainName: 'Front & Rear Lighting',
    category: 'bodywork',
    description:
      'Spatially separated front LED daytime running light blades, headlight lenses, and full-width rear tail light bar.',
    hiddenInStructureMode: false,
    basePriority: 74,
    worldOffset: { x: 0, y: 1.15, z: 1.95 },
    startProgress: 0.34,
    endProgress: 0.60,
  },
  {
    nodeName: 'Cabin',
    plainName: 'Cabin Cockpit',
    category: 'bodywork',
    description:
      'Existing interior cockpit geometry featuring integrated seats, stitching, dashboard display, and steering controls.',
    hiddenInStructureMode: false,
    basePriority: 96,
    worldOffset: { x: 0, y: 1.05, z: 0 },
    startProgress: 0.36,
    endProgress: 0.60,
  },
  // 4. Glazing & Mirrors
  {
    nodeName: 'Glazing',
    plainName: 'Glazing & Canopy',
    category: 'glazing_mirrors',
    description:
      'Wraparound visor windscreen, butterfly door side windows, and transparent rear engine louver glazing.',
    hiddenInStructureMode: true,
    basePriority: 88,
    worldOffset: { x: 0, y: 3.55, z: 0.65 },
    startProgress: 0.48,
    endProgress: 0.68,
  },
  {
    nodeName: 'Left_mirror',
    plainName: 'Left Mirror',
    category: 'glazing_mirrors',
    description:
      'Left front-fender mounted aerodynamic rear-view mirror stalk and reflective mirror glass.',
    hiddenInStructureMode: false,
    basePriority: 70,
    worldOffset: { x: -2.9, y: 1.45, z: 0.65 },
    startProgress: 0.50,
    endProgress: 0.70,
  },
  {
    nodeName: 'Right_mirror',
    plainName: 'Right Mirror',
    category: 'glazing_mirrors',
    description:
      'Right front-fender mounted aerodynamic rear-view mirror stalk and reflective mirror glass.',
    hiddenInStructureMode: false,
    basePriority: 50,
    worldOffset: { x: 2.9, y: 1.45, z: 0.65 },
    startProgress: 0.50,
    endProgress: 0.70,
  },
] as const;

export interface GroupProgressItem {
  nodeName: string;
  plainName: string;
  category: PresentationGroupCategory;
  description: string;
  hiddenInStructureMode: boolean;
  localProgress: number;
  state: GroupMotionState;
  isIllustrativeReconstruction?: boolean;
  reconstructionTag?: string;
}

export interface EditorialChapter {
  index: number;
  number: string;
  shortTitle: string;
  stageLabel: string;
  targetProgress: number;
}

export const EDITORIAL_CHAPTERS: readonly EditorialChapter[] = [
  {
    index: 0,
    number: '01',
    shortTitle: 'Assembled',
    stageLabel: 'Assembled · Slow Turntable',
    targetProgress: 0,
  },
  {
    index: 1,
    number: '02',
    shortTitle: 'Stance',
    stageLabel: 'Settling into Three-Quarter View',
    targetProgress: 0.06,
  },
  {
    index: 2,
    number: '03',
    shortTitle: 'Wheels & Brakes',
    stageLabel: 'Separating Wheels & Brakes',
    targetProgress: 0.24,
  },
  {
    index: 3,
    number: '04',
    shortTitle: 'Coachwork & Cabin',
    stageLabel: 'Separating Bodywork, Lighting & Cabin',
    targetProgress: 0.44,
  },
  {
    index: 4,
    number: '05',
    shortTitle: 'Canopy & Mirrors',
    stageLabel: 'Separating Glazing & Mirrors',
    targetProgress: 0.60,
  },
  {
    index: 5,
    number: '06',
    shortTitle: 'Exterior Disassembly',
    stageLabel: 'Separated · 19 Presentation Assemblies',
    targetProgress: 0.71,
  },
  {
    index: 6,
    number: '07',
    shortTitle: 'Chassis & Powertrain',
    stageLabel: 'Chassis & Mid-Rear V12 · Illustrative Reconstruction',
    targetProgress: 1.0,
  },
] as const;

export interface ScrollStageSummary {
  chapterIndex: number;
  chapterNumber: string;
  chapterTitle: string;
  stageLabel: string;
  scrollProgress: number;
  /** Original 19 GLB presentation groups */
  groups: GroupProgressItem[];
  /** 13 Illustrative mechanical reconstruction groups */
  mechanicalGroups: GroupProgressItem[];
  /** Combined 32 inspectable components (19 GLB + 13 Illustrative Mechanical) */
  allComponents: GroupProgressItem[];
  movingGroups: GroupProgressItem[];
  separatedGroups: GroupProgressItem[];
  mechanicalSeparatedGroups: GroupProgressItem[];
  separatedMechanicalGroups: GroupProgressItem[];
}

export function getPresentationGroupSpec(
  nodeName: string | null | undefined,
): PresentationGroupSpec | null {
  if (!nodeName) return null;
  const glbFound = DAYTONA_PRESENTATION_GROUPS.find(
    (g) => g.nodeName === nodeName,
  );
  if (glbFound) return glbFound;

  const mechFound = ILLUSTRATIVE_MECHANICAL_SPECS.find(
    (m) => m.nodeName === nodeName,
  );
  if (mechFound) {
    return {
      nodeName: mechFound.nodeName,
      plainName: mechFound.plainName,
      category: mechFound.category,
      description: mechFound.description,
      hiddenInStructureMode: false,
      basePriority: mechFound.basePriority,
      worldOffset: mechFound.worldOffset,
      startProgress: mechFound.startProgress,
      endProgress: mechFound.endProgress,
      reconstructionTag: mechFound.reconstructionTag,
    };
  }
  return null;
}

export const getComponentSpec = getPresentationGroupSpec;

export function isIllustrativeMechanicalSpec(
  spec: PresentationGroupSpec | null | undefined,
): boolean {
  if (!spec) return false;
  return Boolean(
    spec.reconstructionTag ||
      spec.category === 'v12_powertrain' ||
      spec.category === 'chassis_suspension',
  );
}

/**
 * Smoothstep easing function for natural mechanical acceleration and settling.
 */
export function smoothStep01(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Computes the local [0..1] separation progress and motion state for a single presentation group
 * at a given overall scroll progress [0..1].
 */
export function computeGroupProgress(
  spec: PresentationGroupSpec,
  scrollProgress: number,
): { localProgress: number; state: GroupMotionState } {
  if (spec.category === 'fixed' || spec.endProgress <= spec.startProgress) {
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
 * Returns a human-readable stage label, active numbered chapter (01..07),
 * and synchronized status for all 19 GLB groups and 13 illustrative mechanical assemblies.
 */
export function evaluateScrollSequence(scrollProgress: number): ScrollStageSummary {
  const p = Math.max(0, Math.min(1, scrollProgress));

  let chapterIndex = 0;
  if (p > 0.01 && p < 0.08) {
    chapterIndex = 1;
  } else if (p >= 0.08 && p < 0.30) {
    chapterIndex = 2;
  } else if (p >= 0.30 && p < 0.50) {
    chapterIndex = 3;
  } else if (p >= 0.50 && p < 0.69) {
    chapterIndex = 4;
  } else if (p >= 0.69 && p < 0.74) {
    chapterIndex = 5;
  } else if (p >= 0.74) {
    chapterIndex = 6;
  }

  const chapter = EDITORIAL_CHAPTERS[chapterIndex];

  const groups: GroupProgressItem[] = DAYTONA_PRESENTATION_GROUPS.map((spec) => {
    const { localProgress, state } = computeGroupProgress(spec, p);
    return {
      nodeName: spec.nodeName,
      plainName: spec.plainName,
      category: spec.category,
      description: spec.description,
      hiddenInStructureMode: spec.hiddenInStructureMode,
      localProgress,
      state,
      isIllustrativeReconstruction: false,
    };
  });

  const mechanicalGroups: GroupProgressItem[] = ILLUSTRATIVE_MECHANICAL_SPECS.map(
    (spec) => {
      const { localProgress, state } = computeMechanicalGroupProgress(spec, p);
      return {
        nodeName: spec.nodeName,
        plainName: spec.plainName,
        category: spec.category,
        description: spec.description,
        hiddenInStructureMode: false,
        localProgress,
        state,
        isIllustrativeReconstruction: true,
        reconstructionTag: ILLUSTRATIVE_RECONSTRUCTION_LABEL,
      };
    },
  );

  const allComponents = [...groups, ...mechanicalGroups];
  const movingGroups = allComponents.filter((g) => g.state === 'moving');
  const separatedGroups = groups.filter((g) => g.state === 'separated');
  const mechanicalSeparatedGroups = mechanicalGroups.filter(
    (g) => g.state === 'separated' || g.state === 'moving',
  );
  const separatedMechanicalGroups = mechanicalGroups.filter(
    (g) => g.state === 'separated',
  );

  return {
    chapterIndex: chapter.index,
    chapterNumber: chapter.number,
    chapterTitle: chapter.shortTitle,
    stageLabel: chapter.stageLabel,
    scrollProgress: p,
    groups,
    mechanicalGroups,
    allComponents,
    movingGroups,
    separatedGroups,
    mechanicalSeparatedGroups,
    separatedMechanicalGroups,
  };
}

export interface CapturedGroupBinding {
  spec: PresentationGroupSpec;
  object: THREE.Object3D;
  parent: THREE.Object3D;
  origLocalPosition: THREE.Vector3;
  origLocalQuaternion: THREE.Quaternion;
  origLocalScale: THREE.Vector3;
  /** Group world-space bounding box and center when assembled at scrollProgress = 0 */
  origWorldBox: THREE.Box3;
  origWorldCenter: THREE.Vector3;
}

const _worldOriginScratch = new THREE.Vector3();
const _targetWorldScratch = new THREE.Vector3();

/**
 * Captures the 19 named presentation groups from a loaded GLTF scene hierarchy
 * along with their exact original local transforms and world-space bounds.
 */
export function capturePresentationGroupBindings(
  modelRoot: THREE.Object3D,
): CapturedGroupBinding[] {
  modelRoot.updateMatrixWorld(true);
  const bindings: CapturedGroupBinding[] = [];

  for (const spec of DAYTONA_PRESENTATION_GROUPS) {
    const obj = modelRoot.getObjectByName(spec.nodeName);
    if (obj && obj.parent) {
      const origWorldBox = new THREE.Box3().setFromObject(obj);
      const origWorldCenter = new THREE.Vector3();
      if (!origWorldBox.isEmpty()) {
        origWorldBox.getCenter(origWorldCenter);
      } else {
        obj.getWorldPosition(origWorldCenter);
      }

      bindings.push({
        spec,
        object: obj,
        parent: obj.parent,
        origLocalPosition: obj.position.clone(),
        origLocalQuaternion: obj.quaternion.clone(),
        origLocalScale: obj.scale.clone(),
        origWorldBox,
        origWorldCenter,
      });
    }
  }

  return bindings;
}

/**
 * Applies scroll-driven explosion offsets to all captured presentation groups by converting
 * world-space displacement into each group's parent local space.
 * During Chapter 07 (scrollProgress > 0.72), outer bodywork & glazing step slightly further out
 * so the central illustrative mid-rear V12 & chassis reconstruction is unobstructed.
 * Restores exact original transforms when localProgress === 0.
 */
export function applyPresentationExplosion(
  bindings: readonly CapturedGroupBinding[],
  scrollProgress: number,
  modelScaleRatio = 1,
  spreadMultiplier = DEFAULT_EXPLOSION_SPREAD,
): void {
  const p = Math.max(0, Math.min(1, scrollProgress));
  const clampedSpread = Math.max(
    MIN_EXPLOSION_SPREAD,
    Math.min(MAX_EXPLOSION_SPREAD, spreadMultiplier),
  );
  // Extra radial clearance during Chapter 07 (0.72..1.00) so exterior panels frame the V12 & chassis
  const deepChapterBoost =
    p > 0.72 ? 1 + 0.22 * smoothStep01((p - 0.72) / 0.28) : 1;

  for (const binding of bindings) {
    const {
      spec,
      object,
      parent,
      origLocalPosition,
      origLocalQuaternion,
      origLocalScale,
    } = binding;
    const { localProgress } = computeGroupProgress(spec, p);

    if (
      localProgress <= 0 ||
      (spec.worldOffset.x === 0 &&
        spec.worldOffset.y === 0 &&
        spec.worldOffset.z === 0)
    ) {
      object.position.copy(origLocalPosition);
      object.quaternion.copy(origLocalQuaternion);
      object.scale.copy(origLocalScale);
      continue;
    }

    parent.updateWorldMatrix(true, false);

    _worldOriginScratch.copy(origLocalPosition);
    parent.localToWorld(_worldOriginScratch);

    const effectiveScale =
      modelScaleRatio * clampedSpread * localProgress * deepChapterBoost;
    _targetWorldScratch.set(
      _worldOriginScratch.x + spec.worldOffset.x * effectiveScale,
      _worldOriginScratch.y + spec.worldOffset.y * effectiveScale,
      _worldOriginScratch.z + spec.worldOffset.z * effectiveScale,
    );

    parent.worldToLocal(_targetWorldScratch);

    object.position.copy(_targetWorldScratch);
    object.quaternion.copy(origLocalQuaternion);
    object.scale.copy(origLocalScale);
  }
}

/**
 * Toggles Structure Mode by hiding outer bodywork and glazing to reveal existing interior,
 * underbody, and illustrative mechanical V12/chassis geometry.
 * Returns the number of hidden presentation groups (6).
 */
export function applyStructureModeVisibility(
  bindings: readonly CapturedGroupBinding[],
  structureMode: boolean,
): number {
  let hiddenCount = 0;
  for (const binding of bindings) {
    const shouldHide = structureMode && binding.spec.hiddenInStructureMode;
    binding.object.visible = !shouldHide;
    if (shouldHide) {
      hiddenCount += 1;
    }

    if (binding.spec.nodeName === 'Underbody_and_trim') {
      binding.object.traverse((child) => {
        if (child === binding.object) return;
        const mesh = child as THREE.Mesh;
        const matName = !Array.isArray(mesh.material)
          ? mesh.material?.name || ''
          : '';
        if (
          child.name.includes('WindowsTrims') ||
          matName.includes('WindowsTrims')
        ) {
          child.visible = !structureMode;
        }
      });
    }
  }
  return hiddenCount;
}

/**
 * Computes camera framing distance and target Y offset across the scroll sequence
 * and explosion spread multiplier (1x–3x) so both the exterior explosion and the
 * Chapter 07 Chassis & Powertrain layer remain large and unclipped.
 */
export function computeExpandedCameraFraming(
  baseFitDistance: number,
  scrollProgress: number,
  spreadMultiplier = DEFAULT_EXPLOSION_SPREAD,
): { distance: number; targetYOffset: number } {
  const p = Math.max(0, Math.min(1, scrollProgress));
  const clampedSpread = Math.max(
    MIN_EXPLOSION_SPREAD,
    Math.min(MAX_EXPLOSION_SPREAD, spreadMultiplier),
  );
  // Peak exterior pullback at p = 0.71, then slightly tighter focus on the V12 & chassis in 0.72..1.00
  const extEase = smoothStep01(Math.min(1, p / 0.71));
  const deepEase = p > 0.72 ? smoothStep01((p - 0.72) / 0.28) : 0;
  const distanceFactor =
    1 + (0.48 + 0.45 * clampedSpread) * extEase - 0.14 * deepEase;
  const targetYOffset =
    (0.18 + 0.16 * clampedSpread) * extEase - 0.08 * deepEase;
  return {
    distance: baseFitDistance * distanceFactor,
    targetYOffset,
  };
}

export interface GroupInspectionFraming {
  cameraPosition: { x: number; y: number; z: number };
  orbitTarget: { x: number; y: number; z: number };
  inspectDistance: number;
  liveBox: THREE.Box3;
}

/**
 * Computes a close-up camera position and orbit target for inspecting any presentation group
 * OR illustrative mechanical sub-assembly at the current scroll progress and explosion spread.
 */
export function computeGroupInspectionFraming(
  binding: CapturedGroupBinding | CapturedMechanicalBinding,
  scrollProgress: number,
  modelScaleRatio = 1,
  spreadMultiplier = DEFAULT_EXPLOSION_SPREAD,
  cameraFovDeg = 40,
  aspect = 16 / 9,
): GroupInspectionFraming {
  const p = Math.max(0, Math.min(1, scrollProgress));
  const clampedSpread = Math.max(
    MIN_EXPLOSION_SPREAD,
    Math.min(MAX_EXPLOSION_SPREAD, spreadMultiplier),
  );

  // Measure live world bounding box directly from the 3D object so hinge rotations & sub-part offsets are included
  binding.object.updateWorldMatrix(true, true);
  const liveBox = new THREE.Box3().setFromObject(binding.object);

  if (liveBox.isEmpty()) {
    const { localProgress } =
      'restCenter' in binding.spec
        ? computeMechanicalGroupProgress(binding.spec, p)
        : computeGroupProgress(binding.spec, p);
    const effScale = modelScaleRatio * clampedSpread * localProgress;
    const liveOffset = new THREE.Vector3(
      binding.spec.worldOffset.x * effScale,
      binding.spec.worldOffset.y * effScale,
      binding.spec.worldOffset.z * effScale,
    );
    liveBox.copy(binding.origWorldBox).translate(liveOffset);
  }

  if (liveBox.isEmpty()) {
    liveBox.setFromCenterAndSize(
      binding.origWorldCenter.clone(),
      new THREE.Vector3(1.2, 0.8, 1.2),
    );
  }

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  liveBox.getCenter(center);
  liveBox.getSize(size);

  const safeAspect = Number.isFinite(aspect) && aspect > 0.05 ? aspect : 16 / 9;
  const safeFovDeg =
    Number.isFinite(cameraFovDeg) && cameraFovDeg > 5 && cameraFovDeg < 150
      ? cameraFovDeg
      : 40;
  const halfFovV = ((safeFovDeg * Math.PI) / 180) * 0.5;
  const halfFovH = Math.atan(Math.tan(halfFovV) * safeAspect);

  const groupDiag = Math.max(0.85, Math.hypot(size.x, size.y, size.z));
  const distH = (groupDiag * 0.68) / (2 * Math.tan(halfFovH) * 0.62);
  const distV = (groupDiag * 0.54) / (2 * Math.tan(halfFovV) * 0.58);
  const inspectDistance = Math.max(groupDiag * 1.15, distH, distV);

  let dirX = 0.66;
  let dirY = 0.34;
  let dirZ = 0.66;

  const origX = binding.origWorldCenter.x;
  const origZ = binding.origWorldCenter.z;

  if ('reconstructionTag' in binding.spec) {
    // Mechanical V12 / chassis close-up angle: elevated 3/4 view into the engine bay or chassis
    dirX = 0.64;
    dirY = 0.48;
    dirZ = origZ < -1.0 ? -0.60 : 0.60;
  } else if (Math.abs(origX) > 0.65) {
    dirX = origX >= 0 ? 0.82 : -0.82;
    dirY = 0.28;
    dirZ = origZ >= 0 ? 0.49 : -0.49;
  } else if (origZ > 1.2) {
    dirX = 0.52;
    dirY = 0.32;
    dirZ = 0.79;
  } else if (origZ < -1.2) {
    dirX = 0.54;
    dirY = 0.32;
    dirZ = -0.78;
  } else {
    dirX = 0.62;
    dirY = 0.44;
    dirZ = 0.65;
  }

  const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
  return {
    cameraPosition: {
      x: center.x + (dirX / dirLen) * inspectDistance,
      y: center.y + (dirY / dirLen) * inspectDistance,
      z: center.z + (dirZ / dirLen) * inspectDistance,
    },
    orbitTarget: {
      x: center.x,
      y: center.y,
      z: center.z,
    },
    inspectDistance,
    liveBox,
  };
}

function getOrCreateDimmedMaterial(
  origMat: THREE.Material,
  opacity = 0.18,
): THREE.Material {
  const userData = origMat.userData || (origMat.userData = {});
  const cacheKey = `__cachedDimmedClone_${Math.round(opacity * 100)}`;
  if (userData[cacheKey]) {
    return userData[cacheKey] as THREE.Material;
  }
  const dimmed = origMat.clone() as THREE.MeshStandardMaterial;
  dimmed.transparent = true;
  dimmed.opacity = opacity;
  dimmed.depthWrite = false;
  if ('envMapIntensity' in dimmed) {
    dimmed.envMapIntensity = 0.14;
  }
  if (dimmed.color instanceof THREE.Color) {
    dimmed.color.multiplyScalar(0.45);
  }
  if ('emissiveIntensity' in dimmed) {
    dimmed.emissiveIntensity = 0.15;
  }
  dimmed.needsUpdate = true;
  userData[cacheKey] = dimmed;
  return dimmed;
}

/**
 * Dims surrounding presentation and mechanical groups when a specific component is selected
 * for close-up inspection, OR dims outer bodywork shells during Chapter 07 (scrollProgress > 0.72)
 * so the inner V12 & chassis reconstruction layer is clearly visible.
 * Passing inspectedNodeName === null and scrollProgress <= 0.72 restores every mesh to its exact original material.
 */
export function applyInspectionDimming(
  bindings: readonly CapturedGroupBinding[],
  inspectedNodeName: string | null,
  structureMode = false,
  mechanicalBindings: readonly CapturedMechanicalBinding[] = [],
  scrollProgress = 0,
): number {
  const allBindings: Array<CapturedGroupBinding | CapturedMechanicalBinding> = [
    ...bindings,
    ...mechanicalBindings,
  ];
  const hasTarget =
    Boolean(inspectedNodeName) &&
    allBindings.some((b) => b.spec.nodeName === inspectedNodeName);

  const inDeepMechanicalChapter = scrollProgress > 0.72 && !hasTarget;

  // Restore base Structure Mode visibility first
  applyStructureModeVisibility(bindings, structureMode);

  let dimmedCount = 0;

  for (const binding of allBindings) {
    const isInspected = hasTarget && binding.spec.nodeName === inspectedNodeName;
    const isMech = 'reconstructionTag' in binding.spec;

    if (isInspected && !binding.object.visible) {
      binding.object.visible = true;
    }

    // When inspecting a mechanical part while assembled, dim the outer car shell;
    // When in Chapter 07 (scrollProgress > 0.72), softly fade outer bodywork/underbody so V12 & chassis shine
    const shouldDimForInspection = hasTarget && !isInspected;
    const shouldFadeForDeepChapter =
      inDeepMechanicalChapter &&
      !isMech &&
      (binding.spec.category === 'bodywork' ||
        binding.spec.category === 'glazing_mirrors' ||
        binding.spec.nodeName === 'Underbody_and_trim');

    const shouldDim = shouldDimForInspection || shouldFadeForDeepChapter;
    const targetOpacity = shouldDimForInspection ? 0.18 : 0.24;

    if (shouldDimForInspection) {
      dimmedCount += 1;
    }

    binding.object.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;

      if (!mesh.userData.__origMaterial) {
        mesh.userData.__origMaterial = mesh.material;
      }

      const origMat = mesh.userData.__origMaterial as
        | THREE.Material
        | THREE.Material[];

      if (!shouldDim) {
        mesh.material = origMat;
      } else if (Array.isArray(origMat)) {
        mesh.material = origMat.map((m) =>
          getOrCreateDimmedMaterial(m, targetOpacity),
        );
      } else {
        mesh.material = getOrCreateDimmedMaterial(origMat, targetOpacity);
      }
    });
  }

  return dimmedCount;
}

/**
 * Checks whether a material name targets the exterior paint material (Rosso_Magma).
 */
export function isExteriorPaintMaterial(
  materialName: string | undefined | null,
): boolean {
  if (!materialName) return false;
  return (
    materialName === '022_Ferrari_Daytona_SP3_Rosso_Magma' ||
    materialName.endsWith(EXTERIOR_PAINT_MATERIAL_SUFFIX)
  );
}

export interface MaterialRecord {
  material: THREE.MeshStandardMaterial;
  name: string;
  isExteriorPaint: boolean;
  hasClearcoat: boolean;
  origColorHex: number;
  origColor: THREE.Color;
  origMap: THREE.Texture | null;
  origNormalMap: THREE.Texture | null;
  origRoughnessMap: THREE.Texture | null;
  origMetalnessMap: THREE.Texture | null;
}

const _physicalTemplate = new THREE.MeshPhysicalMaterial();

function upgradeExteriorPaintToClearcoatInPlace(
  mat: THREE.MeshStandardMaterial,
): void {
  const phys = mat as THREE.MeshPhysicalMaterial;
  if (!phys.isMeshPhysicalMaterial) {
    for (const key of Object.keys(_physicalTemplate)) {
      if (!(key in phys)) {
        const val = (_physicalTemplate as unknown as Record<string, unknown>)[
          key
        ];
        if (val instanceof THREE.Color) {
          (phys as unknown as Record<string, unknown>)[key] = val.clone();
        } else if (val instanceof THREE.Vector2) {
          (phys as unknown as Record<string, unknown>)[key] = val.clone();
        } else {
          (phys as unknown as Record<string, unknown>)[key] = val;
        }
      }
    }
    Object.setPrototypeOf(phys, THREE.MeshPhysicalMaterial.prototype);
    (
      phys as unknown as { isMeshPhysicalMaterial: boolean }
    ).isMeshPhysicalMaterial = true;
    phys.type = 'MeshPhysicalMaterial';
  }

  phys.clearcoat = 1.0;
  phys.clearcoatRoughness = 0.055;
  phys.roughness = 0.28;
  phys.metalness = 0.16;
  phys.ior = 1.5;
  phys.specularIntensity = 0.9;
  phys.fog = false;
  phys.needsUpdate = true;
}

/**
 * Captures a snapshot of all materials in the loaded GLB so that exterior paint recolouring
 * can strictly target Rosso_Magma, restore exact Original paint, and verify non-paint materials are untouched.
 */
export function captureModelMaterials(
  modelRoot: THREE.Object3D,
): MaterialRecord[] {
  const seen = new Set<THREE.Material>();
  const records: MaterialRecord[] = [];

  modelRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    // Skip procedural illustrative mechanical layer & spatial lamp clones so non-paint check stays pure
    if (
      obj.userData?.illustrativeReconstruction ||
      mesh.name.startsWith('Lighting__Front_DRL') ||
      mesh.name.startsWith('Lighting__Rear_Marker') ||
      mesh.parent?.name === 'Front_Luggage_Compartment_Tub'
    ) {
      return;
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat.color instanceof THREE.Color) {
        const isPaint = isExteriorPaintMaterial(stdMat.name);
        stdMat.fog = false;
        if (isPaint) {
          upgradeExteriorPaintToClearcoatInPlace(stdMat);
        } else if (
          stdMat.name.includes('Windows') ||
          stdMat.name.includes('Glass')
        ) {
          stdMat.roughness = 0.06;
          stdMat.envMapIntensity = 0.65;
          stdMat.needsUpdate = true;
        }
        records.push({
          material: stdMat,
          name: stdMat.name || '',
          isExteriorPaint: isPaint,
          hasClearcoat:
            isPaint &&
            Boolean((stdMat as THREE.MeshPhysicalMaterial).clearcoat >= 0.9),
          origColorHex: stdMat.color.getHex(),
          origColor: stdMat.color.clone(),
          origMap: stdMat.map ?? null,
          origNormalMap: stdMat.normalMap ?? null,
          origRoughnessMap: stdMat.roughnessMap ?? null,
          origMetalnessMap: stdMat.metalnessMap ?? null,
        });
      }
    }
  });

  return records;
}

/**
 * Applies the chosen paint swatch or custom colour strictly to the Rosso_Magma exterior paint material.
 */
export function applyExteriorPaintColor(
  records: readonly MaterialRecord[],
  swatchId: PaintSwatchId,
  customHex = '#ff6b00',
): { appliedHex: string; nonPaintUnchanged: boolean } {
  const swatchSpec =
    PAINT_SWATCHES.find((s) => s.id === swatchId) ?? PAINT_SWATCHES[0];
  let appliedHex = swatchSpec.hex;

  for (const rec of records) {
    if (!rec.isExteriorPaint) continue;

    if (swatchId === 'original') {
      rec.material.color.copy(rec.origColor);
    } else if (swatchId === 'custom') {
      const cleanHex = /^#[0-9a-fA-F]{6}$/.test(customHex)
        ? customHex
        : '#ff6b00';
      rec.material.color.setStyle(cleanHex, THREE.SRGBColorSpace);
    } else {
      rec.material.color.setStyle(swatchSpec.hex, THREE.SRGBColorSpace);
    }
    rec.material.needsUpdate = true;
    if (rec.material.userData) {
      delete rec.material.userData.__cachedDimmedClone_18;
      delete rec.material.userData.__cachedDimmedClone_24;
    }
    appliedHex = `#${rec.material.color.getHexString(THREE.SRGBColorSpace)}`;
  }

  const nonPaintUnchanged = verifyNonPaintMaterialsUnchanged(records);
  return { appliedHex, nonPaintUnchanged };
}

export function verifyNonPaintMaterialsUnchanged(
  records: readonly MaterialRecord[],
): boolean {
  for (const rec of records) {
    if (
      rec.material.map !== rec.origMap ||
      rec.material.normalMap !== rec.origNormalMap ||
      rec.material.roughnessMap !== rec.origRoughnessMap ||
      rec.material.metalnessMap !== rec.origMetalnessMap
    ) {
      return false;
    }
    if (!rec.isExteriorPaint) {
      if (rec.material.color.getHex() !== rec.origColorHex) {
        return false;
      }
    }
  }
  return true;
}

export interface ScreenLabelCandidate {
  nodeName: string;
  plainName: string;
  category: PresentationGroupCategory;
  state: GroupMotionState;
  anchorX: number;
  anchorY: number;
  ndcZ: number;
  visible: boolean;
  basePriority: number;
  isIllustrativeReconstruction?: boolean;
}

export interface PositionedScreenLabel {
  nodeName: string;
  plainName: string;
  category: PresentationGroupCategory;
  state: GroupMotionState;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  align: 'left' | 'right' | 'center';
  isSelected: boolean;
  isIllustrativeReconstruction: boolean;
}

/**
 * Computes non-overlapping 2D screen positions for on-model component labels with anchor dots and leader lines.
 * Supports labelDensity ('off' | 'minimal' | 'balanced' | 'detailed') and prioritizes
 * illustrative V12 & chassis components when in Chapter 07, Structure Mode, or when Rear Engine Cover is open.
 */
export function computeScreenLabelLayout(
  candidates: readonly ScreenLabelCandidate[],
  viewportWidth: number,
  viewportHeight: number,
  scrollProgress: number,
  structureMode: boolean,
  selectedNodeName: string | null = null,
  topSafeY = 115,
  bottomSafeY = viewportHeight - 105,
  labelDensity: LabelDensityMode = 'balanced',
  rearCoverOpen = false,
): PositionedScreenLabel[] {
  if (labelDensity === 'off') return [];

  const isMobile = viewportWidth < 768;
  const densityOption =
    LABEL_DENSITY_OPTIONS.find((d) => d.id === labelDensity) ??
    LABEL_DENSITY_OPTIONS[2];
  const maxLabels = isMobile
    ? densityOption.mobileCap
    : densityOption.desktopCap;

  if (maxLabels <= 0) return [];

  const valid = candidates.filter(
    (c) =>
      c.visible &&
      c.ndcZ >= -1.0 &&
      c.ndcZ < 1.0 &&
      c.anchorX >= 24 &&
      c.anchorX <= viewportWidth - 24 &&
      c.anchorY >= topSafeY - 20 &&
      c.anchorY <= bottomSafeY + 20,
  );

  if (valid.length === 0) return [];

  let sumX = 0;
  let sumY = 0;
  for (const c of valid) {
    sumX += c.anchorX;
    sumY += c.anchorY;
  }
  const centerX = sumX / valid.length;
  const centerY = sumY / valid.length;

  const inDeepMechanicalChapter = scrollProgress >= 0.72;

  const scored = valid.map((c) => {
    let score = c.basePriority;
    const isMech =
      Boolean(c.isIllustrativeReconstruction) ||
      c.category === 'v12_powertrain' ||
      c.category === 'chassis_suspension';

    if (c.nodeName === selectedNodeName) {
      score += 3000;
    }
    if (inDeepMechanicalChapter) {
      if (isMech) {
        score += 750;
      } else {
        score -= 220;
      }
    } else if (structureMode) {
      if (isMech || c.nodeName === 'Cabin' || c.nodeName === 'Underbody_and_trim') {
        score += 520;
      }
    } else if (rearCoverOpen && c.category === 'v12_powertrain') {
      score += 480;
    } else if (!inDeepMechanicalChapter && !structureMode && !rearCoverOpen && isMech) {
      // When exterior is closed and assembled, prioritize exterior labels unless Detailed density is chosen
      score -= labelDensity === 'detailed' ? 40 : 320;
    }

    if (scrollProgress > 0.02) {
      if (c.state === 'moving') {
        score += 350;
      } else if (c.state === 'separated') {
        score += 180;
      }
    }
    return { candidate: c, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const leaderLength = isMobile ? 38 : labelDensity === 'detailed' ? 50 : 58;
  const minHorizontalGap = isMobile
    ? 128
    : labelDensity === 'detailed'
      ? 124
      : 138;
  const minVerticalGap = isMobile
    ? 30
    : labelDensity === 'detailed'
      ? 28
      : 34;
  const marginX = isMobile ? 64 : 84;
  const minY = Math.max(54, topSafeY);
  const maxY = Math.max(minY + 40, bottomSafeY);

  const placed: PositionedScreenLabel[] = [];
  const yNudges = [0, -32, 32, -64, 64, -96, 96, -128, 128];
  const xNudges = [0, -28, 28];

  for (const { candidate } of scored) {
    if (placed.length >= maxLabels) break;

    let dx = candidate.anchorX - centerX;
    let dy = candidate.anchorY - centerY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) {
      dx = 0;
      dy = -1;
    } else {
      dx /= len;
      dy /= len;
    }

    const baseLabelX = candidate.anchorX + dx * leaderLength * 1.35;
    const baseLabelY = candidate.anchorY + dy * leaderLength - 12;

    let chosenX: number | null = null;
    let chosenY: number | null = null;

    outer: for (const xShift of xNudges) {
      for (const yShift of yNudges) {
        const testY = Math.max(minY, Math.min(maxY, baseLabelY + yShift));
        const minAllowedX =
          viewportWidth >= 1024 && testY < 460
            ? Math.max(marginX, 290)
            : marginX;
        const testX = Math.max(
          minAllowedX,
          Math.min(viewportWidth - marginX, baseLabelX + xShift),
        );

        const collides = placed.some(
          (p) =>
            Math.abs(p.labelX - testX) < minHorizontalGap &&
            Math.abs(p.labelY - testY) < minVerticalGap,
        );
        if (!collides) {
          chosenX = testX;
          chosenY = testY;
          break outer;
        }
      }
    }

    if (chosenY === null && candidate.nodeName === selectedNodeName) {
      const minAllowedX =
        viewportWidth >= 1024 && baseLabelY < 460
          ? Math.max(marginX, 290)
          : marginX;
      chosenX = Math.max(
        minAllowedX,
        Math.min(viewportWidth - marginX, baseLabelX),
      );
      chosenY = Math.max(minY, Math.min(maxY, baseLabelY));
    }

    if (chosenX !== null && chosenY !== null) {
      const align: 'left' | 'right' | 'center' =
        Math.abs(chosenX - candidate.anchorX) < 12
          ? 'center'
          : chosenX >= candidate.anchorX
            ? 'left'
            : 'right';

      placed.push({
        nodeName: candidate.nodeName,
        plainName: candidate.plainName,
        category: candidate.category,
        state: candidate.state,
        anchorX: Math.round(candidate.anchorX),
        anchorY: Math.round(candidate.anchorY),
        labelX: Math.round(chosenX),
        labelY: Math.round(chosenY),
        align,
        isSelected: candidate.nodeName === selectedNodeName,
        isIllustrativeReconstruction: Boolean(
          candidate.isIllustrativeReconstruction ||
            candidate.category === 'v12_powertrain' ||
            candidate.category === 'chassis_suspension',
        ),
      });
    }
  }

  return placed;
}
