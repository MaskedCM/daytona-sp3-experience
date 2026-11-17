import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ArrowLeft } from 'lucide-react';
import type {ExperienceSceneOptions,StudioApi} from '../types/experience';
import {applyExperienceLayout,prepareFinishMaterials,fitVisibleScene,captureScenePhoto} from '../utils/experienceScene';
import {CAMERA_PRESETS} from '../utils/modelBounds';
import { setupWheelDesigns, type WheelDesignId, type WheelDesignController } from '../utils/wheelDesigns';
import {
  computeCenterAndFit,
  computePresetCameraPosition,
  type BoundingFitResult,
  type Vec3Like,
} from '../utils/modelBounds';
import {
  applyExteriorPaintColor,
  applyInspectionDimming,
  applyPresentationExplosion,
  applyStructureModeVisibility,
  captureModelMaterials,
  capturePresentationGroupBindings,
  computeExpandedCameraFraming,
  computeGroupInspectionFraming,
  computeGroupProgress,
  computeScreenLabelLayout,
  getComponentSpec,
  isIllustrativeMechanicalSpec,
  smoothStep01,
  type CapturedGroupBinding,
  type MaterialRecord,
  type PositionedScreenLabel,
  type ScreenLabelCandidate,
} from '../utils/explosionGroups';
import {
  applyMechanicalLayerExplosion,
  buildIllustrativeMechanicalLayer,
  computeMechanicalGroupProgress,
  type CapturedMechanicalBinding,
} from '../utils/illustrativeMechanicalLayer';
import {
  applyHingedPanelTransforms,
  setupPanelsAndSpatialLights,
  type HingedPanelBinding,
  type OpeningProgress,
  type SpatialLightController,
} from '../utils/lightsAndOpenings';
import {
  DEFAULT_HDRI_URL,
  DEFAULT_MODEL_FILENAME,
  DEFAULT_MODEL_URL,
  LIGHTING_PRESETS,
  PAINT_SWATCHES,
  type CameraPresetId,
  type LabelDensityMode,
  type LightingPresetId,
  type LoadedModelTelemetry,
  type PaintSwatchId,
  type StudioErrorState,
  type ViewerStatus,
} from '../types/studio';

export interface StudioCanvasProps {
  experience: ExperienceSceneOptions;
  onApiReady: (api:StudioApi|null)=>void;
  wheelDesign: WheelDesignId;
  modelUrl?: string;
  retryCount?: number;
  scrollProgress: number;
  explosionSpread: number;
  activePaint: PaintSwatchId;
  customPaintHex: string;
  showLabels: boolean;
  labelDensity: LabelDensityMode;
  structureMode: boolean;
  frontLightsOn: boolean;
  rearLightsOn: boolean;
  doorsOpen: boolean;
  frontLidOpen: boolean;
  rearCoverOpen: boolean;
  selectedGroup: string | null;
  onSelectGroup: (nodeName: string | null) => void;
  onBackToCar?: () => void;
  reducedMotion: boolean;
  autoRotate: boolean;
  rotationSpeed: number;
  rotationDirection: 1 | -1;
  lightingPreset: LightingPresetId;
  activeCameraPreset: CameraPresetId;
  resetTrigger: number;
  showFloorRing: boolean;
  onStatusChange: (status: ViewerStatus) => void;
  onProgressChange: (progressPct: number, stageLabel: string) => void;
  onModelLoaded: (telemetry: LoadedModelTelemetry) => void;
  onError: (err: StudioErrorState) => void;
  onUserOrbitStart?: () => void;
}

// Pre-allocated scratch vectors outside render loop (zero GC in tick)
const _scratchVec3 = new THREE.Vector3();
const _projScratch = new THREE.Vector3();
const _highlightBoxScratch = new THREE.Box3();
const _groupLiveBoxScratch = new THREE.Box3();
const _cornerScratch = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createRadialContactShadowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, half * 0.04, half, half, half * 0.98);
    grad.addColorStop(0.0, 'rgba(3, 4, 7, 0.56)');
    grad.addColorStop(0.32, 'rgba(5, 6, 10, 0.36)');
    grad.addColorStop(0.64, 'rgba(8, 10, 15, 0.14)');
    grad.addColorStop(0.86, 'rgba(10, 12, 18, 0.04)');
    grad.addColorStop(1.0, 'rgba(12, 14, 20, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function disposeObjectHierarchy(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const mat of materials) {
        const physMat = mat as THREE.MeshPhysicalMaterial;
        const texProps = [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'aoMap',
          'emissiveMap',
          'alphaMap',
          'clearcoatMap',
          'clearcoatNormalMap',
          'clearcoatRoughnessMap',
          'transmissionMap',
          'thicknessMap',
        ] as const;
        for (const prop of texProps) {
          const tex = physMat[prop];
          if (tex && typeof tex.dispose === 'function') {
            tex.dispose();
          }
        }
        if (mat.userData?.__cachedDimmedClone_18) {
          (mat.userData.__cachedDimmedClone_18 as THREE.Material).dispose();
        }
        if (mat.userData?.__cachedDimmedClone_24) {
          (mat.userData.__cachedDimmedClone_24 as THREE.Material).dispose();
        }
        mat.dispose();
      }
    }
  });
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  experience,
  onApiReady,
  wheelDesign,
  modelUrl = DEFAULT_MODEL_URL,
  retryCount = 0,
  scrollProgress,
  explosionSpread,
  activePaint,
  customPaintHex,
  showLabels,
  labelDensity,
  structureMode,
  frontLightsOn,
  rearLightsOn,
  doorsOpen,
  frontLidOpen,
  rearCoverOpen,
  selectedGroup,
  onSelectGroup,
  onBackToCar,
  reducedMotion,
  autoRotate,
  rotationSpeed,
  rotationDirection,
  lightingPreset,
  activeCameraPreset,
  resetTrigger,
  showFloorRing,
  onStatusChange,
  onProgressChange,
  onModelLoaded,
  onError,
  onUserOrbitStart,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [placedLabels, setPlacedLabels] = useState<PositionedScreenLabel[]>([]);
  const lastLabelSignatureRef = useRef<string>('');
  const experienceRef=useRef(experience);experienceRef.current=experience;
  const apiRef=useRef(onApiReady);apiRef.current=onApiReady;
  const finishRef=useRef<ReturnType<typeof prepareFinishMaterials>|null>(null);
  const reframeRef=useRef<()=>void>(()=>{});

  const selectedSpec = getComponentSpec(selectedGroup);
  const selectedIsMechanical = isIllustrativeMechanicalSpec(selectedSpec);

  // Store latest callbacks in refs so React renders never re-mount WebGL
  const callbacksRef = useRef({
    onStatusChange,
    onProgressChange,
    onModelLoaded,
    onError,
    onUserOrbitStart,
  });
  callbacksRef.current = {
    onStatusChange,
    onProgressChange,
    onModelLoaded,
    onError,
    onUserOrbitStart,
  };

  // Mutable scene state refs
  const sceneHandlesRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.HemisphereLight;
    rimLight: THREE.DirectionalLight;
    crimsonRimLight: THREE.DirectionalLight;
    sideLight: THREE.DirectionalLight;
    stageGroup: THREE.Group;
    shadowReceiverPlane: THREE.Mesh;
    contactShadowDisc: THREE.Mesh;
    turntableRingGroup: THREE.Group;
    modelHolder: THREE.Group;
    selectionBoxHelper: THREE.Box3Helper;
    loadedModelRoot: THREE.Object3D | null;
    wheelController: WheelDesignController | null;
    mechanicalLayerRoot: THREE.Group | null;
    groupBindings: CapturedGroupBinding[];
    mechanicalBindings: CapturedMechanicalBinding[];
    hingedPanels: HingedPanelBinding[];
    lightController: SpatialLightController | null;
    openingProgress: OpeningProgress;
    materialRecords: MaterialRecord[];
    rawModelBounds: { min: Vec3Like; max: Vec3Like } | null;
    currentFit: BoundingFitResult;
    cameraGoalPos: THREE.Vector3 | null;
    cameraGoalTarget: THREE.Vector3 | null;
    savedPreInspectCamera: {
      pos: THREE.Vector3;
      target: THREE.Vector3;
      scrollProgress: number;
    } | null;
    isSoftwareGl: boolean;
    wakeLoop: () => void;
    applyEnvIntensity: (intensity: number) => void;
    updateProjectedLabelsAndHighlight: () => void;
    setStageAttr: (name: string, value: string) => void;
  } | null>(null);

  const propsStateRef = useRef({
    wheelDesign,
    scrollProgress,
    explosionSpread,
    activePaint,
    customPaintHex,
    showLabels,
    labelDensity,
    structureMode,
    frontLightsOn,
    rearLightsOn,
    doorsOpen,
    frontLidOpen,
    rearCoverOpen,
    selectedGroup,
    reducedMotion,
    autoRotate,
    rotationSpeed,
    rotationDirection,
    lightingPreset,
    activeCameraPreset,
    showFloorRing,
  });
  propsStateRef.current = {
    wheelDesign,
    scrollProgress,
    explosionSpread,
    activePaint,
    customPaintHex,
    showLabels,
    labelDensity,
    structureMode,
    frontLightsOn,
    rearLightsOn,
    doorsOpen,
    frontLidOpen,
    rearCoverOpen,
    selectedGroup,
    reducedMotion,
    autoRotate,
    rotationSpeed,
    rotationDirection,
    lightingPreset,
    activeCameraPreset,
    showFloorRing,
  };

  // 1. Mount WebGLRenderer & Studio Scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    const isSoftwareGl = detectSoftwareGl();
    const rect = container.getBoundingClientRect();
    const width = Math.max(
      1,
      Math.round(rect.width || container.clientWidth || window.innerWidth),
    );
    const height = Math.max(
      1,
      Math.round(rect.height || container.clientHeight || window.innerHeight),
    );
    const aspect = width / Math.max(1, height);

    THREE.ColorManagement.enabled = true;
    const maxDpr = width < 768 ? 1.5 : 2;
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const initialPreset = LIGHTING_PRESETS[0];
    renderer.toneMappingExposure = initialPreset.exposure;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr),
    );
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className =
      'block w-full h-full outline-none cursor-grab active:cursor-grabbing';
    renderer.domElement.setAttribute('data-testid', 'studio-webgl-canvas');
    renderer.domElement.setAttribute(
      'aria-label',
      'Ferrari Daytona SP3 3D Studio Viewport',
    );

    const setStageAttr = (name: string, value: string) => {
      renderer.domElement.setAttribute(name, value);
      wrapperRef.current?.setAttribute(name, value);
    };

    setStageAttr('data-canvas-width', String(width));
    setStageAttr('data-canvas-height', String(height));
    setStageAttr('data-backdrop-preset', initialPreset.id);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = null;

    // Fallback studio environment (RoomEnvironment) active immediately, then upgraded to Poly Haven Studio Small 09 2K HDRI
    const fallbackPmrem = new THREE.PMREMGenerator(renderer);
    fallbackPmrem.compileEquirectangularShader();
    let currentEnvTarget = fallbackPmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = currentEnvTarget.texture;
    fallbackPmrem.dispose();
    setStageAttr('data-env-source', 'fallback-room');
    setStageAttr('data-hdri-loaded', 'loading');

    const hdrLoader = new HDRLoader();
    hdrLoader.load(
      DEFAULT_HDRI_URL,
      (hdrTexture) => {
        if (disposed) {
          hdrTexture.dispose();
          return;
        }
        try {
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          const hdrPmrem = new THREE.PMREMGenerator(renderer);
          hdrPmrem.compileEquirectangularShader();
          const hdrTarget = hdrPmrem.fromEquirectangular(hdrTexture);
          hdrTexture.dispose();
          hdrPmrem.dispose();

          const prevTarget = currentEnvTarget;
          currentEnvTarget = hdrTarget;
          scene.environment = hdrTarget.texture;
          scene.background = null;
          prevTarget?.dispose();

          setStageAttr('data-env-source', 'studio-small-09-2k.hdr');
          setStageAttr('data-hdri-loaded', 'true');
          sceneHandlesRef.current?.wakeLoop();
        } catch {
          hdrTexture.dispose();
          setStageAttr('data-env-source', 'fallback-room');
          setStageAttr('data-hdri-loaded', 'fallback');
        }
      },
      undefined,
      () => {
        if (disposed) return;
        setStageAttr('data-env-source', 'fallback-room');
        setStageAttr('data-hdri-loaded', 'fallback');
      },
    );

    const defaultFit = computeCenterAndFit(
      { x: -1.025, y: -0.57, z: -2.34 },
      { x: 1.025, y: 0.57, z: 2.34 },
      40,
      aspect,
      1.25,
    );

    const camera = new THREE.PerspectiveCamera(
      40,
      aspect,
      defaultFit.near,
      defaultFit.far,
    );
    camera.position.set(
      defaultFit.homeCameraPosition.x,
      defaultFit.homeCameraPosition.y,
      defaultFit.homeCameraPosition.z,
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.75;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minPolarAngle = 0.04;
    controls.minDistance = defaultFit.minDistance;
    controls.maxDistance = defaultFit.maxDistance;
    controls.target.set(
      defaultFit.orbitTarget.x,
      defaultFit.orbitTarget.y,
      defaultFit.orbitTarget.z,
    );
    controls.autoRotate =
      propsStateRef.current.autoRotate &&
      !propsStateRef.current.reducedMotion &&
      propsStateRef.current.scrollProgress <= 0.01 &&
      !propsStateRef.current.selectedGroup;
    controls.autoRotateSpeed =
      propsStateRef.current.rotationSpeed * propsStateRef.current.rotationDirection;
    controls.update();

    const fillLight = new THREE.HemisphereLight(
      initialPreset.fillSkyColor,
      initialPreset.fillGroundColor,
      initialPreset.fillIntensity,
    );
    fillLight.position.set(0, 12, 0);
    scene.add(fillLight);

    const keyLight = new THREE.DirectionalLight(
      initialPreset.keyColor,
      initialPreset.keyIntensity,
    );
    keyLight.position.set(5.5, 9.5, 6.5);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      keyLight.shadow.radius = 3;
      const d = defaultFit.maxDim * 0.9;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 35;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
      initialPreset.rimColor,
      initialPreset.rimIntensity,
    );
    rimLight.position.set(-6, 5.5, -7);
    scene.add(rimLight);

    const crimsonRimLight = new THREE.DirectionalLight(
      0xe11d2a,
      initialPreset.crimsonRimIntensity,
    );
    crimsonRimLight.position.set(-5.2, 2.1, -6.8);
    scene.add(crimsonRimLight);

    const sideLight = new THREE.DirectionalLight(0xd8e4ff, 0.52);
    sideLight.position.set(-7, 3.2, 5);
    scene.add(sideLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const topSoftbox = new THREE.RectAreaLight(0xf6f9ff, 1.55, 6.8, 2.4);
      topSoftbox.position.set(0, 4.6, 0.2);
      topSoftbox.lookAt(0, 0, 0);
      scene.add(topSoftbox);

      const leftBeltSoftbox = new THREE.RectAreaLight(0xe2ecff, 0.85, 5.2, 1.1);
      leftBeltSoftbox.position.set(-4.2, 1.6, 0.4);
      leftBeltSoftbox.lookAt(0, 0.3, 0);
      scene.add(leftBeltSoftbox);

      const rightCrimsonStrip = new THREE.RectAreaLight(0xe11d2a, 0.55, 4.2, 0.8);
      rightCrimsonStrip.position.set(4.0, 1.2, -2.2);
      rightCrimsonStrip.lookAt(0, 0.2, -0.5);
      scene.add(rightCrimsonStrip);
    }

    const stageGroup = new THREE.Group();
    stageGroup.position.y = defaultFit.floorY;
    scene.add(stageGroup);

    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const floorCtx = floorCanvas.getContext('2d');
    if (floorCtx) {
      const g = floorCtx.createRadialGradient(256, 256, 8, 256, 256, 248);
      g.addColorStop(0.0, 'rgba(14, 17, 24, 0.56)');
      g.addColorStop(0.38, 'rgba(11, 13, 19, 0.34)');
      g.addColorStop(0.72, 'rgba(9, 10, 15, 0.10)');
      g.addColorStop(1.0, 'rgba(8, 9, 13, 0.0)');
      floorCtx.fillStyle = g;
      floorCtx.fillRect(0, 0, 512, 512);
    }
    const floorAlphaTex = new THREE.CanvasTexture(floorCanvas);
    floorAlphaTex.colorSpace = THREE.SRGBColorSpace;
    floorAlphaTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.PlaneGeometry(defaultFit.maxDim * 5.0, defaultFit.maxDim * 5.0);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorAlphaTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.92,
      metalness: 0.04,
      envMapIntensity: 0.15,
      fog: false,
    });
    const shadowReceiverPlane = new THREE.Mesh(floorGeo, floorMat);
    shadowReceiverPlane.receiveShadow = !isSoftwareGl;
    stageGroup.add(shadowReceiverPlane);

    const contactShadowTex = createRadialContactShadowTexture(
      renderer.capabilities.getMaxAnisotropy(),
    );
    const contactGeo = new THREE.PlaneGeometry(defaultFit.maxDim * 1.48, defaultFit.maxDim * 0.82);
    contactGeo.rotateX(-Math.PI / 2);
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadowDisc = new THREE.Mesh(contactGeo, contactMat);
    contactShadowDisc.position.y = 0.003;
    stageGroup.add(contactShadowDisc);

    const turntableRingGroup = new THREE.Group();
    turntableRingGroup.position.y = 0.006;

    const outerRadius = defaultFit.maxDim * 0.68;
    const innerRadius = outerRadius * 0.992;
    const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mainRing = new THREE.Mesh(ringGeo, ringMat);
    turntableRingGroup.add(mainRing);

    const innerAccentGeo = new THREE.RingGeometry(
      outerRadius * 0.76,
      outerRadius * 0.763,
      96,
    );
    innerAccentGeo.rotateX(-Math.PI / 2);
    const innerAccentMat = new THREE.MeshBasicMaterial({
      color: 0xe11d2a,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const innerRing = new THREE.Mesh(innerAccentGeo, innerAccentMat);
    turntableRingGroup.add(innerRing);

    stageGroup.add(turntableRingGroup);

    const modelHolder = new THREE.Group();
    scene.add(modelHolder);

    const selectionBoxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xe11d2a);
    selectionBoxHelper.visible = false;
    scene.add(selectionBoxHelper);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let isLoopActive = false;
    let needsSingleRender = true;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function applyEnvIntensity(intensity: number) {
      const handles = sceneHandlesRef.current;
      if (!handles) return;
      for (const rec of handles.materialRecords) {
        if (rec.material.name.includes('Windows') || rec.material.name.includes('Glass')) {
          rec.material.envMapIntensity = Math.min(0.65, intensity * 0.82);
        } else {
          rec.material.envMapIntensity = intensity;
        }
      }
    }

    function updateProjectedLabelsAndHighlight() {
      const handles = sceneHandlesRef.current;
      if (!handles || handles.groupBindings.length === 0) return;

      const {
        showLabels: curShowLabels,
        labelDensity: curLabelDensity,
        structureMode: curStructure,
        rearCoverOpen: curRearCoverOpen,
        selectedGroup: curSelected,
        scrollProgress: curProgress,
        explosionSpread: curSpread,
      } = propsStateRef.current;

      const p = Math.max(0, Math.min(1, curProgress));
      const clampedSpread = Math.max(1, Math.min(3, curSpread));
      const explosionScaleRatio = handles.currentFit.maxDim / 12.25;
      const deepChapterBoost =
        p > 0.72 ? 1 + 0.22 * smoothStep01((p - 0.72) / 0.28) : 1;

      const canvasW =
        container?.clientWidth ||
        handles.renderer.domElement.clientWidth ||
        window.innerWidth;
      const canvasH =
        container?.clientHeight ||
        handles.renderer.domElement.clientHeight ||
        window.innerHeight;

      handles.camera.updateMatrixWorld();
      handles.camera.matrixWorldInverse.copy(handles.camera.matrixWorld).invert();

      // 1. Update 3D selection highlight box helper (supports both GLB presentation groups & mechanical groups)
      const selectedGlbBinding = curSelected
        ? handles.groupBindings.find((b) => b.spec.nodeName === curSelected)
        : undefined;
      const selectedMechBinding = curSelected
        ? handles.mechanicalBindings.find((b) => b.spec.nodeName === curSelected)
        : undefined;
      const activeSelectedBinding = selectedGlbBinding ?? selectedMechBinding;

      if (activeSelectedBinding && activeSelectedBinding.object.visible) {
        activeSelectedBinding.object.updateWorldMatrix(true, true);
        _highlightBoxScratch.setFromObject(activeSelectedBinding.object);
        if (!_highlightBoxScratch.isEmpty()) {
          handles.selectionBoxHelper.box.copy(_highlightBoxScratch);
          handles.selectionBoxHelper.visible = true;
        } else {
          handles.selectionBoxHelper.visible = false;
        }
      } else {
        handles.selectionBoxHelper.visible = false;
      }

      // 2. Compute projected 2D screen bounds of the visible car/assemblies to verify ~80% width & unclipped framing
      let minScreenX = Infinity;
      let maxScreenX = -Infinity;
      let minScreenY = Infinity;
      let maxScreenY = -Infinity;

      const candidates: ScreenLabelCandidate[] = [];

      for (const b of handles.groupBindings) {
        if (!b.object.visible) continue;
        const { localProgress, state } = computeGroupProgress(b.spec, p);
        const effScale =
          explosionScaleRatio * clampedSpread * localProgress * deepChapterBoost;

        const offsetX = b.spec.worldOffset.x * effScale;
        const offsetY = b.spec.worldOffset.y * effScale;
        const offsetZ = b.spec.worldOffset.z * effScale;

        if (!b.origWorldBox.isEmpty()) {
          _groupLiveBoxScratch.copy(b.origWorldBox);
          _groupLiveBoxScratch.min.x += offsetX;
          _groupLiveBoxScratch.min.y += offsetY;
          _groupLiveBoxScratch.min.z += offsetZ;
          _groupLiveBoxScratch.max.x += offsetX;
          _groupLiveBoxScratch.max.y += offsetY;
          _groupLiveBoxScratch.max.z += offsetZ;

          const bMin = _groupLiveBoxScratch.min;
          const bMax = _groupLiveBoxScratch.max;
          for (let ix = 0; ix < 2; ix++) {
            for (let iy = 0; iy < 2; iy++) {
              for (let iz = 0; iz < 2; iz++) {
                _cornerScratch.set(
                  ix === 0 ? bMin.x : bMax.x,
                  iy === 0 ? bMin.y : bMax.y,
                  iz === 0 ? bMin.z : bMax.z,
                );
                _cornerScratch.project(handles.camera);
                if (_cornerScratch.z >= -1 && _cornerScratch.z < 1) {
                  const sx = (_cornerScratch.x * 0.5 + 0.5) * canvasW;
                  const sy = (-_cornerScratch.y * 0.5 + 0.5) * canvasH;
                  if (sx < minScreenX) minScreenX = sx;
                  if (sx > maxScreenX) maxScreenX = sx;
                  if (sy < minScreenY) minScreenY = sy;
                  if (sy > maxScreenY) maxScreenY = sy;
                }
              }
            }
          }
        }

        _projScratch.set(
          b.origWorldCenter.x + offsetX,
          b.origWorldCenter.y + offsetY,
          b.origWorldCenter.z + offsetZ,
        );
        b.object.updateWorldMatrix(true,true);
        _groupLiveBoxScratch.setFromObject(b.object).getCenter(_projScratch);
        _projScratch.project(handles.camera);

        const anchorX = (_projScratch.x * 0.5 + 0.5) * canvasW;
        const anchorY = (-_projScratch.y * 0.5 + 0.5) * canvasH;

        candidates.push({
          nodeName: b.spec.nodeName,
          plainName: b.spec.plainName,
          category: b.spec.category,
          state,
          anchorX,
          anchorY,
          ndcZ: _projScratch.z,
          visible: b.object.visible,
          basePriority: b.spec.basePriority,
          isIllustrativeReconstruction: false,
        });
      }

      // Include illustrative mechanical sub-assemblies in screen label candidates
      const mechScaleSpread = 0.72 + 0.28 * clampedSpread;
      for (const mb of handles.mechanicalBindings) {
        if (!mb.object.visible) continue;
        const { localProgress, state } = computeMechanicalGroupProgress(mb.spec, p);
        const effScale = explosionScaleRatio * mechScaleSpread * localProgress;

        const offsetX = mb.spec.worldOffset.x * effScale;
        const offsetY = mb.spec.worldOffset.y * effScale;
        const offsetZ = mb.spec.worldOffset.z * effScale;

        _projScratch.set(
          mb.origWorldCenter.x + offsetX,
          mb.origWorldCenter.y + offsetY,
          mb.origWorldCenter.z + offsetZ,
        );
        mb.object.updateWorldMatrix(true,true);
        _groupLiveBoxScratch.setFromObject(mb.object).getCenter(_projScratch);
        _projScratch.project(handles.camera);

        const anchorX = (_projScratch.x * 0.5 + 0.5) * canvasW;
        const anchorY = (-_projScratch.y * 0.5 + 0.5) * canvasH;

        const mechLabelVisible =
          mb.object.visible &&
          (p >= 0.68 ||
            curStructure ||
            curRearCoverOpen ||
            experienceRef.current.revealed?.includes(mb.spec.nodeName) ||
            curSelected === mb.spec.nodeName ||
            curLabelDensity === 'detailed');

        candidates.push({
          nodeName: mb.spec.nodeName,
          plainName: mb.spec.plainName,
          category: mb.spec.category,
          state,
          anchorX,
          anchorY,
          ndcZ: _projScratch.z,
          visible: mechLabelVisible,
          basePriority: mb.spec.basePriority,
          isIllustrativeReconstruction: true,
        });
      }

      if (minScreenX < maxScreenX && minScreenY < maxScreenY) {
        const projectedSpanW = maxScreenX - minScreenX;
        const unobstructedW = canvasW >= 1024 ? canvasW * 0.95 : canvasW;
        const widthRatio = Math.min(1, projectedSpanW / Math.max(1, unobstructedW));
        const unclipped =
          minScreenX >= -8 &&
          maxScreenX <= canvasW + 8 &&
          minScreenY >= -8 &&
          maxScreenY <= canvasH + 8;
        setStageAttr('data-car-screen-width-ratio', widthRatio.toFixed(3));
        setStageAttr('data-car-unclipped', String(unclipped));
      }

      // 3. Project 3D group anchor points into 2D screen coordinates for on-model labels
      const effectiveDensity: LabelDensityMode = curShowLabels
        ? curLabelDensity
        : 'off';

      if (effectiveDensity === 'off') {
        if (lastLabelSignatureRef.current !== 'hidden') {
          lastLabelSignatureRef.current = 'hidden';
          setPlacedLabels([]);
        }
        return;
      }

      const topSafeY = canvasW < 1024 ? 110 : 62;
      const bottomSafeY = canvasW < 768 ? canvasH - 135 : canvasH - 102;

      const layout = computeScreenLabelLayout(
        candidates,
        canvasW,
        canvasH,
        p,
        curStructure,
        curSelected,
        topSafeY,
        bottomSafeY,
        effectiveDensity,
        curRearCoverOpen,
      );

      const sig = layout
        .map(
          (l) =>
            `${l.nodeName}:${Math.round(l.anchorX / 2)}:${Math.round(l.anchorY / 2)}:${Math.round(l.labelX / 2)}:${Math.round(l.labelY / 2)}:${l.state}:${l.isSelected ? 1 : 0}`,
        )
        .join('|');

      if (sig !== lastLabelSignatureRef.current) {
        lastLabelSignatureRef.current = sig;
        setPlacedLabels(layout);
      }
    }

    function tick() {
      if(!experienceRef.current.active){isLoopActive=false;return;}
      const dt = Math.min(clock.getDelta(), 0.1);
      const handles = sceneHandlesRef.current;
      let cameraAnimating = false;
      let openingsAnimating = false;

      if (handles && handles.hingedPanels.length > 0) {
        const targetDoors = propsStateRef.current.doorsOpen ? 1 : 0;
        const targetFrontLid = propsStateRef.current.frontLidOpen ? 1 : 0;
        const targetRearCover = propsStateRef.current.rearCoverOpen ? 1 : 0;

        if (propsStateRef.current.reducedMotion || isSoftwareGl) {
          if (
            handles.openingProgress.doors !== targetDoors ||
            handles.openingProgress.frontLid !== targetFrontLid ||
            handles.openingProgress.rearCover !== targetRearCover
          ) {
            handles.openingProgress.doors = targetDoors;
            handles.openingProgress.frontLid = targetFrontLid;
            handles.openingProgress.rearCover = targetRearCover;
            const res = applyHingedPanelTransforms(
              handles.hingedPanels,
              handles.openingProgress,
            );
            setStageAttr('data-doors-progress', targetDoors.toFixed(3));
            setStageAttr('data-front-lid-progress', targetFrontLid.toFixed(3));
            setStageAttr('data-rear-cover-progress', targetRearCover.toFixed(3));
            setStageAttr('data-max-hinge-angle', res.maxAngleRad.toFixed(4));
            setStageAttr('data-all-hinges-rest', String(res.allRestored));
          }
        } else {
          const hingeLambda = 9.5;
          handles.openingProgress.doors = THREE.MathUtils.damp(
            handles.openingProgress.doors,
            targetDoors,
            hingeLambda,
            dt,
          );
          handles.openingProgress.frontLid = THREE.MathUtils.damp(
            handles.openingProgress.frontLid,
            targetFrontLid,
            hingeLambda,
            dt,
          );
          handles.openingProgress.rearCover = THREE.MathUtils.damp(
            handles.openingProgress.rearCover,
            targetRearCover,
            hingeLambda,
            dt,
          );

          if (Math.abs(handles.openingProgress.doors - targetDoors) < 0.002) {
            handles.openingProgress.doors = targetDoors;
          } else {
            openingsAnimating = true;
          }
          if (Math.abs(handles.openingProgress.frontLid - targetFrontLid) < 0.002) {
            handles.openingProgress.frontLid = targetFrontLid;
          } else {
            openingsAnimating = true;
          }
          if (Math.abs(handles.openingProgress.rearCover - targetRearCover) < 0.002) {
            handles.openingProgress.rearCover = targetRearCover;
          } else {
            openingsAnimating = true;
          }

          const res = applyHingedPanelTransforms(
            handles.hingedPanels,
            handles.openingProgress,
          );
          setStageAttr(
            'data-doors-progress',
            handles.openingProgress.doors.toFixed(3),
          );
          setStageAttr(
            'data-front-lid-progress',
            handles.openingProgress.frontLid.toFixed(3),
          );
          setStageAttr(
            'data-rear-cover-progress',
            handles.openingProgress.rearCover.toFixed(3),
          );
          setStageAttr('data-max-hinge-angle', res.maxAngleRad.toFixed(4));
          setStageAttr('data-all-hinges-rest', String(res.allRestored));
        }
      }

      if (handles && handles.cameraGoalPos && handles.cameraGoalTarget) {
        const lambda = isSoftwareGl ? 24 : 11;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          handles.cameraGoalPos.x,
          lambda,
          dt,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          handles.cameraGoalPos.y,
          lambda,
          dt,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          handles.cameraGoalPos.z,
          lambda,
          dt,
        );

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          handles.cameraGoalTarget.x,
          lambda,
          dt,
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          handles.cameraGoalTarget.y,
          lambda,
          dt,
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          handles.cameraGoalTarget.z,
          lambda,
          dt,
        );

        const posDist = camera.position.distanceTo(handles.cameraGoalPos);
        const targetDist = controls.target.distanceTo(handles.cameraGoalTarget);
        if (posDist < 0.004 && targetDist < 0.004) {
          camera.position.copy(handles.cameraGoalPos);
          controls.target.copy(handles.cameraGoalTarget);
          handles.cameraGoalPos = null;
          handles.cameraGoalTarget = null;
        } else {
          cameraAnimating = true;
        }
      }

      const effectiveAutoRotate =
        propsStateRef.current.autoRotate &&
        !propsStateRef.current.reducedMotion &&
        propsStateRef.current.scrollProgress <= 0.01 &&
        !propsStateRef.current.selectedGroup &&
        !propsStateRef.current.doorsOpen &&
        !propsStateRef.current.frontLidOpen &&
        !propsStateRef.current.rearCoverOpen;
      controls.autoRotate = effectiveAutoRotate;
      controls.autoRotateSpeed =
        propsStateRef.current.rotationSpeed * propsStateRef.current.rotationDirection * 2.0;

      if(handles){applyExperienceLayout([...handles.groupBindings,...handles.mechanicalBindings],experienceRef.current);if(openingsAnimating&&!experienceRef.current.cockpit)reframeRef.current();}
      const controlsChanged = controls.enabled ? controls.update() : false;
      updateProjectedLabelsAndHighlight();
      renderer.render(scene, camera);
      needsSingleRender = false;

      const shouldContinue =
        effectiveAutoRotate ||
        cameraAnimating ||
        openingsAnimating ||
        controlsChanged ||
        needsSingleRender;

      if (shouldContinue) {
        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      } else {
        isLoopActive = false;
      }
    }

    function wakeLoop() {
      needsSingleRender = true;
      if (!isLoopActive) {
        isLoopActive = true;
        clock.getDelta();
        frameId = requestAnimationFrame(tick);
      }
    }

    const handleControlsStart = () => {
      if (sceneHandlesRef.current) {
        sceneHandlesRef.current.cameraGoalPos = null;
        sceneHandlesRef.current.cameraGoalTarget = null;
      }
      callbacksRef.current.onUserOrbitStart?.();
      wakeLoop();
    };

    const handleControlsChange = () => {
      wakeLoop();
    };

    controls.addEventListener('start', handleControlsStart);
    controls.addEventListener('change', handleControlsChange);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      isLoopActive = false;
    };

    const handleContextRestored = () => {
      wakeLoop();
    };

    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const handleResize = () => {
      if (!container) return;
      const r = container.getBoundingClientRect();
      const newW = Math.max(
        1,
        Math.round(r.width || container.clientWidth || window.innerWidth),
      );
      const newH = Math.max(
        1,
        Math.round(r.height || container.clientHeight || window.innerHeight),
      );
      const newAspect = newW / Math.max(1, newH);
      const dockLiftY = -0.04;

      camera.aspect = newAspect;

      const handles = sceneHandlesRef.current;
      if (handles && handles.rawModelBounds) {
        const updatedFit = computeCenterAndFit(
          handles.rawModelBounds.min,
          handles.rawModelBounds.max,
          camera.fov,
          newAspect,
          1.25,
        );
        handles.currentFit = updatedFit;
        const p = Math.max(0, Math.min(1, propsStateRef.current.scrollProgress));
        const spread = propsStateRef.current.explosionSpread;
        const explosionScaleRatio = updatedFit.maxDim / 12.25;

        camera.near = updatedFit.near;
        camera.far = updatedFit.far;
        controls.minDistance = updatedFit.minDistance;
        controls.maxDistance = updatedFit.maxDistance;

        const curSelected = propsStateRef.current.selectedGroup;
        const selectedBinding = curSelected
          ? handles.groupBindings.find((b) => b.spec.nodeName === curSelected) ??
            handles.mechanicalBindings.find((b) => b.spec.nodeName === curSelected)
          : undefined;

        if (selectedBinding) {
          const inspectFrame = computeGroupInspectionFraming(
            selectedBinding,
            p,
            explosionScaleRatio,
            spread,
            camera.fov,
            newAspect,
          );
          camera.position.set(
            inspectFrame.cameraPosition.x,
            inspectFrame.cameraPosition.y,
            inspectFrame.cameraPosition.z,
          );
          controls.target.set(
            inspectFrame.orbitTarget.x,
            inspectFrame.orbitTarget.y,
            inspectFrame.orbitTarget.z,
          );
          handles.cameraGoalPos = null;
          handles.cameraGoalTarget = null;
          controls.update();
          setStageAttr('data-fit-distance', inspectFrame.inspectDistance.toFixed(3));
        } else {
          const framing = computeExpandedCameraFraming(
            updatedFit.fitDistance,
            p,
            spread,
          );
          const targetOrbit = {
            x: updatedFit.orbitTarget.x,
            y:
              updatedFit.orbitTarget.y +
              (dockLiftY + framing.targetYOffset) * explosionScaleRatio,
            z: updatedFit.orbitTarget.z,
          };
          controls.target.set(targetOrbit.x, targetOrbit.y, targetOrbit.z);

          const dir = _scratchVec3.subVectors(camera.position, controls.target);
          if (dir.lengthSq() > 1e-6) {
            dir.normalize();
            camera.position.copy(controls.target).addScaledVector(dir, framing.distance);
          } else {
            const presetPos = computePresetCameraPosition(
              propsStateRef.current.activeCameraPreset,
              framing.distance,
              targetOrbit,
            );
            camera.position.set(presetPos.x, presetPos.y, presetPos.z);
          }
          handles.cameraGoalPos = null;
          handles.cameraGoalTarget = null;
          controls.update();
          setStageAttr('data-fit-distance', framing.distance.toFixed(3));
        }
      }

      camera.updateProjectionMatrix();
      const nextMaxDpr = newW < 768 ? 1.5 : 2;
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, nextMaxDpr),
      );
      renderer.setSize(newW, newH, false);
      setStageAttr('data-canvas-width', String(newW));
      setStageAttr('data-canvas-height', String(newH));
      wakeLoop();
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
    resizeObserver?.observe(container);

    sceneHandlesRef.current = {
      renderer,
      scene,
      camera,
      controls,
      keyLight,
      fillLight,
      rimLight,
      crimsonRimLight,
      sideLight,
      stageGroup,
      shadowReceiverPlane,
      contactShadowDisc,
      turntableRingGroup,
      modelHolder,
      selectionBoxHelper,
      loadedModelRoot: null,
      wheelController: null,
      mechanicalLayerRoot: null,
      groupBindings: [],
      mechanicalBindings: [],
      hingedPanels: [],
      lightController: null,
      openingProgress: { doors: 0, frontLid: 0, rearCover: 0 },
      materialRecords: [],
      rawModelBounds: null,
      currentFit: defaultFit,
      cameraGoalPos: null,
      cameraGoalTarget: null,
      savedPreInspectCamera: null,
      isSoftwareGl,
      wakeLoop,
      applyEnvIntensity,
      updateProjectedLabelsAndHighlight,
      setStageAttr,
    };

    wakeLoop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.removeEventListener('change', handleControlsChange);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      apiRef.current(null);finishRef.current?.dispose();
      currentEnvTarget?.dispose();
      contactShadowTex.dispose();
      selectionBoxHelper.dispose();
      disposeObjectHierarchy(stageGroup);
      disposeObjectHierarchy(modelHolder);
      renderer.dispose();
      sceneHandlesRef.current = null;
    };
  }, []);

  // 2. Sync autoRotate, rotationSpeed, rotationDirection, showFloorRing, lightingPreset, reducedMotion
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    handles.controls.autoRotate =
      autoRotate &&
      !reducedMotion &&
      propsStateRef.current.scrollProgress <= 0.01 &&
      !propsStateRef.current.selectedGroup &&
      !propsStateRef.current.doorsOpen &&
      !propsStateRef.current.frontLidOpen &&
      !propsStateRef.current.rearCoverOpen;
    handles.controls.autoRotateSpeed = rotationSpeed * rotationDirection * 2.0;
    handles.turntableRingGroup.visible = showFloorRing;

    const preset =
      LIGHTING_PRESETS.find((p) => p.id === lightingPreset) ?? LIGHTING_PRESETS[0];
    handles.renderer.toneMappingExposure = preset.exposure;
    handles.keyLight.intensity = preset.keyIntensity;
    handles.keyLight.color.setHex(preset.keyColor);
    handles.fillLight.color.setHex(preset.fillSkyColor);
    handles.fillLight.groundColor.setHex(preset.fillGroundColor);
    handles.fillLight.intensity = preset.fillIntensity;
    handles.rimLight.color.setHex(preset.rimColor);
    handles.rimLight.intensity = preset.rimIntensity;
    handles.crimsonRimLight.intensity = preset.crimsonRimIntensity;
    handles.applyEnvIntensity(preset.envIntensity);
    handles.setStageAttr('data-backdrop-preset', preset.id);

    handles.wakeLoop();
  }, [
    autoRotate,
    reducedMotion,
    rotationSpeed,
    rotationDirection,
    lightingPreset,
    showFloorRing,
  ]);

  // 3. Sync Exterior Paint Swatch (Rosso_Magma only)
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles || handles.materialRecords.length === 0) return;

    const { appliedHex, nonPaintUnchanged } = applyExteriorPaintColor(
      handles.materialRecords,
      activePaint,
      customPaintHex,
    );
    // Re-apply dimming if currently inspecting or in Chapter 07 so dimmed clones reflect the new paint
    if (
      propsStateRef.current.selectedGroup ||
      propsStateRef.current.scrollProgress > 0.72
    ) {
      applyInspectionDimming(
        handles.groupBindings,
        propsStateRef.current.selectedGroup,
        propsStateRef.current.structureMode,
        handles.mechanicalBindings,
        propsStateRef.current.scrollProgress,
      );
    }
    handles.setStageAttr('data-active-paint', activePaint);
    handles.setStageAttr('data-rosso-magma-hex', appliedHex);
    handles.setStageAttr('data-applied-paint-hex', appliedHex);
    handles.setStageAttr(
      'data-non-paint-materials-unchanged',
      String(nonPaintUnchanged),
    );
    handles.renderer.render(handles.scene, handles.camera);
    handles.wakeLoop();
  }, [activePaint, customPaintHex]);

  useEffect(() => {
    const handles=sceneHandlesRef.current;
    if (!handles?.wheelController) return;
    handles.wheelController.setDesign(wheelDesign);
    handles.setStageAttr('data-wheel-design',wheelDesign);
    handles.updateProjectedLabelsAndHighlight();
    handles.wakeLoop();
  },[wheelDesign]);

  // 3b. Sync Spatial Front Lights & Rear Lights Toggles
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    if (handles.lightController) {
      handles.lightController.setLightsState(frontLightsOn, rearLightsOn);
    }
    handles.setStageAttr('data-front-lights', String(frontLightsOn));
    handles.setStageAttr('data-rear-lights', String(rearLightsOn));
    handles.renderer.render(handles.scene, handles.camera);
    handles.wakeLoop();
  }, [frontLightsOn, rearLightsOn]);

  // 3c. Sync Doors, Front Luggage Lid & Rear Engine Cover Opening Toggles
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    handles.setStageAttr('data-doors-open', String(doorsOpen));
    handles.setStageAttr('data-front-lid-open', String(frontLidOpen));
    handles.setStageAttr('data-rear-cover-open', String(rearCoverOpen));

    if (
      (propsStateRef.current.reducedMotion || handles.isSoftwareGl) &&
      handles.hingedPanels.length > 0
    ) {
      handles.openingProgress.doors = doorsOpen ? 1 : 0;
      handles.openingProgress.frontLid = frontLidOpen ? 1 : 0;
      handles.openingProgress.rearCover = rearCoverOpen ? 1 : 0;
      const res = applyHingedPanelTransforms(
        handles.hingedPanels,
        handles.openingProgress,
      );
      handles.setStageAttr(
        'data-doors-progress',
        handles.openingProgress.doors.toFixed(3),
      );
      handles.setStageAttr(
        'data-front-lid-progress',
        handles.openingProgress.frontLid.toFixed(3),
      );
      handles.setStageAttr(
        'data-rear-cover-progress',
        handles.openingProgress.rearCover.toFixed(3),
      );
      handles.setStageAttr('data-max-hinge-angle', res.maxAngleRad.toFixed(4));
      handles.setStageAttr('data-all-hinges-rest', String(res.allRestored));
      handles.updateProjectedLabelsAndHighlight();
      handles.renderer.render(handles.scene, handles.camera);
    } else {
      handles.updateProjectedLabelsAndHighlight();
    }

    handles.wakeLoop();
  }, [doorsOpen, frontLidOpen, rearCoverOpen]);

  // 4. Sync Structure Mode, Labels, Label Density & Part Inspection Close-Up / Dimming / Back to Car
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles || handles.groupBindings.length === 0) return;

    const p = Math.max(0, Math.min(1, propsStateRef.current.scrollProgress));
    const spread = propsStateRef.current.explosionSpread;
    const explosionScaleRatio = handles.currentFit.maxDim / 12.25;

    const hiddenCount = applyStructureModeVisibility(
      handles.groupBindings,
      structureMode,
    );
    const dimmedCount = applyInspectionDimming(
      handles.groupBindings,
      selectedGroup,
      structureMode,
      handles.mechanicalBindings,
      p,
    );

    const effectiveDensity: LabelDensityMode = showLabels ? labelDensity : 'off';

    handles.setStageAttr('data-structure-mode', String(structureMode));
    handles.setStageAttr('data-hidden-group-count', String(hiddenCount));
    handles.setStageAttr('data-labels-visible', String(effectiveDensity !== 'off'));
    handles.setStageAttr('data-label-density', effectiveDensity);
    handles.setStageAttr('data-selected-group', selectedGroup ?? '');
    handles.setStageAttr('data-inspecting-group', selectedGroup ?? '');
    handles.setStageAttr('data-dimmed-group-count', String(dimmedCount));

    const selectedBinding = selectedGroup
      ? handles.groupBindings.find((b) => b.spec.nodeName === selectedGroup) ??
        handles.mechanicalBindings.find((b) => b.spec.nodeName === selectedGroup)
      : undefined;

    if (selectedBinding) {
      if (!handles.savedPreInspectCamera) {
        const startPos = handles.cameraGoalPos
          ? handles.cameraGoalPos.clone()
          : handles.camera.position.clone();
        const startTarget = handles.cameraGoalTarget
          ? handles.cameraGoalTarget.clone()
          : handles.controls.target.clone();
        handles.savedPreInspectCamera = {
          pos: startPos,
          target: startTarget,
          scrollProgress: p,
        };
      }

      const inspectFrame = computeGroupInspectionFraming(
        selectedBinding,
        p,
        explosionScaleRatio,
        spread,
        handles.camera.fov,
        handles.camera.aspect,
      );

      handles.setStageAttr(
        'data-inspect-distance',
        inspectFrame.inspectDistance.toFixed(3),
      );
      handles.setStageAttr(
        'data-fit-distance',
        inspectFrame.inspectDistance.toFixed(3),
      );

      if (propsStateRef.current.reducedMotion) {
        handles.camera.position.set(
          inspectFrame.cameraPosition.x,
          inspectFrame.cameraPosition.y,
          inspectFrame.cameraPosition.z,
        );
        handles.controls.target.set(
          inspectFrame.orbitTarget.x,
          inspectFrame.orbitTarget.y,
          inspectFrame.orbitTarget.z,
        );
        handles.cameraGoalPos = null;
        handles.cameraGoalTarget = null;
        handles.controls.update();
      } else {
        handles.cameraGoalPos = new THREE.Vector3(
          inspectFrame.cameraPosition.x,
          inspectFrame.cameraPosition.y,
          inspectFrame.cameraPosition.z,
        );
        handles.cameraGoalTarget = new THREE.Vector3(
          inspectFrame.orbitTarget.x,
          inspectFrame.orbitTarget.y,
          inspectFrame.orbitTarget.z,
        );
      }
    } else if (handles.savedPreInspectCamera) {
      const dockLiftY = -0.04;
      const framing = computeExpandedCameraFraming(
        handles.currentFit.fitDistance,
        p,
        spread,
      );
      const fallbackOrbit = {
        x: handles.currentFit.orbitTarget.x,
        y:
          handles.currentFit.orbitTarget.y +
          (dockLiftY + framing.targetYOffset) * explosionScaleRatio,
        z: handles.currentFit.orbitTarget.z,
      };
      const fallbackPos = computePresetCameraPosition(
        propsStateRef.current.activeCameraPreset,
        framing.distance,
        fallbackOrbit,
      );

      const useSaved =
        Math.abs(handles.savedPreInspectCamera.scrollProgress - p) < 0.01;
      const restorePos = useSaved
        ? handles.savedPreInspectCamera.pos
        : new THREE.Vector3(fallbackPos.x, fallbackPos.y, fallbackPos.z);
      const restoreTarget = useSaved
        ? handles.savedPreInspectCamera.target
        : new THREE.Vector3(fallbackOrbit.x, fallbackOrbit.y, fallbackOrbit.z);

      handles.savedPreInspectCamera = null;
      handles.setStageAttr('data-inspect-distance', '');
      handles.setStageAttr('data-fit-distance', framing.distance.toFixed(3));

      if (propsStateRef.current.reducedMotion) {
        handles.camera.position.copy(restorePos);
        handles.controls.target.copy(restoreTarget);
        handles.cameraGoalPos = null;
        handles.cameraGoalTarget = null;
        handles.controls.update();
      } else {
        handles.cameraGoalPos = restorePos.clone();
        handles.cameraGoalTarget = restoreTarget.clone();
      }
    }

    handles.updateProjectedLabelsAndHighlight();
    handles.renderer.render(handles.scene, handles.camera);
    handles.wakeLoop();
  }, [structureMode, showLabels, labelDensity, selectedGroup]);

  // 5. Sync ScrollTrigger Explosion Progress, Mechanical Layer Separation, Spread Multiplier & Expanded Camera Framing
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    const p = Math.max(0, Math.min(1, scrollProgress));
    const explosionScaleRatio = handles.currentFit.maxDim / 12.25;

    if (handles.groupBindings.length > 0) {
      applyPresentationExplosion(
        handles.groupBindings,
        p,
        explosionScaleRatio,
        explosionSpread,
      );

      let maxLocalDelta = 0;
      let underbodyDelta = 0;
      for (const b of handles.groupBindings) {
        const d = b.object.position.distanceTo(b.origLocalPosition);
        if (b.spec.nodeName === 'Underbody_and_trim') {
          underbodyDelta = d;
        } else if (d > maxLocalDelta) {
          maxLocalDelta = d;
        }
      }

      let maxMechDelta = 0;
      let tubDelta = 0;
      if (handles.mechanicalBindings.length > 0) {
        const mechRes = applyMechanicalLayerExplosion(
          handles.mechanicalBindings,
          p,
          explosionScaleRatio,
          explosionSpread,
        );
        maxMechDelta = mechRes.maxMechanicalDelta;
        tubDelta = mechRes.tubDelta;
      }

      // Apply Chapter 07 shell translucency or active part inspection dimming
      const dimmedCount = applyInspectionDimming(
        handles.groupBindings,
        propsStateRef.current.selectedGroup,
        propsStateRef.current.structureMode,
        handles.mechanicalBindings,
        p,
      );

      handles.setStageAttr('data-scroll-progress', p.toFixed(3));
      handles.setStageAttr('data-explosion-progress', p.toFixed(3));
      handles.setStageAttr('data-explosion-spread', explosionSpread.toFixed(2));
      handles.setStageAttr('data-max-local-delta', maxLocalDelta.toFixed(4));
      handles.setStageAttr('data-max-mechanical-delta', maxMechDelta.toFixed(4));
      handles.setStageAttr('data-tub-fixed', String(tubDelta < 1e-5));
      handles.setStageAttr(
        'data-underbody-world-delta',
        underbodyDelta.toFixed(5),
      );
      handles.setStageAttr('data-underbody-fixed', String(underbodyDelta < 1e-5));
      handles.setStageAttr('data-dimmed-group-count', String(dimmedCount));
    }

    const contactMat = handles.contactShadowDisc.material as THREE.MeshBasicMaterial;
    contactMat.opacity = 0.22 * (1 - 0.42 * p);

    const dockLiftY = -0.04;
    const framing = computeExpandedCameraFraming(
      handles.currentFit.fitDistance,
      p,
      explosionSpread,
    );
    const targetOrbit = {
      x: handles.currentFit.orbitTarget.x,
      y:
        handles.currentFit.orbitTarget.y +
        (dockLiftY + framing.targetYOffset) * explosionScaleRatio,
      z: handles.currentFit.orbitTarget.z,
    };

    const curSelected = propsStateRef.current.selectedGroup;
    const selectedBinding = curSelected
      ? handles.groupBindings.find((b) => b.spec.nodeName === curSelected) ??
        handles.mechanicalBindings.find((b) => b.spec.nodeName === curSelected)
      : undefined;

    if (selectedBinding) {
      const inspectFrame = computeGroupInspectionFraming(
        selectedBinding,
        p,
        explosionScaleRatio,
        explosionSpread,
        handles.camera.fov,
        handles.camera.aspect,
      );
      handles.camera.position.set(
        inspectFrame.cameraPosition.x,
        inspectFrame.cameraPosition.y,
        inspectFrame.cameraPosition.z,
      );
      handles.controls.target.set(
        inspectFrame.orbitTarget.x,
        inspectFrame.orbitTarget.y,
        inspectFrame.orbitTarget.z,
      );
      handles.cameraGoalPos = null;
      handles.cameraGoalTarget = null;
      handles.controls.autoRotate = false;
      handles.controls.update();
      handles.setStageAttr(
        'data-fit-distance',
        inspectFrame.inspectDistance.toFixed(3),
      );
    } else if (p > 0.005) {
      const targetPos = computePresetCameraPosition(
        activeCameraPreset,
        framing.distance,
        targetOrbit,
      );
      handles.camera.position.set(targetPos.x, targetPos.y, targetPos.z);
      handles.controls.target.set(targetOrbit.x, targetOrbit.y, targetOrbit.z);
      handles.cameraGoalPos = null;
      handles.cameraGoalTarget = null;
      handles.controls.autoRotate = false;
      handles.controls.update();
      handles.setStageAttr('data-fit-distance', framing.distance.toFixed(3));
    } else {
      const homePos = computePresetCameraPosition(
        activeCameraPreset,
        handles.currentFit.fitDistance,
        targetOrbit,
      );
      handles.camera.position.set(homePos.x, homePos.y, homePos.z);
      handles.controls.target.set(targetOrbit.x, targetOrbit.y, targetOrbit.z);
      handles.cameraGoalPos = null;
      handles.cameraGoalTarget = null;
      handles.controls.autoRotate =
        propsStateRef.current.autoRotate &&
        !propsStateRef.current.reducedMotion &&
        !propsStateRef.current.doorsOpen &&
        !propsStateRef.current.frontLidOpen &&
        !propsStateRef.current.rearCoverOpen;
      handles.controls.update();
      handles.setStageAttr(
        'data-fit-distance',
        handles.currentFit.fitDistance.toFixed(3),
      );
    }

    handles.updateProjectedLabelsAndHighlight();
    handles.renderer.render(handles.scene, handles.camera);
    handles.wakeLoop();
  }, [scrollProgress, explosionSpread, activeCameraPreset]);

  // 6. Handle Camera Preset Transitions & Reset View
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    const dockLiftY = -0.04;
    const p = Math.max(0, Math.min(1, propsStateRef.current.scrollProgress));
    const spread = propsStateRef.current.explosionSpread;
    const explosionScaleRatio = handles.currentFit.maxDim / 12.25;
    const framing = computeExpandedCameraFraming(
      handles.currentFit.fitDistance,
      p,
      spread,
    );
    const targetOrbit = {
      x: handles.currentFit.orbitTarget.x,
      y:
        handles.currentFit.orbitTarget.y +
        (dockLiftY + framing.targetYOffset) * explosionScaleRatio,
      z: handles.currentFit.orbitTarget.z,
    };

    const targetPos = computePresetCameraPosition(
      activeCameraPreset,
      framing.distance,
      targetOrbit,
    );

    if (propsStateRef.current.reducedMotion) {
      handles.camera.position.set(targetPos.x, targetPos.y, targetPos.z);
      handles.controls.target.set(targetOrbit.x, targetOrbit.y, targetOrbit.z);
      handles.cameraGoalPos = null;
      handles.cameraGoalTarget = null;
      handles.controls.update();
    } else {
      handles.cameraGoalPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
      handles.cameraGoalTarget = new THREE.Vector3(
        targetOrbit.x,
        targetOrbit.y,
        targetOrbit.z,
      );
    }
    handles.wakeLoop();
  }, [activeCameraPreset, resetTrigger]);

  // 7. Automatically Load /models/daytona-sp3-web.glb with GLTFLoader + MeshoptDecoder
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles || !modelUrl) return;

    let cancelled = false;
    const displayFileName =
      modelUrl.split('/').filter(Boolean).pop() || DEFAULT_MODEL_FILENAME;

    const loadBuiltInGlb = async () => {
      callbacksRef.current.onStatusChange('loading');
      handles.setStageAttr('data-viewer-status', 'loading');
      callbacksRef.current.onProgressChange(
        8,
        `Initializing MeshoptDecoder for ${displayFileName}...`,
      );

      try {
        if (MeshoptDecoder && 'ready' in MeshoptDecoder) {
          await MeshoptDecoder.ready;
        }
        if (cancelled) return;

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);

        // The bundled SP3 uses Meshopt; its decoder ships with this app.

        callbacksRef.current.onProgressChange(
          18,
          `Streaming ${displayFileName} via GLTFLoader...`,
        );

        let transferredBytes = 0;

        const gltf = await new Promise<{
          scene: THREE.Group;
          parser?: { json?: { buffers?: Array<{ byteLength?: number }> } };
        }>((resolve, reject) => {
          loader.load(
            modelUrl,
            (loaded) => resolve(loaded),
            (ev) => {
              if (cancelled) return;
              if (ev.loaded > 0) {
                transferredBytes = ev.loaded;
              }
              if (ev.lengthComputable && ev.total > 0) {
                const ratio = Math.min(1, ev.loaded / ev.total);
                const pct = Math.round(18 + ratio * 68);
                callbacksRef.current.onProgressChange(
                  pct,
                  `Streaming & decoding ${displayFileName} (${Math.round(ratio * 100)}%)...`,
                );
              } else {
                callbacksRef.current.onProgressChange(
                  60,
                  `Streaming & decoding ${displayFileName}...`,
                );
              }
            },
            (err) =>
              reject(
                err instanceof Error
                  ? err
                  : new Error(
                      typeof err === 'string'
                        ? err
                        : `GLTFLoader failed to load ${modelUrl}.`,
                    ),
              ),
          );
        });

        if (cancelled) return;

        const model = gltf.scene;
        model.updateMatrixWorld(true);

        const rawBox = new THREE.Box3().setFromObject(model);
        if (rawBox.isEmpty()) {
          callbacksRef.current.onStatusChange('error');
          handles.setStageAttr('data-viewer-status', 'error');
          callbacksRef.current.onError({
            title: 'No Renderable 3D Geometry Found',
            detail: `"${displayFileName}" loaded, but its scene graph contains no visible Mesh geometry to center or display.`,
            fileName: displayFileName,
          });
          return;
        }

        callbacksRef.current.onProgressChange(
          92,
          'Centering bounding box, splitting panel hinges & building illustrative V12/chassis...',
        );

        if (handles.loadedModelRoot) {
          handles.modelHolder.remove(handles.loadedModelRoot);
          disposeObjectHierarchy(handles.loadedModelRoot);
          handles.loadedModelRoot = null;
        }
        if (handles.mechanicalLayerRoot) {
          handles.modelHolder.remove(handles.mechanicalLayerRoot);
          disposeObjectHierarchy(handles.mechanicalLayerRoot);
          handles.mechanicalLayerRoot = null;
        }
        handles.groupBindings = [];
        handles.mechanicalBindings = [];
        handles.hingedPanels = [];
        handles.lightController = null;
        handles.materialRecords = [];

        const rawBounds = {
          min: { x: rawBox.min.x, y: rawBox.min.y, z: rawBox.min.z },
          max: { x: rawBox.max.x, y: rawBox.max.y, z: rawBox.max.z },
        };
        handles.rawModelBounds = rawBounds;

        const curRect = mountRef.current?.getBoundingClientRect();
        const curW = Math.max(
          1,
          Math.round(curRect?.width || mountRef.current?.clientWidth || window.innerWidth),
        );
        const curH = Math.max(
          1,
          Math.round(curRect?.height || mountRef.current?.clientHeight || window.innerHeight),
        );
        const curAspect = curW / Math.max(1, curH);
        const dockLiftY = -0.04;

        handles.camera.aspect = curAspect;
        handles.renderer.setSize(curW, curH, false);
        handles.setStageAttr('data-canvas-width', String(curW));
        handles.setStageAttr('data-canvas-height', String(curH));

        const fit = computeCenterAndFit(
          rawBounds.min,
          rawBounds.max,
          handles.camera.fov,
          curAspect,
          1.25,
        );

        model.position.set(
          model.position.x + fit.modelPositionOffset.x,
          model.position.y + fit.modelPositionOffset.y,
          model.position.z + fit.modelPositionOffset.z,
        );
        model.updateMatrixWorld(true);

        let meshCount = 0;
        let vertexCount = 0;
        let triangleCount = 0;
        const uniqueMaterials = new Set<THREE.Material>();
        const maxAniso = handles.renderer.capabilities.getMaxAnisotropy();
        const activePreset =
          LIGHTING_PRESETS.find((p) => p.id === propsStateRef.current.lightingPreset) ??
          LIGHTING_PRESETS[0];

        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            meshCount += 1;
            mesh.castShadow = !handles.isSoftwareGl;
            mesh.receiveShadow = !handles.isSoftwareGl;

            const geo = mesh.geometry;
            if (geo) {
              const posAttr = geo.attributes.position;
              if (posAttr) {
                vertexCount += posAttr.count;
              }
              if (geo.index) {
                triangleCount += Math.floor(geo.index.count / 3);
              } else if (posAttr) {
                triangleCount += Math.floor(posAttr.count / 3);
              }
            }

            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : mesh.material
                ? [mesh.material]
                : [];

            for (const mat of mats) {
              uniqueMaterials.add(mat);
              const stdMat = mat as THREE.MeshStandardMaterial;
              if ('envMapIntensity' in stdMat) {
                stdMat.envMapIntensity = activePreset.envIntensity;
              }
              if (stdMat.map) {
                stdMat.map.colorSpace = THREE.SRGBColorSpace;
                stdMat.map.anisotropy = maxAniso;
              }
              if (stdMat.normalMap) {
                stdMat.normalMap.anisotropy = maxAniso;
              }
              if (stdMat.roughnessMap) {
                stdMat.roughnessMap.anisotropy = maxAniso;
              }
              if (stdMat.metalnessMap) {
                stdMat.metalnessMap.anisotropy = maxAniso;
              }
            }
          }
        });

        handles.modelHolder.add(model);
        handles.loadedModelRoot = model;
        handles.currentFit = fit;

        handles.wheelController = setupWheelDesigns(model);
        handles.wheelController.setDesign(propsStateRef.current.wheelDesign);
        handles.setStageAttr('data-wheel-design',propsStateRef.current.wheelDesign);

        // Capture pure GLB materials before splitting spatial lamps
        const materialRecords = captureModelMaterials(model);
        handles.materialRecords = materialRecords;

        // Split genuine hinged panel surfaces (butterfly doors, front luggage lid, rear engine cover)
        // and spatial front/rear light meshes
        const panelsAndLights = setupPanelsAndSpatialLights(
          model,
          handles.isSoftwareGl,
        );
        handles.hingedPanels = panelsAndLights.hingedPanels;
        finishRef.current?.dispose();finishRef.current=prepareFinishMaterials(model);
        handles.lightController = panelsAndLights.lightController;
        handles.lightController.setLightsState(
          propsStateRef.current.frontLightsOn,
          propsStateRef.current.rearLightsOn,
        );

        handles.openingProgress = {
          doors: propsStateRef.current.doorsOpen ? 1 : 0,
          frontLid: propsStateRef.current.frontLidOpen ? 1 : 0,
          rearCover: propsStateRef.current.rearCoverOpen ? 1 : 0,
        };
        const hingeInitRes = applyHingedPanelTransforms(
          handles.hingedPanels,
          handles.openingProgress,
        );

        // Build procedural illustrative mid-rear V12 & chassis reconstruction layer fitted inside the centered car
        const mechLayer = buildIllustrativeMechanicalLayer();
        mechLayer.rootGroup.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = !handles.isSoftwareGl;
            mesh.receiveShadow = !handles.isSoftwareGl;
          }
        });
        handles.modelHolder.add(mechLayer.rootGroup);
        handles.mechanicalLayerRoot = mechLayer.rootGroup;
        handles.mechanicalBindings = mechLayer.bindings;

        const hasClearcoat = materialRecords.some(
          (r) => r.isExteriorPaint && r.hasClearcoat,
        );
        const paintRes = applyExteriorPaintColor(
          materialRecords,
          propsStateRef.current.activePaint,
          propsStateRef.current.customPaintHex,
        );
        handles.setStageAttr('data-active-paint', propsStateRef.current.activePaint);
        handles.setStageAttr('data-rosso-magma-hex', paintRes.appliedHex);
        handles.setStageAttr('data-applied-paint-hex', paintRes.appliedHex);
        handles.setStageAttr(
          'data-non-paint-materials-unchanged',
          String(paintRes.nonPaintUnchanged),
        );
        handles.setStageAttr('data-clearcoat-enabled', String(hasClearcoat));

        const capturedBindings = capturePresentationGroupBindings(model);
        handles.groupBindings = capturedBindings;
        handles.setStageAttr(
          'data-presentation-group-count',
          String(capturedBindings.length),
        );
        handles.setStageAttr(
          'data-mechanical-group-count',
          String(mechLayer.bindings.length),
        );
        handles.setStageAttr(
          'data-hinged-panel-count',
          String(panelsAndLights.hingedPanels.length),
        );
        handles.setStageAttr(
          'data-front-light-meshes',
          String(panelsAndLights.lightController.frontLightMeshCount),
        );
        handles.setStageAttr(
          'data-rear-light-meshes',
          String(panelsAndLights.lightController.rearLightMeshCount),
        );
        handles.setStageAttr(
          'data-front-lights',
          String(propsStateRef.current.frontLightsOn),
        );
        handles.setStageAttr(
          'data-rear-lights',
          String(propsStateRef.current.rearLightsOn),
        );
        handles.setStageAttr(
          'data-doors-open',
          String(propsStateRef.current.doorsOpen),
        );
        handles.setStageAttr(
          'data-front-lid-open',
          String(propsStateRef.current.frontLidOpen),
        );
        handles.setStageAttr(
          'data-rear-cover-open',
          String(propsStateRef.current.rearCoverOpen),
        );
        handles.setStageAttr(
          'data-doors-progress',
          handles.openingProgress.doors.toFixed(3),
        );
        handles.setStageAttr(
          'data-front-lid-progress',
          handles.openingProgress.frontLid.toFixed(3),
        );
        handles.setStageAttr(
          'data-rear-cover-progress',
          handles.openingProgress.rearCover.toFixed(3),
        );
        handles.setStageAttr(
          'data-max-hinge-angle',
          hingeInitRes.maxAngleRad.toFixed(4),
        );
        handles.setStageAttr(
          'data-all-hinges-rest',
          String(hingeInitRes.allRestored),
        );

        const currentProgress = Math.max(0, Math.min(1, propsStateRef.current.scrollProgress));
        const currentSpread = propsStateRef.current.explosionSpread;
        const explosionScaleRatio = fit.maxDim / 12.25;

        applyPresentationExplosion(
          capturedBindings,
          currentProgress,
          explosionScaleRatio,
          currentSpread,
        );
        const mechExpRes = applyMechanicalLayerExplosion(
          mechLayer.bindings,
          currentProgress,
          explosionScaleRatio,
          currentSpread,
        );

        const hiddenCount = applyStructureModeVisibility(
          capturedBindings,
          propsStateRef.current.structureMode,
        );
        const dimmedCount = applyInspectionDimming(
          capturedBindings,
          propsStateRef.current.selectedGroup,
          propsStateRef.current.structureMode,
          mechLayer.bindings,
          currentProgress,
        );
        handles.setStageAttr(
          'data-structure-mode',
          String(propsStateRef.current.structureMode),
        );
        handles.setStageAttr('data-hidden-group-count', String(hiddenCount));
        handles.setStageAttr('data-dimmed-group-count', String(dimmedCount));

        const scaleRatio = fit.maxDim / 4.68;
        handles.stageGroup.position.y = fit.floorY - 0.012 * scaleRatio;
        handles.stageGroup.scale.setScalar(scaleRatio);

        handles.keyLight.position.set(5.5 * scaleRatio, 9.5 * scaleRatio, 6.5 * scaleRatio);
        handles.rimLight.position.set(-6 * scaleRatio, 5.5 * scaleRatio, -7 * scaleRatio);
        handles.crimsonRimLight.position.set(
          -5.2 * scaleRatio,
          2.1 * scaleRatio,
          -6.8 * scaleRatio,
        );
        handles.sideLight.position.set(-7 * scaleRatio, 3.2 * scaleRatio, 5 * scaleRatio);

        if (!handles.isSoftwareGl && handles.keyLight.shadow.camera) {
          const d = fit.maxDim * 0.85;
          handles.keyLight.shadow.camera.left = -d;
          handles.keyLight.shadow.camera.right = d;
          handles.keyLight.shadow.camera.top = d;
          handles.keyLight.shadow.camera.bottom = -d;
          handles.keyLight.shadow.camera.near = Math.max(0.05, fit.maxDim * 0.05);
          handles.keyLight.shadow.camera.far = fit.maxDim * 8;
          handles.keyLight.shadow.camera.updateProjectionMatrix();
        }

        handles.camera.near = fit.near;
        handles.camera.far = fit.far;
        handles.camera.updateProjectionMatrix();

        handles.controls.minDistance = fit.minDistance;
        handles.controls.maxDistance = fit.maxDistance;

        const centeredBox = new THREE.Box3().setFromObject(model);
        const centeredOrigin = centeredBox.getCenter(_scratchVec3);
        handles.setStageAttr(
          'data-model-centered',
          `${Math.abs(centeredOrigin.x) < 1e-2 && Math.abs(centeredOrigin.y) < 1e-2 && Math.abs(centeredOrigin.z) < 1e-2}`,
        );

        let maxLocalDelta = 0;
        let underbodyDelta = 0;
        for (const b of capturedBindings) {
          const d = b.object.position.distanceTo(b.origLocalPosition);
          if (b.spec.nodeName === 'Underbody_and_trim') {
            underbodyDelta = d;
          } else if (d > maxLocalDelta) {
            maxLocalDelta = d;
          }
        }
        handles.setStageAttr('data-scroll-progress', currentProgress.toFixed(3));
        handles.setStageAttr('data-explosion-progress', currentProgress.toFixed(3));
        handles.setStageAttr('data-explosion-spread', currentSpread.toFixed(2));
        handles.setStageAttr('data-max-local-delta', maxLocalDelta.toFixed(4));
        handles.setStageAttr(
          'data-max-mechanical-delta',
          mechExpRes.maxMechanicalDelta.toFixed(4),
        );
        handles.setStageAttr('data-tub-fixed', String(mechExpRes.tubDelta < 1e-5));
        handles.setStageAttr('data-underbody-world-delta', underbodyDelta.toFixed(5));
        handles.setStageAttr('data-underbody-fixed', String(underbodyDelta < 1e-5));

        const framing = computeExpandedCameraFraming(
          fit.fitDistance,
          currentProgress,
          currentSpread,
        );
        const targetOrbit = {
          x: fit.orbitTarget.x,
          y:
            fit.orbitTarget.y +
            (dockLiftY + framing.targetYOffset) * explosionScaleRatio,
          z: fit.orbitTarget.z,
        };
        const initialCamPos = computePresetCameraPosition(
          propsStateRef.current.activeCameraPreset,
          framing.distance,
          targetOrbit,
        );
        handles.camera.position.set(initialCamPos.x, initialCamPos.y, initialCamPos.z);
        handles.controls.target.set(targetOrbit.x, targetOrbit.y, targetOrbit.z);
        handles.cameraGoalPos = null;
        handles.cameraGoalTarget = null;
        handles.controls.update();

        const contactMat = handles.contactShadowDisc.material as THREE.MeshBasicMaterial;
        contactMat.opacity = 0.22 * (1 - 0.42 * currentProgress);

        handles.setStageAttr('data-fit-distance', framing.distance.toFixed(3));

        const declaredBytes =
          transferredBytes ||
          gltf.parser?.json?.buffers?.[0]?.byteLength ||
          0;

        callbacksRef.current.onProgressChange(100, 'Complete');
        callbacksRef.current.onModelLoaded({
          fileName: displayFileName,
          fileSizeBytes: declaredBytes,
          meshCount,
          materialCount: uniqueMaterials.size,
          vertexCount,
          triangleCount,
          bounds: fit,
          loadedAtIso: new Date().toISOString(),
        });
        handles.updateProjectedLabelsAndHighlight();
        handles.renderer.render(handles.scene, handles.camera);
        callbacksRef.current.onStatusChange('ready');
        handles.setStageAttr('data-viewer-status', 'ready');
        apiRef.current({capture:async options=>{const shown=handles.selectionBoxHelper.visible;handles.selectionBoxHelper.visible=false;try{return await captureScenePhoto(handles.renderer,handles.scene,handles.camera,options,experienceRef.current.cockpit?undefined:handles.controls.target);}finally{handles.selectionBoxHelper.visible=shown;handles.wakeLoop();}}});
        handles.wakeLoop();
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Unknown GLTFLoader parsing error.';
        callbacksRef.current.onStatusChange('error');
        handles.setStageAttr('data-viewer-status', 'error');
        callbacksRef.current.onError({
          title: 'Failed to Load Ferrari Daytona SP3 Model',
          detail: `${message} Click Retry to reload "${modelUrl}" with GLTFLoader and MeshoptDecoder.`,
          fileName: displayFileName,
        });
      }
    };

    loadBuiltInGlb();

    return () => {
      cancelled = true;
    };
  }, [modelUrl, retryCount]);

  // Experience controls operate on the existing scene and exact stored assembly transforms.
  useEffect(()=>{
    const h=sceneHandlesRef.current;if(!h?.loadedModelRoot)return;
    const e=experienceRef.current,s=propsStateRef.current,p=s.scrollProgress;
    applyPresentationExplosion(h.groupBindings,p,h.currentFit.maxDim/12.25,s.explosionSpread);
    applyMechanicalLayerExplosion(h.mechanicalBindings,e.tray?0:p,h.currentFit.maxDim/12.25,s.explosionSpread);
    applyInspectionDimming(h.groupBindings,selectedGroup,s.structureMode,h.mechanicalBindings,e.tray?0:p);
    const mechanicalVisible=e.tray||s.structureMode||s.rearCoverOpen||p>.72||Boolean(selectedGroup?.startsWith('Mech_'))||Boolean(e.revealed?.some(id=>id.startsWith('Mech_')));
    if(h.mechanicalLayerRoot)h.mechanicalLayerRoot.visible=mechanicalVisible;
    for(const b of h.mechanicalBindings)b.object.visible=mechanicalVisible;
    applyExperienceLayout([...h.groupBindings,...h.mechanicalBindings],e);
    h.controls.enabled=!e.cockpit;h.controls.enableZoom=e.photo||e.tray;
    h.camera.fov=e.photo?THREE.MathUtils.radToDeg(2*Math.atan(24/(2*e.lens))):e.cockpit?58:40;
    h.camera.updateProjectionMatrix();
    reframeRef.current=()=>{
      const feature=experienceRef.current,props=propsStateRef.current;
      h.cameraGoalPos=null;h.cameraGoalTarget=null;
      if(feature.cockpit){h.camera.near=.025;h.camera.position.set(.85,.85,0);h.controls.target.set(.85,.38,2.1);h.camera.lookAt(h.controls.target);h.camera.updateProjectionMatrix();return;}
      h.camera.near=h.currentFit.near;
      const all=[...h.groupBindings,...h.mechanicalBindings];
      const roots=props.selectedGroup?all.filter(b=>b.spec.nodeName===props.selectedGroup).map(b=>b.object):all.map(b=>b.object).filter(o=>o.visible);
      let direction=new THREE.Vector3().copy(CAMERA_PRESETS.find(c=>c.id===props.activeCameraPreset)?.direction??CAMERA_PRESETS[0].direction);
      if(feature.tray&&!props.selectedGroup)direction.set(.15,1.3,1.4);
      else if(feature.tour&&props.scrollProgress>.01&&!props.selectedGroup&&!feature.photo){const t=props.scrollProgress;const points=[new THREE.Vector3(.68,.25,.68),new THREE.Vector3(1,.3,.05),new THREE.Vector3(.65,.6,-.75),new THREE.Vector3(.8,.85,.7)];const i=Math.min(2,Math.floor(t*3));direction.copy(points[i]).lerp(points[i+1],t*3-i);}
      else if(feature.photo)direction.copy(h.camera.position).sub(h.controls.target);
      fitVisibleScene(h.camera,h.controls,roots,direction,props.selectedGroup?1.28:feature.tray?1.18:1.14);
    };
    reframeRef.current();h.updateProjectedLabelsAndHighlight();h.wakeLoop();
    h.setStageAttr('data-parts-tray',String(e.tray));h.setStageAttr('data-hidden-assemblies',String(e.hidden.length));h.setStageAttr('data-isolated-assembly',e.isolated??'');h.setStageAttr('data-cockpit',String(e.cockpit));
    const settle=setTimeout(()=>{if(sceneHandlesRef.current===h){reframeRef.current();h.wakeLoop();}},900);
    return()=>clearTimeout(settle);
  },[experience.tray,experience.trayItems,experience.hidden,experience.revealed,experience.isolated,experience.cockpit,experience.photo,experience.lens,experience.tour,experience.active,scrollProgress,selectedGroup,activeCameraPreset,resetTrigger,doorsOpen,frontLidOpen,rearCoverOpen,structureMode,explosionSpread]);

  useEffect(()=>{
    const h=sceneHandlesRef.current;if(!h?.loadedModelRoot)return;
    const swatch=activePaint==='custom'?customPaintHex:PAINT_SWATCHES.find(p=>p.id===activePaint)?.hex??'#d41217';
    finishRef.current?.apply(experienceRef.current,swatch);h.setStageAttr('data-caliper-finish',experience.caliper);h.setStageAttr('data-interior-finish',experience.interior);h.setStageAttr('data-hardtop-finish',experience.roof);h.wakeLoop();
  },[experience.caliper,experience.interior,experience.roof,activePaint,customPaintHex,resetTrigger]);

  useEffect(()=>{
    const h=sceneHandlesRef.current;if(!h||!experience.cockpit)return;
    const canvas=h.renderer.domElement;let dragging=false,x=0,y=0,yaw=0,pitch=-.17;
    const down=(event:PointerEvent)=>{dragging=true;x=event.clientX;y=event.clientY;canvas.setPointerCapture(event.pointerId);};
    const move=(event:PointerEvent)=>{if(!dragging)return;yaw=THREE.MathUtils.clamp(yaw+(event.clientX-x)*.004,-1.3,1.3);pitch=THREE.MathUtils.clamp(pitch+(event.clientY-y)*.004,-.65,.65);x=event.clientX;y=event.clientY;h.camera.lookAt(h.camera.position.x+Math.sin(-yaw),h.camera.position.y+Math.sin(pitch),h.camera.position.z+Math.cos(yaw));h.wakeLoop();};
    const up=()=>{dragging=false;};canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    return()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);};
  },[experience.cockpit,resetTrigger]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full overflow-hidden select-none"
      data-testid="studio-canvas-stage"
    >
      {/* WebGL Mount Container */}
      <div
        ref={mountRef}
        className="relative w-full h-full overflow-hidden"
        data-testid="studio-canvas-container"
      />

      {/* Floating "Back to car" Pill when Inspecting a Specific Part */}
      {selectedSpec && !experience.photo && (
        <div className="pointer-events-none absolute top-3 inset-x-0 z-20 flex justify-center px-4">
          <div
            data-testid="floating-inspect-banner"
            className="pointer-events-auto inline-flex flex-wrap items-center justify-center gap-2 pl-3 pr-2 py-1 rounded-lg bg-[#0d1016]/95 border border-[#e11d2a]/60 shadow-2xl text-xs text-white"
          >
            <span className="text-zinc-300">
              Inspecting:{' '}
              <strong className="font-display font-semibold text-white">
                {selectedSpec.plainName}
              </strong>
            </span>
            {selectedIsMechanical && (
              <span
                data-testid="floating-illustrative-badge"
                className="font-mono-tabular text-[10px] text-amber-300 bg-amber-500/15 border border-amber-400/35 px-1.5 py-0.5 rounded whitespace-nowrap"
              >
                Illustrative mechanical reconstruction
              </span>
            )}
            <button
              type="button"
              data-testid="floating-back-to-car-btn"
              onClick={() => {
                if (onBackToCar) {
                  onBackToCar();
                } else {
                  onSelectGroup(null);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#e11d2a] hover:bg-[#c81924] text-white font-semibold editorial-transition cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to car</span>
            </button>
          </div>
        </div>
      )}

      {/* On-Model Part Labels with Anchor Dots and Fine Leader Lines */}
      {showLabels && labelDensity !== 'off' && placedLabels.length > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          data-testid="on-model-labels-layer"
          data-active-label-count={placedLabels.length}
          data-label-density={labelDensity}
        >
          <svg
            className="w-full h-full"
            aria-hidden="true"
            data-testid="on-model-leader-svg"
          >
            {placedLabels.map((l) => (
              <g key={`leader-${l.nodeName}`}>
                <line
                  data-testid="on-model-leader-line"
                  data-leader-group={l.nodeName}
                  x1={l.anchorX}
                  y1={l.anchorY}
                  x2={l.labelX}
                  y2={l.labelY}
                  stroke={
                    l.isSelected
                      ? '#e11d2a'
                      : l.isIllustrativeReconstruction
                        ? 'rgba(251, 191, 36, 0.78)'
                        : l.state === 'moving'
                          ? 'rgba(244, 244, 246, 0.85)'
                          : 'rgba(244, 244, 246, 0.48)'
                  }
                  strokeWidth={l.isSelected ? 1.6 : 1}
                  strokeDasharray={l.state === 'moving' ? undefined : '2 2'}
                />
                <circle
                  cx={l.anchorX}
                  cy={l.anchorY}
                  r={l.isSelected ? 5.5 : 4}
                  fill="rgba(20, 21, 24, 0.85)"
                  stroke={
                    l.isSelected
                      ? '#e11d2a'
                      : l.isIllustrativeReconstruction
                        ? '#fbbf24'
                        : '#f4f4f6'
                  }
                  strokeWidth={1.25}
                />
                <circle
                  data-testid="on-model-anchor-dot"
                  data-anchor-group={l.nodeName}
                  cx={l.anchorX}
                  cy={l.anchorY}
                  r={l.isSelected ? 2.6 : 2}
                  fill={
                    l.isSelected || l.state === 'moving'
                      ? '#e11d2a'
                      : l.isIllustrativeReconstruction
                        ? '#fbbf24'
                        : '#f4f4f6'
                  }
                />
              </g>
            ))}
          </svg>

          {placedLabels.map((l) => (
            <button
              key={`label-${l.nodeName}`}
              type="button"
              data-testid="on-model-part-label"
              data-label-for={l.nodeName}
              data-label-group={l.nodeName}
              data-label-selected={String(l.isSelected)}
              data-label-illustrative={String(l.isIllustrativeReconstruction)}
              onClick={() => {
                if (l.isSelected) {
                  if (onBackToCar) {
                    onBackToCar();
                  } else {
                    onSelectGroup(null);
                  }
                } else {
                  onSelectGroup(l.nodeName);
                }
              }}
              style={{
                left: `${l.labelX}px`,
                top: `${l.labelY}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`pointer-events-auto absolute flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors shadow-lg cursor-pointer border ${
                l.isSelected
                  ? 'bg-[#e11d2a] text-white border-white/60 z-20'
                  : l.isIllustrativeReconstruction
                    ? 'bg-[#171510]/92 text-amber-100 border-amber-400/45 hover:border-amber-300/80'
                    : l.state === 'moving'
                      ? 'bg-[#1b1d24]/92 text-white border-[#e11d2a]/60 hover:bg-[#262a34]'
                      : 'bg-[#16181e]/88 text-zinc-200 border-white/15 hover:text-white hover:border-white/35'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  l.isSelected
                    ? 'bg-white'
                    : l.isIllustrativeReconstruction
                      ? 'bg-amber-400'
                      : l.state === 'moving'
                        ? 'bg-[#e11d2a]'
                        : 'bg-zinc-400'
                }`}
              />
              <span>{l.plainName}</span>
              {l.isIllustrativeReconstruction && (
                <span className="text-[9px] font-mono-tabular uppercase tracking-wider text-amber-300/90 bg-amber-500/15 px-1 rounded">
                  Illustrative
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
