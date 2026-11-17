export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface BoundingFitResult {
  size: Vec3Like;
  center: Vec3Like;
  modelPositionOffset: Vec3Like;
  orbitTarget: Vec3Like;
  homeCameraPosition: Vec3Like;
  fitDistance: number;
  maxDim: number;
  boundingRadius: number;
  floorY: number;
  minDistance: number;
  maxDistance: number;
  near: number;
  far: number;
}

export interface CameraPreset {
  id: 'hero' | 'front' | 'side' | 'rear' | 'top';
  label: string;
  direction: Vec3Like;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'hero',
    label: '3/4 Studio',
    direction: { x: 0.68, y: 0.25, z: 0.68 },
  },
  {
    id: 'front',
    label: 'Front',
    direction: { x: 0.0, y: 0.16, z: 0.987 },
  },
  {
    id: 'side',
    label: 'Profile',
    direction: { x: 0.99, y: 0.14, z: 0.0 },
  },
  {
    id: 'rear',
    label: 'Rear 3/4',
    direction: { x: -0.68, y: 0.24, z: -0.69 },
  },
  {
    id: 'top',
    label: 'Plan View',
    direction: { x: 0.0, y: 0.98, z: 0.18 },
  },
];

/**
 * Computes centering offset, floor height, and camera framing parameters
 * from a 3D model's axis-aligned bounding box.
 * Fits the assembled vehicle to roughly 80% of the unobstructed viewport width
 * while preserving full-car visibility and vertical clearance on wide and narrow screens.
 */
export function computeCenterAndFit(
  boxMin: Vec3Like,
  boxMax: Vec3Like,
  cameraFovDeg = 40,
  aspect = 16 / 9,
  paddingFactor = 1.25,
): BoundingFitResult {
  const width = Math.max(0, boxMax.x - boxMin.x);
  const height = Math.max(0, boxMax.y - boxMin.y);
  const depth = Math.max(0, boxMax.z - boxMin.z);

  const size: Vec3Like = { x: width, y: height, z: depth };
  const center: Vec3Like = {
    x: (boxMin.x + boxMax.x) * 0.5,
    y: (boxMin.y + boxMax.y) * 0.5,
    z: (boxMin.z + boxMax.z) * 0.5,
  };

  const rawMaxDim = Math.max(width, height, depth);
  const maxDim = rawMaxDim > 1e-5 ? rawMaxDim : 1;
  const boundingRadius =
    Math.sqrt(width * width + height * height + depth * depth) * 0.5 || 0.866;

  // Center the model at the world origin (0, 0, 0)
  const modelPositionOffset: Vec3Like = {
    x: -center.x,
    y: -center.y,
    z: -center.z,
  };

  const orbitTarget: Vec3Like = { x: 0, y: 0, z: 0 };
  const floorY = -height * 0.5;

  const safeAspect = Number.isFinite(aspect) && aspect > 0.05 ? aspect : 16 / 9;
  const safeFovDeg =
    Number.isFinite(cameraFovDeg) && cameraFovDeg > 5 && cameraFovDeg < 150
      ? cameraFovDeg
      : 40;

  const halfFovV = ((safeFovDeg * Math.PI) / 180) * 0.5;
  const halfFovH = Math.atan(Math.tan(halfFovV) * safeAspect);

  // Normalize paddingFactor relative to the baseline 1.25 so default callers fit ~80% unobstructed width
  const normalizedPadding = Math.max(0.78, paddingFactor / 1.25);

  // Projected 3/4 bounding span (~1.06 * maxDim with perspective foreshortening) fitted to ~80% of unobstructed viewport width
  const targetWidthFraction = safeAspect >= 1.25 ? 0.76 : 0.82;
  const projectedHorizontalSpan = maxDim * 1.06;
  const horizontalFitDist =
    projectedHorizontalSpan /
    (2 * Math.tan(halfFovH) * targetWidthFraction);

  // Projected 3/4 vertical span fitted inside the unobstructed stage height between header & compact dock
  const projectedVerticalSpan = Math.max(height * 1.6, maxDim * 0.54);
  const verticalFitDist =
    projectedVerticalSpan / (2 * Math.tan(halfFovV) * 0.66);

  const fitDistance =
    Math.max(boundingRadius * 1.32, horizontalFitDist, verticalFitDist) *
    normalizedPadding;

  const heroDir = CAMERA_PRESETS[0].direction;
  const dirLen =
    Math.sqrt(
      heroDir.x * heroDir.x + heroDir.y * heroDir.y + heroDir.z * heroDir.z,
    ) || 1;

  const homeCameraPosition: Vec3Like = {
    x: orbitTarget.x + (heroDir.x / dirLen) * fitDistance,
    y: orbitTarget.y + (heroDir.y / dirLen) * fitDistance,
    z: orbitTarget.z + (heroDir.z / dirLen) * fitDistance,
  };

  return {
    size,
    center,
    modelPositionOffset,
    orbitTarget,
    homeCameraPosition,
    fitDistance,
    maxDim,
    boundingRadius,
    floorY,
    minDistance: Math.max(0.01, maxDim * 0.08),
    maxDistance: Math.max(10, fitDistance * 4.5),
    near: Math.max(0.001, maxDim / 1000),
    far: Math.max(100, fitDistance * 35),
  };
}

export function computePresetCameraPosition(
  presetId: CameraPreset['id'],
  fitDistance: number,
  orbitTarget: Vec3Like = { x: 0, y: 0, z: 0 },
): Vec3Like {
  const preset =
    CAMERA_PRESETS.find((p) => p.id === presetId) ?? CAMERA_PRESETS[0];
  const { x, y, z } = preset.direction;
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return {
    x: orbitTarget.x + (x / len) * fitDistance,
    y: orbitTarget.y + (y / len) * fitDistance,
    z: orbitTarget.z + (z / len) * fitDistance,
  };
}

export interface GlbValidationResult {
  valid: boolean;
  errorTitle?: string;
  errorDetail?: string;
  version?: number;
  declaredLength?: number;
}

/**
 * Validates that an uploaded file buffer is a structurally valid GLB v2 binary container
 * (or non-empty .gltf JSON file) before passing it to GLTFLoader + MeshoptDecoder.
 */
export function validateGlbBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): GlbValidationResult {
  const trimmedName = fileName.trim();
  const lower = trimmedName.toLowerCase();

  if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
    return {
      valid: false,
      errorTitle: 'Unsupported 3D File Format',
      errorDetail: `"${trimmedName || 'Selected file'}" is not a .glb or .gltf file. Please select a binary glTF (.glb) model of the Ferrari Daytona SP3.`,
    };
  }

  if (!buffer || buffer.byteLength === 0) {
    return {
      valid: false,
      errorTitle: 'Empty Model File',
      errorDetail: `"${trimmedName}" contains 0 bytes. Please verify the file finished downloading before importing.`,
    };
  }

  if (lower.endsWith('.glb')) {
    if (buffer.byteLength < 20) {
      return {
        valid: false,
        errorTitle: 'Corrupted GLB Header',
        errorDetail: `"${trimmedName}" is only ${buffer.byteLength} bytes (a valid binary glTF 2.0 header requires at least 20 bytes).`,
      };
    }

    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    const declaredLength = view.getUint32(8, true);

    // 0x46546C67 === 'glTF' in little-endian ASCII
    if (magic !== 0x46546c67) {
      return {
        valid: false,
        errorTitle: 'Invalid GLB Signature',
        errorDetail: `"${trimmedName}" does not begin with the binary glTF magic header (0x46546C67). Ensure the file is a genuine .glb binary export.`,
      };
    }

    if (version !== 2) {
      return {
        valid: false,
        errorTitle: `Unsupported glTF Version (v${version})`,
        errorDetail: `"${trimmedName}" uses glTF binary version ${version}. GLTFLoader with MeshoptDecoder requires glTF 2.0 (.glb).`,
      };
    }

    return {
      valid: true,
      version,
      declaredLength,
    };
  }

  return {
    valid: true,
  };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return '0';
  return Math.round(count).toLocaleString('en-US');
}
