import type { CameraPresetId, LabelDensityMode, LightingPresetId, PaintSwatchId } from './studio';
import type { WheelDesignId } from '../utils/wheelDesigns';

export type ExperienceMode = 'showroom' | 'anatomy' | 'customise';
export type FinishId = 'original' | 'black' | 'tan' | 'red';
export type RoofFinish = 'original' | 'carbon' | 'body';
export type PartsCategory = 'all' | 'bodywork' | 'wheels' | 'chassis' | 'engine';
export interface StudioSettings {
  mode: ExperienceMode; paint: PaintSwatchId; customPaint: string; wheel: WheelDesignId;
  caliper: string; interior: FinishId; roof: RoofFinish; lighting: LightingPresetId;
  doors: boolean; frontLid: boolean; rearCover: boolean; frontLights: boolean; rearLights: boolean;
  rotate: boolean; speed: number; direction: 1 | -1; camera: CameraPresetId;
  labels: LabelDensityMode; structure: boolean; spread: number; ring: boolean; reducedMotion: boolean;
  tray: boolean; trayCategory: PartsCategory; trayPage: number;
  hidden: string[]; revealed:string[]; isolated: string | null; cockpit: boolean; tour: boolean;
  photo: boolean; lens: 35 | 50 | 85; engineLab: boolean;
}
export interface ExperienceSceneOptions {
  tray: boolean; trayItems: string[]; hidden: string[]; revealed?:string[]; isolated: string | null;
  cockpit: boolean; photo: boolean; lens: number; tour: boolean; active: boolean;
  caliper: string; interior: FinishId; roof: RoofFinish;
}
export interface PhotoOptions { width: number; height: number; backdrop: LightingPresetId; }
export interface StudioApi { capture: (options: PhotoOptions) => Promise<Blob>; }
export const DEFAULT_SETTINGS: StudioSettings = {
  mode:'showroom',paint:'original',customPaint:'#b30912',wheel:'factory',caliper:'original',interior:'original',roof:'original',lighting:'studio',
  doors:false,frontLid:false,rearCover:false,frontLights:false,rearLights:false,rotate:true,speed:0.5,direction:1,camera:'hero',
  labels:'minimal',structure:false,spread:2,ring:false,reducedMotion:false,tray:false,trayCategory:'all',trayPage:0,
  hidden:[],revealed:[],isolated:null,cockpit:false,tour:false,photo:false,lens:50,engineLab:false,
};

// Shared settings for the complete SP3 experience.
