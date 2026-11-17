import React, { useRef } from 'react';
import {
  Accessibility,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  DoorOpen,
  Grid,
  Layers,
  Lightbulb,
  Maximize2,
  Palette,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  Sun,
  Tag,
} from 'lucide-react';
import { CAMERA_PRESETS } from '../utils/modelBounds';
import { WHEEL_DESIGNS, type WheelDesignId } from '../utils/wheelDesigns';
import {
  LABEL_DENSITY_OPTIONS,
  LIGHTING_PRESETS,
  PAINT_SWATCHES,
  type CameraPresetId,
  type LabelDensityMode,
  type LightingPresetId,
  type PaintSwatchId,
} from '../types/studio';

export interface BottomControlDockProps {
  wheelDesign: WheelDesignId;
  onSelectWheelDesign: (design: WheelDesignId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  rotationSpeed: number;
  onRotationSpeedChange: (speed: number) => void;
  rotationDirection: 1 | -1;
  onToggleRotationDirection: () => void;
  explosionSpread: number;
  onExplosionSpreadChange: (spread: number) => void;
  activePaint: PaintSwatchId;
  customPaintHex: string;
  onSelectPaint: (swatch: PaintSwatchId) => void;
  onCustomPaintHexChange: (hex: string) => void;
  showLabels: boolean;
  onToggleShowLabels: () => void;
  labelDensity: LabelDensityMode;
  onSelectLabelDensity: (density: LabelDensityMode) => void;
  structureMode: boolean;
  onToggleStructureMode: () => void;
  frontLightsOn: boolean;
  onToggleFrontLights: () => void;
  rearLightsOn: boolean;
  onToggleRearLights: () => void;
  doorsOpen: boolean;
  onToggleDoors: () => void;
  frontLidOpen: boolean;
  onToggleFrontLid: () => void;
  rearCoverOpen: boolean;
  onToggleRearCover: () => void;
  onJumpToMechanicalChapter: () => void;
  scrollProgress: number;
  activeCameraPreset: CameraPresetId;
  onSelectCameraPreset: (preset: CameraPresetId) => void;
  onResetView: () => void;
  onRestart: () => void;
  lightingPreset: LightingPresetId;
  onSelectLightingPreset: (preset: LightingPresetId) => void;
  showFloorRing: boolean;
  onToggleFloorRing: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  wheelDesign,
  onSelectWheelDesign,
  collapsed,
  onToggleCollapsed,
  autoRotate,
  onToggleAutoRotate,
  rotationSpeed,
  onRotationSpeedChange,
  rotationDirection,
  onToggleRotationDirection,
  explosionSpread,
  onExplosionSpreadChange,
  activePaint,
  customPaintHex,
  onSelectPaint,
  onCustomPaintHexChange,
  showLabels,
  onToggleShowLabels,
  labelDensity,
  onSelectLabelDensity,
  structureMode,
  onToggleStructureMode,
  frontLightsOn,
  onToggleFrontLights,
  rearLightsOn,
  onToggleRearLights,
  doorsOpen,
  onToggleDoors,
  frontLidOpen,
  onToggleFrontLid,
  rearCoverOpen,
  onToggleRearCover,
  onJumpToMechanicalChapter,
  scrollProgress,
  activeCameraPreset,
  onSelectCameraPreset,
  onResetView,
  onRestart,
  lightingPreset,
  onSelectLightingPreset,
  showFloorRing,
  onToggleFloorRing,
  reducedMotion,
  onToggleReducedMotion,
}) => {
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveLabelDensity: LabelDensityMode = showLabels
    ? labelDensity
    : 'off';
  const inMechanicalChapter = scrollProgress >= 0.72;

  return (
    <div
      data-testid="bottom-control-dock"
      className="fixed bottom-1 left-2 right-2 z-20 flex flex-col items-center pointer-events-none editorial-dock-enter"
    >
      {/* Compact Collapse / Expand Drawer Handle */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="pointer-events-auto flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-medium text-zinc-300 hover:text-white bg-[#0d1016]/95 border border-b-0 border-white/10 rounded-t-md editorial-transition focus-visible:outline-2 focus-visible:outline-[#e11d2a] whitespace-nowrap shrink-0 cursor-pointer"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show Controls' : 'Hide Controls'}
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3 h-3 text-zinc-400" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {/* Ultra-Compact Editorial Paint, Openings, Lights & Inspection Dock */}
      {!collapsed && (
        <div
          role="toolbar"
          aria-label="3D Studio Controls"
          data-testid="bottom-control-toolbar"
          className="pointer-events-auto w-auto max-w-full bg-[#0d1016]/96 border border-white/12 rounded-xl shadow-2xl px-2 py-1 sm:px-2.5 sm:py-1.5 flex flex-col items-center gap-1"
        >
          {/* Tier 1: Exterior Paint Swatches, Studio/Rosso/Technical Backdrops, Spread Slider & Label Density */}
          <div className="w-full flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
            <label className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#080a0e] px-1.5 py-0.5 text-[10px] text-zinc-300">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v7.5m0 5V22M2.5 9l7 2m5 1.5 7 2M5 19l5.5-5m3-4L19 5"/></svg>
              Wheels
              <select aria-label="Wheel design" data-testid="wheel-design-selector" value={wheelDesign}
                onChange={event=>onSelectWheelDesign(event.target.value as WheelDesignId)}
                className="max-w-[112px] cursor-pointer rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-white outline-none focus-visible:ring-1 focus-visible:ring-red-500">
                {WHEEL_DESIGNS.map(design=><option key={design.id} value={design.id}>{design.label}</option>)}
              </select>
            </label>
            {/* Exterior Paint Swatches (Rosso_Magma only) */}
            <div
              role="group"
              aria-label="Exterior Paint Swatches (Rosso_Magma)"
              data-testid="paint-swatch-group"
              className="flex flex-wrap items-center justify-center gap-1 bg-[#080a0e] border border-white/8 rounded-lg px-1.5 py-0.5"
            >
              <Palette className="w-3 h-3 text-zinc-400 mr-0.5 shrink-0" />
              {PAINT_SWATCHES.map((swatch) => {
                const isSelected = activePaint === swatch.id;
                const displayHex =
                  swatch.id === 'custom' ? customPaintHex : swatch.hex;

                if (swatch.id === 'custom') {
                  return (
                    <div
                      key={swatch.id}
                      className="inline-flex items-center gap-0.5"
                    >
                      <button
                        type="button"
                        data-testid="paint-swatch-custom"
                        data-paint-id="custom"
                        aria-label="Paint: Custom colour"
                        aria-pressed={isSelected}
                        onClick={() => {
                          onSelectPaint('custom');
                          colorInputRef.current?.click();
                        }}
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded editorial-swatch-btn cursor-pointer whitespace-nowrap border ${
                          isSelected
                            ? 'bg-[#1e2330] text-white border-white/50 ring-1 ring-[#e11d2a]'
                            : 'bg-[#12151d] text-zinc-300 border-white/10 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                          style={{ backgroundColor: displayHex }}
                        />
                        <span>Custom</span>
                      </button>
                      <input
                        ref={colorInputRef}
                        type="color"
                        data-testid="custom-paint-input"
                        aria-label="Custom paint hex colour"
                        value={customPaintHex}
                        onChange={(e) => {
                          onCustomPaintHexChange(e.target.value);
                          onSelectPaint('custom');
                        }}
                        className="sr-only"
                      />
                    </div>
                  );
                }

                if (swatch.id === 'original') {
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      data-testid="paint-swatch-original"
                      data-paint-id="original"
                      aria-label="Paint: Original"
                      aria-pressed={isSelected}
                      onClick={() => onSelectPaint('original')}
                      className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded editorial-swatch-btn cursor-pointer whitespace-nowrap border ${
                        isSelected
                          ? 'bg-[#1e2330] text-white border-white/50 ring-1 ring-[#e11d2a]'
                          : 'bg-[#12151d] text-zinc-300 border-white/10 hover:text-white'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: displayHex }}
                      />
                      <span>Original</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={swatch.id}
                    type="button"
                    data-testid={`paint-swatch-${swatch.id}`}
                    data-paint-id={swatch.id}
                    aria-label={`Paint: ${swatch.label}`}
                    aria-pressed={isSelected}
                    title={`${swatch.label} (Rosso_Magma)`}
                    onClick={() => onSelectPaint(swatch.id)}
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center editorial-swatch-btn cursor-pointer border ${
                      isSelected
                        ? 'scale-110 border-white ring-2 ring-[#e11d2a]'
                        : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: displayHex }}
                  />
                );
              })}
            </div>

            {/* Backdrop Preset Switcher: Studio / Rosso / Technical */}
            <div
              role="group"
              aria-label="Backdrop Environment Presets"
              data-testid="backdrop-preset-group"
              className="flex items-center gap-0.5 p-0.5 bg-[#080a0e] border border-white/8 rounded-lg"
            >
              <Sun className="w-3 h-3 text-zinc-400 ml-1 mr-0.5 shrink-0" />
              {LIGHTING_PRESETS.map((preset) => {
                const active = lightingPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`backdrop-preset-${preset.id}`}
                    aria-pressed={active}
                    onClick={() => onSelectLightingPreset(preset.id)}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#1f2432] text-white border border-white/20 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Explosion Spread Slider (1x–3x, default 2x) */}
            <div className="flex items-center gap-1 bg-[#080a0e] border border-white/8 rounded-lg px-1.5 py-0.5">
              <Maximize2 className="w-3 h-3 text-zinc-400 shrink-0" />
              <label
                htmlFor="explosion-spread-slider"
                className="text-[10px] text-zinc-300 whitespace-nowrap"
              >
                Spread
              </label>
              <input
                id="explosion-spread-slider"
                data-testid="explosion-spread-slider"
                type="range"
                min={1.0}
                max={3.0}
                step={0.1}
                value={explosionSpread}
                onChange={(e) =>
                  onExplosionSpreadChange(parseFloat(e.target.value))
                }
                className="studio-slider w-11 sm:w-12"
                aria-label="Explosion spread"
              />
              <span
                data-testid="explosion-spread-value"
                className="text-[10px] font-mono-tabular text-white w-6 text-right shrink-0"
              >
                {explosionSpread.toFixed(1)}x
              </span>
            </div>

            {/* Label Density & Toggle Group */}
            <div
              role="group"
              aria-label="On-Model Label Density"
              data-testid="label-density-group"
              className="flex items-center gap-0.5 p-0.5 bg-[#080a0e] border border-white/8 rounded-lg"
            >
              <button
                type="button"
                data-testid="toggle-labels-btn"
                onClick={onToggleShowLabels}
                aria-pressed={showLabels && labelDensity !== 'off'}
                title="Toggle On-Model Labels"
                className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded cursor-pointer editorial-transition ${
                  showLabels && labelDensity !== 'off'
                    ? 'text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Tag className="w-3 h-3 text-[#ff4d58] shrink-0" />
                <span className="hidden sm:inline">Labels:</span>
              </button>
              {LABEL_DENSITY_OPTIONS.map((opt) => {
                const active = effectiveLabelDensity === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`label-density-${opt.id}`}
                    aria-pressed={active}
                    onClick={() => onSelectLabelDensity(opt.id)}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#1f2432] text-white border border-white/20'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier 2: Independent Doors/Lids Openings, Front/Rear Lights, Structure & Mechanical Chapter */}
          <div className="w-full flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 pt-0.5 border-t border-white/8">
            {/* Independent Body Openings: Butterfly Doors, Front Luggage Lid, Rear Engine Cover */}
            <div
              role="group"
              aria-label="Body Panel Openings"
              data-testid="openings-control-group"
              className="flex flex-wrap items-center justify-center gap-1 bg-[#080a0e] border border-white/8 rounded-lg px-1.5 py-0.5"
            >
              <DoorOpen className="w-3 h-3 text-zinc-400 shrink-0" />
              <button
                type="button"
                data-testid="toggle-doors-btn"
                aria-pressed={doorsOpen}
                onClick={onToggleDoors}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer border ${
                  doorsOpen
                    ? 'bg-[#e11d2a] text-white border-white/35'
                    : 'bg-[#12151d] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                Doors
              </button>
              <button
                type="button"
                data-testid="toggle-front-lid-btn"
                aria-pressed={frontLidOpen}
                onClick={onToggleFrontLid}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer border ${
                  frontLidOpen
                    ? 'bg-[#e11d2a] text-white border-white/35'
                    : 'bg-[#12151d] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                Front Lid
              </button>
              <button
                type="button"
                data-testid="toggle-rear-cover-btn"
                aria-pressed={rearCoverOpen}
                onClick={onToggleRearCover}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer border ${
                  rearCoverOpen
                    ? 'bg-[#e11d2a] text-white border-white/35'
                    : 'bg-[#12151d] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                Engine Cover
              </button>
            </div>

            {/* Independent Front Lights & Rear Lights Toggles */}
            <div
              role="group"
              aria-label="Vehicle Lighting Toggles"
              data-testid="lights-control-group"
              className="flex items-center gap-1 bg-[#080a0e] border border-white/8 rounded-lg px-1.5 py-0.5"
            >
              <Lightbulb className="w-3 h-3 text-amber-300 shrink-0" />
              <button
                type="button"
                data-testid="toggle-front-lights-btn"
                aria-pressed={frontLightsOn}
                onClick={onToggleFrontLights}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer border ${
                  frontLightsOn
                    ? 'bg-sky-500/25 text-sky-100 border-sky-300/60 shadow-sm'
                    : 'bg-[#12151d] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                Front Lights
              </button>
              <button
                type="button"
                data-testid="toggle-rear-lights-btn"
                aria-pressed={rearLightsOn}
                onClick={onToggleRearLights}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer border ${
                  rearLightsOn
                    ? 'bg-[#e11d2a]/35 text-red-100 border-[#ff4d58]/70 shadow-sm'
                    : 'bg-[#12151d] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                Rear Lights
              </button>
            </div>

            {/* Structure Mode & Direct Chapter 07 Chassis & Powertrain Button */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="toggle-structure-btn"
                onClick={onToggleStructureMode}
                aria-pressed={structureMode}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-lg border editorial-transition whitespace-nowrap cursor-pointer ${
                  structureMode
                    ? 'bg-[#e11d2a] text-white border-white/35'
                    : 'bg-[#080a0e] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Structure</span>
              </button>

              <button
                type="button"
                data-testid="dock-chassis-chapter-btn"
                onClick={onJumpToMechanicalChapter}
                aria-pressed={inMechanicalChapter}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-lg border editorial-transition whitespace-nowrap cursor-pointer ${
                  inMechanicalChapter
                    ? 'bg-amber-500 text-black border-amber-200'
                    : 'bg-[#19150e] text-amber-200 border-amber-400/40 hover:bg-[#241e14]'
                }`}
              >
                <Cpu className="w-3 h-3" />
                <span>07 Chassis &amp; V12</span>
              </button>
            </div>

            {/* Turntable, Camera Angles, Reset & Reduced Motion */}
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                type="button"
                data-testid="restart-sequence-btn"
                onClick={onRestart}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-white bg-[#e11d2a] hover:bg-[#c81924] rounded-md editorial-transition whitespace-nowrap cursor-pointer"
              >
                <SkipBack className="w-3 h-3" />
                <span>Restart</span>
              </button>

              <button
                type="button"
                onClick={onToggleAutoRotate}
                className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md border editorial-transition whitespace-nowrap cursor-pointer ${
                  autoRotate
                    ? 'bg-[#1f2432] text-white border-white/20 hover:bg-[#282e3f]'
                    : 'bg-[#080a0e] text-zinc-300 border-white/10 hover:bg-[#141822]'
                }`}
                aria-pressed={autoRotate}
              >
                {autoRotate ? (
                  <>
                    <Pause className="w-3 h-3 text-[#ff4d58]" />
                    <span>Pause Orbit</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-zinc-300" />
                    <span>Auto-Rotate</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onToggleRotationDirection}
                className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 hover:text-white bg-[#080a0e] hover:bg-[#141822] border border-white/10 rounded-md editorial-transition whitespace-nowrap cursor-pointer"
                aria-label={`Rotation Direction: ${rotationDirection === 1 ? 'Clockwise' : 'Counter-Clockwise'}`}
                title="Reverse Auto-Rotation Direction"
              >
                <ArrowLeftRight className="w-3 h-3 text-zinc-400" />
                <span className="font-mono-tabular">
                  {rotationDirection === 1 ? 'CW' : 'CCW'}
                </span>
              </button>

              <div className="hidden 2xl:flex items-center gap-1 bg-[#080a0e] border border-white/8 rounded-md px-1.5 py-0.5">
                <label
                  htmlFor="rotation-speed-slider"
                  className="text-[10px] text-zinc-400 whitespace-nowrap"
                >
                  Orbit
                </label>
                <input
                  id="rotation-speed-slider"
                  type="range"
                  min={0.1}
                  max={2.5}
                  step={0.1}
                  value={rotationSpeed}
                  onChange={(e) =>
                    onRotationSpeedChange(parseFloat(e.target.value))
                  }
                  className="studio-slider w-10"
                  aria-label="Rotation speed"
                />
                <span className="text-[10px] font-mono-tabular text-zinc-200 w-6 text-right">
                  {rotationSpeed.toFixed(1)}x
                </span>
              </div>

              <div
                className="flex flex-wrap items-center justify-center gap-0.5 p-0.5 bg-[#080a0e] border border-white/8 rounded-md"
                role="group"
                aria-label="Camera View Angles"
              >
                {CAMERA_PRESETS.map((preset) => {
                  const active = activeCameraPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectCameraPreset(preset.id)}
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded editorial-transition whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#1f2432] text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onResetView}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-zinc-100 hover:text-white bg-[#171b24] hover:bg-[#222836] border border-white/10 rounded-md editorial-transition whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-zinc-300" />
                <span>Reset View</span>
              </button>

              <button
                type="button"
                onClick={onToggleFloorRing}
                className={`p-1 text-[10px] font-medium rounded-md border editorial-transition cursor-pointer ${
                  showFloorRing
                    ? 'bg-[#1f2432] text-white border-white/15'
                    : 'bg-[#080a0e] text-zinc-400 border-white/8 hover:text-zinc-200'
                }`}
                aria-pressed={showFloorRing}
                aria-label="Toggle Studio Calibration Ring"
                title="Toggle Studio Calibration Ring"
              >
                <Grid className="w-3 h-3" />
              </button>

              <button
                type="button"
                data-testid="reduced-motion-toggle"
                onClick={onToggleReducedMotion}
                className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md border editorial-transition whitespace-nowrap cursor-pointer ${
                  reducedMotion
                    ? 'bg-[#1f2432] text-white border-white/25'
                    : 'bg-[#080a0e] text-zinc-300 border-white/10 hover:text-zinc-200'
                }`}
                aria-pressed={reducedMotion}
              >
                <Accessibility className="w-3 h-3 text-zinc-400" />
                <span>Reduced Motion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
