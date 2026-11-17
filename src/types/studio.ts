import {publicAssetUrl} from '../utils/publicAssets';
import type { BoundingFitResult, CameraPreset } from '../utils/modelBounds';

export type ViewerStatus = 'idle' | 'loading' | 'ready' | 'error';

export type LightingPresetId = 'studio' | 'rosso' | 'technical';

export type LabelDensityMode = 'off' | 'minimal' | 'balanced' | 'detailed';

export interface LabelDensityOption {
  id: LabelDensityMode;
  label: string;
  desktopCap: number;
  mobileCap: number;
}

export const LABEL_DENSITY_OPTIONS: readonly LabelDensityOption[] = [
  { id: 'off', label: 'Off', desktopCap: 0, mobileCap: 0 },
  { id: 'minimal', label: 'Minimal', desktopCap: 5, mobileCap: 3 },
  { id: 'balanced', label: 'Balanced', desktopCap: 9, mobileCap: 4 },
  { id: 'detailed', label: 'Detailed', desktopCap: 14, mobileCap: 6 },
] as const;

export interface LightingPreset {
  id: LightingPresetId;
  label: string;
  bgHex: number;
  exposure: number;
  keyIntensity: number;
  keyColor: number;
  fillSkyColor: number;
  fillGroundColor: number;
  fillIntensity: number;
  rimColor: number;
  rimIntensity: number;
  crimsonRimIntensity: number;
  envIntensity: number;
  hasGrid: boolean;
}

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'studio',
    label: 'Studio',
    bgHex: 0x090b10,
    exposure: 0.9,
    keyIntensity: 1.42,
    keyColor: 0xf4f7ff,
    fillSkyColor: 0xc8d8f8,
    fillGroundColor: 0x10131c,
    fillIntensity: 0.5,
    rimColor: 0xdbe6ff,
    rimIntensity: 1.15,
    crimsonRimIntensity: 0.85,
    envIntensity: 0.78,
    hasGrid: false,
  },
  {
    id: 'rosso',
    label: 'Rosso',
    bgHex: 0x0c0709,
    exposure: 0.92,
    keyIntensity: 1.48,
    keyColor: 0xfff1e6,
    fillSkyColor: 0xf2cad0,
    fillGroundColor: 0x180b0f,
    fillIntensity: 0.46,
    rimColor: 0xffd6dc,
    rimIntensity: 1.05,
    crimsonRimIntensity: 1.38,
    envIntensity: 0.82,
    hasGrid: false,
  },
  {
    id: 'technical',
    label: 'Technical',
    bgHex: 0x070a10,
    exposure: 0.88,
    keyIntensity: 1.38,
    keyColor: 0xeef6ff,
    fillSkyColor: 0xbbe0ff,
    fillGroundColor: 0x0b1018,
    fillIntensity: 0.54,
    rimColor: 0xcce4ff,
    rimIntensity: 1.25,
    crimsonRimIntensity: 0.58,
    envIntensity: 0.74,
    hasGrid: true,
  },
];

export type PaintSwatchId =
  | 'original'
  | 'red'
  | 'yellow'
  | 'white'
  | 'black'
  | 'silver'
  | 'blue'
  | 'green'
  | 'custom';

export interface PaintSwatchSpec {
  id: PaintSwatchId;
  label: string;
  hex: string;
}

export const PAINT_SWATCHES: readonly PaintSwatchSpec[] = [
  { id: 'original', label: 'Original', hex: '#d41217' },
  { id: 'red', label: 'Red', hex: '#b30912' },
  { id: 'yellow', label: 'Yellow', hex: '#e5a400' },
  { id: 'white', label: 'White', hex: '#e8eaee' },
  { id: 'black', label: 'Black', hex: '#0b0c10' },
  { id: 'silver', label: 'Silver', hex: '#7c8490' },
  { id: 'blue', label: 'Blue', hex: '#0a2e78' },
  { id: 'green', label: 'Green', hex: '#093d26' },
  { id: 'custom', label: 'Custom colour', hex: '#d9460f' },
] as const;

export const EXTERIOR_PAINT_MATERIAL_SUFFIX = 'Rosso_Magma';

export interface LoadedModelTelemetry {
  fileName: string;
  fileSizeBytes: number;
  meshCount: number;
  materialCount: number;
  vertexCount: number;
  triangleCount: number;
  bounds: BoundingFitResult;
  loadedAtIso: string;
}

export interface StudioErrorState {
  title: string;
  detail: string;
  fileName?: string;
}

export type CameraPresetId = CameraPreset['id'];

export const DEFAULT_MODEL_URL = publicAssetUrl('models/daytona-sp3-web.glb');
export const DEFAULT_MODEL_FILENAME = 'daytona-sp3-web.glb';
export const DEFAULT_HDRI_URL = publicAssetUrl('environments/studio-small-09-2k.hdr');
export const DEFAULT_HDRI_FILENAME = 'studio-small-09-2k.hdr';

export const MODEL_CREDIT = {
  title: 'Ferrari Daytona SP3 2022 | www.vecarz.com',
  creator: 'vecarz',
  modelUrl:
    'https://sketchfab.com/3d-models/ferrari-daytona-sp3-2022-wwwvecarzcom-ce0844ab396143f69628188fc39fa8bf',
  creatorUrl: 'https://sketchfab.com/heynic',
  licenseLabel: 'Creative Commons Attribution 4.0 (CC BY 4.0)',
  licenseShort: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  modificationSummary:
    'Regrouped connected pieces into 19 presentation assemblies while retaining original triangle geometry, with Meshopt compression and geometry quantization for web delivery; extended in-app with an illustrative procedural mid-rear V12 & chassis reconstruction (not OEM CAD).',
} as const;

export const HDRI_CREDIT = {
  title: 'Studio Small 09 (2K HDRI)',
  creator: 'Poly Haven',
  assetUrl: 'https://polyhaven.com/a/studio_small_09',
  downloadUrl:
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_09_2k.hdr',
  localPath: DEFAULT_HDRI_URL,
  licenseLabel: 'CC0 1.0 Universal (Public Domain)',
  licenseUrl: 'https://polyhaven.com/license',
} as const;
