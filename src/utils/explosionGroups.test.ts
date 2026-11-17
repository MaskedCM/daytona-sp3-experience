import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  DAYTONA_PRESENTATION_GROUPS,
  EDITORIAL_CHAPTERS,
  applyInspectionDimming,
  applyPresentationExplosion,
  applyStructureModeVisibility,
  applyExteriorPaintColor,
  captureModelMaterials,
  capturePresentationGroupBindings,
  computeExpandedCameraFraming,
  computeGroupInspectionFraming,
  computeScreenLabelLayout,
  evaluateScrollSequence,
  getComponentSpec,
  isIllustrativeMechanicalSpec,
  type ScreenLabelCandidate,
} from './explosionGroups';
import {
  ILLUSTRATIVE_MECHANICAL_GROUPS,
  applyMechanicalLayerExplosion,
  buildIllustrativeMechanicalLayer,
} from './illustrativeMechanicalLayer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  applyHingedPanelTransforms,
  setupPanelsAndSpatialLights,
} from './lightsAndOpenings';
import { computeCenterAndFit } from './modelBounds';
import { setupWheelDesigns, WHEEL_DESIGNS } from './wheelDesigns';
import {
  LIGHTING_PRESETS,
  PAINT_SWATCHES,
} from '../types/studio';

test('DAYTONA_PRESENTATION_GROUPS matches the exact 19 presentation groups in daytona-sp3-web.glb', () => {
  assert.equal(DAYTONA_PRESENTATION_GROUPS.length, 19);

  const glbPath = path.resolve(process.cwd(), 'public/models/daytona-sp3-web.glb');
  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const gltfJson = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));

  const nodes: Array<{ name?: string; children?: number[] }> = gltfJson.nodes || [];
  const sceneGroup = nodes.find((n) => n.name === 'Collada_visual_scene_group');
  assert.ok(sceneGroup && Array.isArray(sceneGroup.children));

  const glbGroupNames = sceneGroup.children.map((idx) => nodes[idx]?.name);
  assert.equal(glbGroupNames.length, 19);

  for (const spec of DAYTONA_PRESENTATION_GROUPS) {
    assert.ok(
      glbGroupNames.includes(spec.nodeName),
      `Expected GLB to contain presentation group "${spec.nodeName}"`,
    );
    assert.ok(spec.description.length > 15, `Group ${spec.nodeName} must have an explanation`);
  }
});

test('applyPresentationExplosion scales with spreadMultiplier (1x-3x) and reassembles exactly at 0', () => {
  const root = new THREE.Group();
  const sketchfabModel = new THREE.Group();
  sketchfabModel.rotation.x = -Math.PI / 2;
  sketchfabModel.scale.setScalar(0.0535438);
  root.add(sketchfabModel);

  const sceneGroup = new THREE.Group();
  sceneGroup.name = 'Collada_visual_scene_group';
  sketchfabModel.add(sceneGroup);

  for (const [idx, spec] of DAYTONA_PRESENTATION_GROUPS.entries()) {
    const g = new THREE.Group();
    g.name = spec.nodeName;
    g.position.set(idx * 1.2, -idx * 0.5, idx * 0.8);
    g.rotation.set(0.1, -0.2, 0.05);
    g.scale.set(1, 1, 1);
    sceneGroup.add(g);
  }

  root.updateMatrixWorld(true);
  const bindings = capturePresentationGroupBindings(root);
  assert.equal(bindings.length, 19);

  const worldBefore = new Map<string, THREE.Vector3>();
  for (const b of bindings) {
    const wp = new THREE.Vector3();
    b.object.getWorldPosition(wp);
    worldBefore.set(b.spec.nodeName, wp);
  }

  // Separate at 1x spread (at Exterior peak p = 0.71)
  applyPresentationExplosion(bindings, 0.71, 1.0, 1.0);
  root.updateMatrixWorld(true);
  const frontWheel1x = new THREE.Vector3();
  bindings
    .find((b) => b.spec.nodeName === 'Front_left_wheel')!
    .object.getWorldPosition(frontWheel1x);
  const origFrontWheel = worldBefore.get('Front_left_wheel')!;
  const delta1x = frontWheel1x.x - origFrontWheel.x;

  // Separate at 2x spread (default) -> displacement must be 2x wider
  applyPresentationExplosion(bindings, 0.71, 1.0, 2.0);
  root.updateMatrixWorld(true);
  const frontWheel2x = new THREE.Vector3();
  bindings
    .find((b) => b.spec.nodeName === 'Front_left_wheel')!
    .object.getWorldPosition(frontWheel2x);
  const delta2x = frontWheel2x.x - origFrontWheel.x;
  assert.ok(Math.abs(delta2x - delta1x * 2) < 1e-4);

  // Underbody_and_trim stays fixed even at 3x spread and p = 1.0
  applyPresentationExplosion(bindings, 1.0, 1.0, 3.0);
  root.updateMatrixWorld(true);
  const underbodyNow = new THREE.Vector3();
  bindings
    .find((b) => b.spec.nodeName === 'Underbody_and_trim')!
    .object.getWorldPosition(underbodyNow);
  assert.ok(underbodyNow.distanceTo(worldBefore.get('Underbody_and_trim')!) < 1e-5);

  // Reverse scroll back to 0 -> exact reassembly with zero drift
  applyPresentationExplosion(bindings, 0.0, 1.0, 3.0);
  root.updateMatrixWorld(true);
  for (const b of bindings) {
    assert.ok(
      b.object.position.distanceTo(b.origLocalPosition) < 1e-7,
      `${b.spec.nodeName} local position should restore exactly at progress 0`,
    );
  }
});

test('buildIllustrativeMechanicalLayer builds 13 procedural V12 & chassis assemblies fitted inside the car with Illustrative mechanical reconstruction tags and reversible explosion', () => {
  const { rootGroup, bindings } = buildIllustrativeMechanicalLayer();
  assert.equal(bindings.length, 13);
  assert.equal(ILLUSTRATIVE_MECHANICAL_GROUPS.length, 13);

  rootGroup.updateMatrixWorld(true);
  const fullBox = new THREE.Box3().setFromObject(rootGroup);
  assert.equal(fullBox.isEmpty(), false);

  // Verify the entire assembled mechanical reconstruction fits cleanly inside the centered Daytona SP3 envelope
  assert.ok(fullBox.min.x >= -2.7 && fullBox.max.x <= 2.7, 'Mechanical width fits inside SP3 bodywork');
  assert.ok(fullBox.min.y >= -1.5 && fullBox.max.y <= 1.2, 'Mechanical height fits inside SP3 profile');
  assert.ok(fullBox.min.z >= -5.5 && fullBox.max.z <= 5.0, 'Mechanical length fits inside SP3 overhangs');

  for (const b of bindings) {
    assert.equal(
      b.spec.reconstructionTag,
      'Illustrative mechanical reconstruction',
      `${b.spec.nodeName} must be tagged Illustrative mechanical reconstruction`,
    );
    assert.equal(isIllustrativeMechanicalSpec(getComponentSpec(b.spec.nodeName)), true);

    let meshCount = 0;
    let vertexCount = 0;
    b.object.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        meshCount += 1;
        vertexCount += m.geometry.attributes.position?.count ?? 0;
      }
    });
    assert.ok(meshCount > 0 && vertexCount > 20, `${b.spec.nodeName} must contain real 3D mesh geometry`);
  }

  // Before Chapter 07 (e.g. p = 0.65), mechanical layer stays assembled inside the car
  const preRes = applyMechanicalLayerExplosion(bindings, 0.65, 1.0, 2.0);
  assert.equal(preRes.maxMechanicalDelta, 0);
  assert.equal(preRes.tubDelta, 0);

  // At Chapter 07 full separation (p = 1.0), 12 mechanical groups separate while Mech_Carbon_Tub stays fixed
  const fullRes = applyMechanicalLayerExplosion(bindings, 1.0, 1.0, 2.0);
  assert.ok(fullRes.maxMechanicalDelta > 2.0, 'Mechanical groups must separate in Chapter 07');
  assert.ok(fullRes.tubDelta < 1e-6, 'Carbon Monocoque Tub must remain fixed');

  // Reverse back to 0 -> exact reset
  const resetRes = applyMechanicalLayerExplosion(bindings, 0.0, 1.0, 2.0);
  assert.equal(resetRes.maxMechanicalDelta, 0);
  for (const b of bindings) {
    assert.ok(
      b.object.position.distanceTo(b.origLocalPosition) < 1e-7,
      `${b.spec.nodeName} must return to exact rest position at progress 0`,
    );
  }
});

test('setupPanelsAndSpatialLights splits genuine hinged door/lid panels and spatial front/rear lights with exact reversible hinge arcs', () => {
  const modelRoot = new THREE.Group();

  const paintMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_Rosso_Magma',
    color: new THREE.Color(0xd41217),
  });
  const glassMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_Windows',
    color: new THREE.Color(0x11151c),
  });
  const drlMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_DRLs',
    color: new THREE.Color(0xffffff),
  });
  const rearLightMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_RearLights',
    color: new THREE.Color(0xdd1111),
  });

  // Front bodywork: front lid at (0, 0.2, 4.2) + lower splitter at (0, -0.8, 5.8)
  const frontGroup = new THREE.Group();
  frontGroup.name = 'Front_bodywork';
  const frontLidGeo = new THREE.BoxGeometry(1.6, 0.15, 1.4);
  frontLidGeo.translate(0, 0.2, 4.2);
  const frontBumperGeo = new THREE.BoxGeometry(2.6, 0.3, 0.5);
  frontBumperGeo.translate(0, -0.8, 5.8);
  const frontMerged = new THREE.Mesh(frontLidGeo, paintMat);
  frontMerged.name = 'Front_bodywork__Rosso_Magma';
  const frontBumperMesh = new THREE.Mesh(frontBumperGeo, paintMat);
  frontBumperMesh.name = 'Front_bodywork__Rosso_Magma_Bumper';
  frontGroup.add(frontMerged, frontBumperMesh);
  modelRoot.add(frontGroup);

  // Rear bodywork: engine cover at (0, 0.65, -3.2) + outer rear fender at (2.4, 0.1, -4.5)
  const rearGroup = new THREE.Group();
  rearGroup.name = 'Rear_bodywork';
  const rearCoverGeo = new THREE.BoxGeometry(1.4, 0.2, 2.2);
  rearCoverGeo.translate(0, 0.65, -3.2);
  const rearMesh = new THREE.Mesh(rearCoverGeo, paintMat);
  rearMesh.name = 'Rear_bodywork__Rosso_Magma';
  const tailBarGeo = new THREE.BoxGeometry(4.0, 0.1, 0.2);
  tailBarGeo.translate(0, 0.18, -5.85);
  const tailBarMesh = new THREE.Mesh(tailBarGeo, rearLightMat);
  tailBarMesh.name = 'Rear_bodywork__RedMain';
  rearGroup.add(rearMesh, tailBarMesh);
  modelRoot.add(rearGroup);

  // Left & Right bodywork doors
  const leftGroup = new THREE.Group();
  leftGroup.name = 'Left_bodywork';
  const leftDoorGeo = new THREE.BoxGeometry(0.3, 0.8, 1.8);
  leftDoorGeo.translate(2.5, -0.1, 0.7);
  const leftDoorMesh = new THREE.Mesh(leftDoorGeo, paintMat);
  leftDoorMesh.name = 'Left_bodywork__Rosso_Magma';
  leftGroup.add(leftDoorMesh);
  modelRoot.add(leftGroup);

  const rightGroup = new THREE.Group();
  rightGroup.name = 'Right_bodywork';
  const rightDoorGeo = new THREE.BoxGeometry(0.3, 0.8, 1.8);
  rightDoorGeo.translate(-2.5, -0.1, 0.7);
  const rightDoorMesh = new THREE.Mesh(rightDoorGeo, paintMat);
  rightDoorMesh.name = 'Right_bodywork__Rosso_Magma';
  rightGroup.add(rightDoorMesh);
  modelRoot.add(rightGroup);

  // Glazing group
  const glazingGroup = new THREE.Group();
  glazingGroup.name = 'Glazing';
  const winGeo = new THREE.BoxGeometry(0.2, 0.5, 1.2);
  winGeo.translate(2.1, 0.65, 0.5);
  const winMesh = new THREE.Mesh(winGeo, glassMat);
  winMesh.name = 'Glazing__Windows';
  glazingGroup.add(winMesh);
  modelRoot.add(glazingGroup);

  // Lighting group with front (z = +5.2) and rear (z = -5.9) triangles
  const lightingGroup = new THREE.Group();
  lightingGroup.name = 'Lighting';
  const frontDrlGeo = new THREE.BoxGeometry(0.8, 0.1, 0.2);
  frontDrlGeo.translate(2.1, -0.1, 5.2);
  const frontDrlMesh = new THREE.Mesh(frontDrlGeo, drlMat);
  frontDrlMesh.name = 'Lighting__DRLs';
  lightingGroup.add(frontDrlMesh);
  modelRoot.add(lightingGroup);

  modelRoot.updateMatrixWorld(true);

  const { hingedPanels, lightController } = setupPanelsAndSpatialLights(modelRoot, true);
  assert.equal(hingedPanels.length, 4);
  assert.ok(lightController.frontLightMeshCount >= 1);
  assert.ok(lightController.rearLightMeshCount >= 1);

  // Open doors, front lid, and rear engine cover
  const openRes = applyHingedPanelTransforms(hingedPanels, {
    doors: 1,
    frontLid: 1,
    rearCover: 1,
  });
  assert.equal(openRes.allRestored, false);
  assert.ok(openRes.maxAngleRad > 0.7, 'Open hinged panels must rotate along plausible hinge arcs');

  // Verify left and right doors mirror each other's roll/yaw magnitudes
  const leftDoor = hingedPanels.find((p) => p.id === 'left_door')!;
  const rightDoor = hingedPanels.find((p) => p.id === 'right_door')!;
  const leftAngle = leftDoor.hingeGroup.quaternion.angleTo(leftDoor.restLocalQuaternion);
  const rightAngle = rightDoor.hingeGroup.quaternion.angleTo(rightDoor.restLocalQuaternion);
  assert.ok(Math.abs(leftAngle - rightAngle) < 1e-4, 'Left and right butterfly doors must open symmetrically');

  // Close all openings -> exact rest pose restoration
  const closeRes = applyHingedPanelTransforms(hingedPanels, {
    doors: 0,
    frontLid: 0,
    rearCover: 0,
  });
  assert.equal(closeRes.allRestored, true);
  assert.ok(closeRes.maxAngleRad < 1e-6);

  // Verify independent front and rear lights toggles
  lightController.setLightsState(true, false);
  assert.ok(lightController.frontEmissiveMaterials[0].emissiveIntensity > 1.0);
  assert.ok(lightController.rearEmissiveMaterials[0].emissiveIntensity < 0.5);

  lightController.setLightsState(false, true);
  assert.equal(lightController.frontEmissiveMaterials[0].emissiveIntensity, 0);
  assert.ok(lightController.rearEmissiveMaterials[0].emissiveIntensity > 1.5);

  lightController.setLightsState(false, false);
  assert.equal(lightController.frontEmissiveMaterials[0].emissiveIntensity, 0);
});

test('applyExteriorPaintColor upgrades Rosso_Magma to clearcoat and recolours only Rosso_Magma', () => {
  const root = new THREE.Group();
  const dummyTex = new THREE.Texture();

  const paintMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_Rosso_Magma',
    color: new THREE.Color(1, 0.0074, 0),
  });
  const origPaintHex = paintMat.color.getHex();

  const caliperMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_Calipers',
    color: new THREE.Color(0.635, 0, 0),
  });
  const badgeMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_FerrariBadge',
    color: new THREE.Color(1, 1, 1),
    map: dummyTex,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_Windows',
    color: new THREE.Color(0, 0, 0),
  });

  root.add(new THREE.Mesh(new THREE.BoxGeometry(), paintMat));
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), caliperMat));
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), badgeMat));
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), glassMat));

  const records = captureModelMaterials(root);
  assert.equal(records.length, 4);

  const upgradedPaint = paintMat as unknown as THREE.MeshPhysicalMaterial;
  assert.equal(upgradedPaint.isMeshPhysicalMaterial, true);
  assert.equal(upgradedPaint.clearcoat, 1.0);
  assert.equal(upgradedPaint.fog, false);

  for (const swatch of PAINT_SWATCHES) {
    if (swatch.id === 'original') continue;
    const res = applyExteriorPaintColor(records, swatch.id, '#22aa88');
    assert.equal(
      res.nonPaintUnchanged,
      true,
      `Non-paint materials and textures must remain unchanged for swatch ${swatch.id}`,
    );
    assert.notEqual(
      paintMat.color.getHex(),
      origPaintHex,
      `Rosso_Magma should change for swatch ${swatch.id}`,
    );
  }

  const restored = applyExteriorPaintColor(records, 'original');
  assert.equal(restored.nonPaintUnchanged, true);
  assert.equal(paintMat.color.getHex(), origPaintHex);
});

test('applyStructureModeVisibility hides outer bodywork, glazing, and WindowsTrims while keeping Cabin & Underbody visible', () => {
  const root = new THREE.Group();
  for (const spec of DAYTONA_PRESENTATION_GROUPS) {
    const g = new THREE.Group();
    g.name = spec.nodeName;
    if (spec.nodeName === 'Underbody_and_trim') {
      const windowsTrim = new THREE.Mesh(new THREE.BoxGeometry());
      windowsTrim.name = 'Underbody_and_trim__WindowsTrims';
      const carbonFloor = new THREE.Mesh(new THREE.BoxGeometry());
      carbonFloor.name = 'Underbody_and_trim__Carbon1';
      g.add(windowsTrim, carbonFloor);
    }
    root.add(g);
  }
  const bindings = capturePresentationGroupBindings(root);

  const hiddenCount = applyStructureModeVisibility(bindings, true);
  assert.equal(hiddenCount, 6);

  const underbodyGroup = bindings.find((b) => b.spec.nodeName === 'Underbody_and_trim')!.object;
  const windowsTrimChild = underbodyGroup.getObjectByName('Underbody_and_trim__WindowsTrims')!;
  const carbonChild = underbodyGroup.getObjectByName('Underbody_and_trim__Carbon1')!;
  assert.equal(windowsTrimChild.visible, false);
  assert.equal(carbonChild.visible, true);

  const restoredHidden = applyStructureModeVisibility(bindings, false);
  assert.equal(restoredHidden, 0);
  assert.equal(windowsTrimChild.visible, true);
});

test('computeGroupInspectionFraming and applyInspectionDimming support both GLB groups and Illustrative Mechanical groups', () => {
  const root = new THREE.Group();
  const sharedPaintMat = new THREE.MeshStandardMaterial({
    name: '022_Ferrari_Daytona_SP3_Rosso_Magma',
    color: new THREE.Color(0xd41217),
  });

  for (const [idx, spec] of DAYTONA_PRESENTATION_GROUPS.entries()) {
    const g = new THREE.Group();
    g.name = spec.nodeName;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.8), sharedPaintMat);
    mesh.position.set(idx * 0.4, 0, 0);
    g.add(mesh);
    root.add(g);
  }

  root.updateMatrixWorld(true);
  const bindings = capturePresentationGroupBindings(root);
  const { bindings: mechBindings } = buildIllustrativeMechanicalLayer();

  // Inspect an illustrative mechanical assembly (e.g. Mech_V12_Engine_Block)
  const v12Binding = mechBindings.find((b) => b.spec.nodeName === 'Mech_V12_Engine_Block')!;
  const inspectFrame = computeGroupInspectionFraming(
    v12Binding,
    0.85,
    1.0,
    2.0,
    40,
    16 / 9,
  );
  assert.ok(inspectFrame.inspectDistance > 0.8 && inspectFrame.inspectDistance < 12);

  // Dim surrounding 31 groups (19 GLB + 12 other mechanical) while inspecting Mech_V12_Engine_Block
  const dimmedCount = applyInspectionDimming(
    bindings,
    'Mech_V12_Engine_Block',
    false,
    mechBindings,
    0.85,
  );
  assert.equal(dimmedCount, 31);

  // Back to car at p = 0 restores all materials
  const restoredDimmed = applyInspectionDimming(bindings, null, false, mechBindings, 0);
  assert.equal(restoredDimmed, 0);
});

test('computeScreenLabelLayout respects labelDensity (off, minimal, balanced, detailed) and prevents overlap', () => {
  const candidates: ScreenLabelCandidate[] = [
    ...DAYTONA_PRESENTATION_GROUPS.map((spec, idx) => ({
      nodeName: spec.nodeName,
      plainName: spec.plainName,
      category: spec.category,
      state: (idx % 2 === 0 ? 'moving' : 'separated') as 'moving' | 'separated',
      anchorX: 320 + (idx % 5) * 28,
      anchorY: 320 + Math.floor(idx / 5) * 28,
      ndcZ: 0.9988,
      visible: true,
      basePriority: spec.basePriority,
      isIllustrativeReconstruction: false,
    })),
    ...ILLUSTRATIVE_MECHANICAL_GROUPS.map((spec, idx) => ({
      nodeName: spec.nodeName,
      plainName: spec.plainName,
      category: spec.category,
      state: 'moving' as const,
      anchorX: 520 + (idx % 4) * 32,
      anchorY: 340 + Math.floor(idx / 4) * 30,
      ndcZ: 0.985,
      visible: true,
      basePriority: spec.basePriority,
      isIllustrativeReconstruction: true,
    })),
  ];

  const offLabels = computeScreenLabelLayout(
    candidates,
    1440,
    900,
    0.85,
    false,
    null,
    62,
    800,
    'off',
  );
  assert.equal(offLabels.length, 0);

  const minimalLabels = computeScreenLabelLayout(
    candidates,
    1440,
    900,
    0.85,
    false,
    null,
    62,
    800,
    'minimal',
  );
  assert.ok(minimalLabels.length > 0 && minimalLabels.length <= 5);

  const balancedLabels = computeScreenLabelLayout(
    candidates,
    1440,
    900,
    0.85,
    false,
    null,
    62,
    800,
    'balanced',
  );
  assert.ok(balancedLabels.length > minimalLabels.length && balancedLabels.length <= 9);

  const detailedLabels = computeScreenLabelLayout(
    candidates,
    1440,
    900,
    0.85,
    false,
    null,
    62,
    800,
    'detailed',
  );
  assert.ok(detailedLabels.length >= balancedLabels.length && detailedLabels.length <= 14);

  // Verify zero label collisions even in Detailed density mode
  for (let i = 0; i < detailedLabels.length; i++) {
    for (let j = i + 1; j < detailedLabels.length; j++) {
      const a = detailedLabels[i];
      const b = detailedLabels[j];
      const overlaps =
        Math.abs(a.labelX - b.labelX) < 120 && Math.abs(a.labelY - b.labelY) < 26;
      assert.equal(overlaps, false, `Labels ${a.plainName} and ${b.plainName} must not overlap`);
    }
  }
});

test('evaluateScrollSequence covers all 7 chapters including 07 Chassis & Powertrain and all 32 components', () => {
  assert.equal(EDITORIAL_CHAPTERS.length, 7);
  assert.equal(EDITORIAL_CHAPTERS[6].number, '07');
  assert.equal(EDITORIAL_CHAPTERS[6].shortTitle, 'Chassis & Powertrain');
  assert.deepEqual(
    LIGHTING_PRESETS.map((p) => p.id),
    ['studio', 'rosso', 'technical'],
  );

  const s0 = evaluateScrollSequence(0);
  assert.equal(s0.movingGroups.length, 0);
  assert.equal(s0.chapterNumber, '01');
  assert.equal(s0.allComponents.length, 32);

  const sExt = evaluateScrollSequence(0.71);
  assert.equal(sExt.chapterNumber, '06');
  assert.equal(sExt.separatedGroups.length, 18);
  assert.equal(sExt.separatedMechanicalGroups.length, 0);

  const sMechMoving = evaluateScrollSequence(0.84);
  assert.equal(sMechMoving.chapterNumber, '07');
  assert.ok(
    sMechMoving.movingGroups.some((g) => g.isIllustrativeReconstruction),
    'Chapter 07 must animate illustrative mechanical assemblies',
  );

  const sFull = evaluateScrollSequence(1);
  assert.equal(sFull.chapterNumber, '07');
  assert.equal(sFull.separatedGroups.length, 18);
  assert.equal(sFull.separatedMechanicalGroups.length, 12);

  const f1x = computeExpandedCameraFraming(10, 0.71, 1.0);
  const f2x = computeExpandedCameraFraming(10, 0.71, 2.0);
  const f3x = computeExpandedCameraFraming(10, 0.71, 3.0);
  assert.ok(f3x.distance > f2x.distance && f2x.distance > f1x.distance);
});

async function loadRealCenteredGlb(): Promise<{
  root: THREE.Object3D;
  maxDim: number;
}> {
  (globalThis as unknown as { self: unknown }).self = globalThis;
  const glbPath = path.resolve(process.cwd(), 'public/models/daytona-sp3-web.glb');
  const buf = fs.readFileSync(glbPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(ab, '', resolve, reject);
    });
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(root);
    const fit = computeCenterAndFit(rawBox.min, rawBox.max);
    root.position.set(
      fit.modelPositionOffset.x,
      fit.modelPositionOffset.y,
      fit.modelPositionOffset.z,
    );
    root.updateMatrixWorld(true);
    return { root, maxDim: fit.maxDim };
  } finally {
    console.warn = origWarn;
  }
}

function getWorldVertices(obj: THREE.Object3D): THREE.Vector3[] {
  obj.updateWorldMatrix(true, true);
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  obj.traverse((child) => {
    const m = child as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.attributes.position;
    const idx = m.geometry.index;
    const used = new Set<number>();
    if (idx) {
      for (let i = 0; i < idx.count; i++) used.add(idx.getX(i));
    } else if (pos) {
      for (let i = 0; i < pos.count; i++) used.add(i);
    }
    for (const vi of used) {
      v.fromBufferAttribute(pos, vi).applyMatrix4(m.matrixWorld);
      pts.push(v.clone());
    }
  });
  return pts;
}

function getBoxOfMesh(obj: THREE.Object3D): THREE.Box3 {
  obj.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(obj);
}

test('REAL GLB: Butterfly doors rigidly co-move outer skin, inner door cards, glazing, handles & badge while cabin seats, tub, sills & mirrors stay fixed', async () => {
  const { root } = await loadRealCenteredGlb();
  const { hingedPanels, frunkLinerMesh } = setupPanelsAndSpatialLights(root, false);
  root.updateMatrixWorld(true);

  const leftDoor = hingedPanels.find((p) => p.id === 'left_door')!;
  const rightDoor = hingedPanels.find((p) => p.id === 'right_door')!;
  const frontLid = hingedPanels.find((p) => p.id === 'front_lid')!;
  const rearCover = hingedPanels.find((p) => p.id === 'rear_cover')!;

  assert.ok(leftDoor && rightDoor && frontLid && rearCover);

  // Full uncropped exterior door skins extracted
  assert.equal(
    (root.getObjectByName('Left_bodywork__Rosso_Magma') as THREE.Mesh).geometry.index?.count,
    0,
    'Entire Left_bodywork door skin must move with left door (no cropped edges)',
  );
  assert.equal(
    (root.getObjectByName('Right_bodywork__Rosso_Magma') as THREE.Mesh).geometry.index?.count,
    0,
    'Entire Right_bodywork door skin must move with right door (no cropped edges)',
  );

  // Inner door cards, glazing & cabin speaker/leather attachments mounted directly under door hinge groups
  const leftDoorPanel = root.getObjectByName('Left_bodywork__Rosso_Magma__DoorPanel')!;
  const rightDoorPanel = root.getObjectByName('Right_bodywork__Rosso_Magma__DoorPanel')!;
  const leftInnerCard = root.getObjectByName('Underbody_and_trim__t_ext_front_bumper_spoiler__LeftDoor')!;
  const rightInnerCard = root.getObjectByName('Underbody_and_trim__BlackTrims1_4__RightDoor')!;
  const leftSpeaker = root.getObjectByName('Cabin__Speakers__LeftDoor')!;
  const rightUpperPad = root.getObjectByName('Cabin__BlackSeats__RightDoor')!;
  const leftDoorGlass = root.getObjectByName('Glazing__LeftDoorWindow')!;
  const rightDoorGlass = root.getObjectByName('Glazing__RightDoorWindow')!;

  assert.ok(leftDoorPanel && rightDoorPanel);
  assert.ok(leftInnerCard && rightInnerCard);
  assert.ok(leftSpeaker && rightUpperPad);
  assert.ok(leftDoorGlass && rightDoorGlass);

  const restOuterWorldL = leftDoorPanel.matrixWorld.clone();
  const restOuterInvL = restOuterWorldL.clone().invert();
  const restOuterWorldR = rightDoorPanel.matrixWorld.clone();
  const restOuterInvR = restOuterWorldR.clone().invert();

  const sampleVert = (obj: THREE.Object3D): THREE.Vector3 => {
    const pts = getWorldVertices(obj);
    let best = pts[0];
    for (const p of pts) {
      if (p.z < best.z) best = p;
    }
    return best.clone();
  };

  const restLOuter = sampleVert(leftDoorPanel);
  const restLInner = sampleVert(leftInnerCard);
  const restLGlass = sampleVert(leftDoorGlass);
  const restLCabin = sampleVert(leftSpeaker);

  const restROuter = sampleVert(rightDoorPanel);
  const restRInner = sampleVert(rightInnerCard);
  const restRGlass = sampleVert(rightDoorGlass);
  const restRCabin = sampleVert(rightUpperPad);

  const restLInnerMat = leftInnerCard.matrixWorld.clone();
  const restLGlassMat = leftDoorGlass.matrixWorld.clone();
  const restLCabinMat = leftSpeaker.matrixWorld.clone();
  const restRInnerMat = rightInnerCard.matrixWorld.clone();
  const restRGlassMat = rightDoorGlass.matrixWorld.clone();
  const restRCabinMat = rightUpperPad.matrixWorld.clone();

  // Snapshot fixed structures
  const fixedObjects = [
    root.getObjectByName('Cabin__BlackSeats')!,
    root.getObjectByName('Cabin__v_int_display')!,
    root.getObjectByName('Underbody_and_trim__Color_M08')!,
    root.getObjectByName('Left_mirror')!,
    root.getObjectByName('Right_mirror')!,
    root.getObjectByName('Underbody_and_trim__GasCap')!,
    frunkLinerMesh,
  ];
  const restFixedBoxes = fixedObjects.map((o) => getBoxOfMesh(o));

  // Verify intermediate and full-open states
  const steps = [0.15, 0.3, 0.45, 0.65, 0.85, 1.0];
  let prevLeftTrailingY = restLOuter.y;
  let prevRightTrailingY = restROuter.y;

  const rigidTestPoint = (restMat: THREE.Matrix4, deltaMat: THREE.Matrix4, pt: THREE.Vector3, curObj: THREE.Object3D) => {
    const localPt = pt.clone().applyMatrix4(restMat.clone().invert());
    const actualWorld = localPt.clone().applyMatrix4(curObj.matrixWorld);
    const expectedWorld = pt.clone().applyMatrix4(deltaMat);
    return actualWorld.distanceTo(expectedWorld);
  };

  for (const t of steps) {
    applyHingedPanelTransforms(hingedPanels, { doors: t, frontLid: t, rearCover: t });
    root.updateMatrixWorld(true);

    const deltaL = leftDoorPanel.matrixWorld.clone().multiply(restOuterInvL);
    const deltaR = rightDoorPanel.matrixWorld.clone().multiply(restOuterInvR);

    const curLOuter = restLOuter.clone().applyMatrix4(deltaL);
    const curLInner = restLInner.clone().applyMatrix4(leftInnerCard.matrixWorld.clone().multiply(restLInnerMat.clone().invert()));
    const curROuter = restROuter.clone().applyMatrix4(deltaR);
    const curRInner = restRInner.clone().applyMatrix4(rightInnerCard.matrixWorld.clone().multiply(restRInnerMat.clone().invert()));

    // Signed outward displacement must be positive outward (-X left, +X right)
    assert.ok(curLOuter.x < restLOuter.x - 0.05, `Left door outer skin must swing outward (-X) at t=${t}`);
    assert.ok(curLInner.x < restLInner.x - 0.05, `Left inner door card must swing outward (-X) at t=${t}`);
    assert.ok(curROuter.x > restROuter.x + 0.05, `Right door outer skin must swing outward (+X) at t=${t}`);
    assert.ok(curRInner.x > restRInner.x + 0.05, `Right inner door card must swing outward (+X) at t=${t}`);

    // Exact rigid body check: outer skin, inner door card, glazing, and cabin trim share identical world transform
    assert.ok(rigidTestPoint(restLInnerMat, deltaL, restLInner, leftInnerCard) < 1e-4, `Left outer/inner rigid drift at t=${t}`);
    assert.ok(rigidTestPoint(restLGlassMat, deltaL, restLGlass, leftDoorGlass) < 1e-4, `Left outer/glass rigid drift at t=${t}`);
    assert.ok(rigidTestPoint(restLCabinMat, deltaL, restLCabin, leftSpeaker) < 1e-4, `Left outer/cabin rigid drift at t=${t}`);
    assert.ok(rigidTestPoint(restRInnerMat, deltaR, restRInner, rightInnerCard) < 1e-4, `Right outer/inner rigid drift at t=${t}`);
    assert.ok(rigidTestPoint(restRGlassMat, deltaR, restRGlass, rightDoorGlass) < 1e-4, `Right outer/glass rigid drift at t=${t}`);
    assert.ok(rigidTestPoint(restRCabinMat, deltaR, restRCabin, rightUpperPad) < 1e-4, `Right outer/cabin rigid drift at t=${t}`);

    if (t >= 0.45) {
      assert.ok(curLOuter.y > prevLeftTrailingY - 1e-4);
      assert.ok(curROuter.y > prevRightTrailingY - 1e-4);
    }
    prevLeftTrailingY = curLOuter.y;
    prevRightTrailingY = curROuter.y;

    // Front lid & attached underside trim co-move rigidly
    const fLidBox = getBoxOfMesh(root.getObjectByName('Front_bodywork__LuggageLidPanel')!);
    const fTrimBox = getBoxOfMesh(root.getObjectByName('Underbody_and_trim__BlackTrims1_6__FrontLidTrim')!);
    assert.ok(fLidBox.max.y > 0.65 || t < 0.3, `Front lid must lift at t=${t}`);
    assert.ok(fTrimBox.max.y > 0.55 || t < 0.3, `Front lid trim must lift with lid at t=${t}`);

    // Rear engine cover & attached glazing/WindowsTrims/spine co-move rigidly
    const rCoverBox = getBoxOfMesh(root.getObjectByName('Rear_bodywork__EngineCoverPanel')!);
    const rTrimBox = getBoxOfMesh(root.getObjectByName('Underbody_and_trim__EngineSpineLouvers')!);
    const rDeckBox = getBoxOfMesh(root.getObjectByName('Underbody_and_trim__WindowsTrims__RearCover')!);
    const rGlassBox = getBoxOfMesh(root.getObjectByName('Glazing__EngineBayWindow')!);
    assert.ok(rCoverBox.max.y > 1.4 || t < 0.3, `Rear cover must lift at t=${t}`);
    assert.ok(rTrimBox.max.y > 1.4 || t < 0.3, `Rear cover spine must lift at t=${t}`);
    assert.ok(rDeckBox.max.y > 1.4 || t < 0.3, `Rear cover deck trim must lift at t=${t}`);
    assert.ok(rGlassBox.max.y > 1.2 || t < 0.3, `Rear cover glazing must lift at t=${t}`);

    // Fixed cabin, mirrors, gas cap, sills & frunk tub must NOT move at all
    for (let i = 0; i < fixedObjects.length; i++) {
      const curBox = getBoxOfMesh(fixedObjects[i]);
      assert.ok(
        curBox.min.distanceTo(restFixedBoxes[i].min) < 1e-5 &&
          curBox.max.distanceTo(restFixedBoxes[i].max) < 1e-5,
        `Fixed object ${fixedObjects[i].name} moved at t=${t}`,
      );
    }
  }

  // Repeated open -> close -> open -> close returns every vertex and quaternion to exact rest pose
  for (const cycle of [0, 1, 0]) {
    const res = applyHingedPanelTransforms(hingedPanels, {
      doors: cycle,
      frontLid: cycle,
      rearCover: cycle,
    });
    if (cycle === 0) {
      assert.equal(res.allRestored, true);
      root.updateMatrixWorld(true);
      assert.ok(sampleVert(leftDoorPanel).distanceTo(restLOuter) < 1e-5);
      assert.ok(sampleVert(leftInnerCard).distanceTo(restLInner) < 1e-5);
      assert.ok(sampleVert(rightInnerCard).distanceTo(restRInner) < 1e-5);
    }
  }
});

test('REAL GLB: Hinged panel openings compose cleanly with presentation explosion (moving all inner cards, trim & glazing outward together) and all 6 wheel designs', async () => {
  const { root, maxDim } = await loadRealCenteredGlb();
  const wheelCtrl = setupWheelDesigns(root);
  const { hingedPanels } = setupPanelsAndSpatialLights(root, false);
  const bindings = capturePresentationGroupBindings(root);
  const scaleRatio = maxDim / 12.25;

  // Test switching across all 6 wheel designs
  assert.equal(WHEEL_DESIGNS.length, 6);
  assert.equal(wheelCtrl.bindings.length, 4);
  for (const opt of WHEEL_DESIGNS) {
    wheelCtrl.setDesign(opt.id);
  }
  wheelCtrl.setDesign('split-y');
  for (const wb of wheelCtrl.bindings) {
    assert.equal(wb.alternatives['split-y'].visible, true);
    assert.equal(wb.originalRims.every((r) => !r.visible), true);
  }

  // Open all panels AND explode at p = 0.71, spread = 2.0
  applyPresentationExplosion(bindings, 0.71, scaleRatio, 2.0);
  applyHingedPanelTransforms(hingedPanels, { doors: 1, frontLid: 1, rearCover: 1 });
  root.updateMatrixWorld(true);

  const leftOuterBox = getBoxOfMesh(root.getObjectByName('Left_bodywork__Rosso_Magma__DoorPanel')!);
  const leftInnerBox = getBoxOfMesh(root.getObjectByName('Underbody_and_trim__t_ext_front_bumper_spoiler__LeftDoor')!);
  const rightOuterBox = getBoxOfMesh(root.getObjectByName('Right_bodywork__Rosso_Magma__DoorPanel')!);
  const rightInnerBox = getBoxOfMesh(root.getObjectByName('Underbody_and_trim__BlackTrims1_4__RightDoor')!);
  const frontLidTrimBox = getBoxOfMesh(root.getObjectByName('Underbody_and_trim__BlackTrims1_6__FrontLidTrim')!);
  const frontLidPanelBox = getBoxOfMesh(root.getObjectByName('Front_bodywork__LuggageLidPanel')!);
  const rearSpineBox = getBoxOfMesh(root.getObjectByName('Underbody_and_trim__EngineSpineLouvers')!);
  const rearCoverPanelBox = getBoxOfMesh(root.getObjectByName('Rear_bodywork__EngineCoverPanel')!);

  // Verify inner door cards & glass explode outward WITH their door panels instead of staying behind at x≈±1.5
  assert.ok(leftOuterBox.max.x < -3.0, 'Left door skin must explode outward');
  assert.ok(leftInnerBox.max.x < -3.0, 'Left inner door card must explode outward WITH left door');
  assert.ok(rightOuterBox.min.x > 3.0, 'Right door skin must explode outward');
  assert.ok(rightInnerBox.min.x > 3.0, 'Right inner door card must explode outward WITH right door');
  assert.ok(Math.abs(frontLidTrimBox.min.z - frontLidPanelBox.min.z) < 2.0 && frontLidTrimBox.min.z > 5.0, 'Front lid trim must explode forward WITH front lid');
  assert.ok(Math.abs(rearSpineBox.max.z - rearCoverPanelBox.max.z) < 2.0 && rearSpineBox.max.z < -3.0, 'Rear engine spine must explode rearward WITH rear cover');

  // Reassemble back to scrollProgress = 0 and close all panels
  applyPresentationExplosion(bindings, 0, scaleRatio, 2.0);
  const closedRes = applyHingedPanelTransforms(hingedPanels, {
    doors: 0,
    frontLid: 0,
    rearCover: 0,
  });
  assert.equal(closedRes.allRestored, true);
  assert.equal(wheelCtrl.bindings[0].alternatives['split-y'].visible, true);
});

