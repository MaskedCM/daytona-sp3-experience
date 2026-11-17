import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeCenterAndFit,
  computePresetCameraPosition,
  validateGlbBuffer,
  formatFileSize,
  formatCount,
} from './modelBounds';
import {
  DEFAULT_HDRI_URL,
  DEFAULT_MODEL_URL,
  HDRI_CREDIT,
  MODEL_CREDIT,
} from '../types/studio';

test('computeCenterAndFit centers asymmetric Daytona SP3 bounds at origin and frames ~80% viewport width', () => {
  // Typical Ferrari Daytona SP3 bounding box in meters (4.68m long, 2.05m wide, 1.14m high)
  const boxMin = { x: -0.95, y: 0.02, z: -2.14 };
  const boxMax = { x: 1.10, y: 1.16, z: 2.54 };

  const fit = computeCenterAndFit(boxMin, boxMax, 40, 16 / 9, 1.25);

  assert.ok(Math.abs(fit.size.x - 2.05) < 1e-6);
  assert.ok(Math.abs(fit.size.y - 1.14) < 1e-6);
  assert.ok(Math.abs(fit.size.z - 4.68) < 1e-6);
  assert.ok(Math.abs(fit.maxDim - 4.68) < 1e-6);

  // Applying modelPositionOffset to center brings it to (0, 0, 0)
  assert.ok(Math.abs(fit.center.x + fit.modelPositionOffset.x) < 1e-6);
  assert.ok(Math.abs(fit.center.y + fit.modelPositionOffset.y) < 1e-6);
  assert.ok(Math.abs(fit.center.z + fit.modelPositionOffset.z) < 1e-6);

  // Floor sits right at bottom of centered car (-height / 2)
  assert.ok(Math.abs(fit.floorY - -0.57) < 1e-6);

  // Camera distance must be positive, outside bounding radius, and frame ~80% of horizontal frustum
  assert.ok(fit.fitDistance > fit.boundingRadius);
  const halfFovV = ((40 * Math.PI) / 180) * 0.5;
  const halfFovH = Math.atan(Math.tan(halfFovV) * (16 / 9));
  const frustumWidth = 2 * fit.fitDistance * Math.tan(halfFovH);
  const projectedCarSpan = fit.maxDim * 1.06;
  const widthOccupancy = projectedCarSpan / frustumWidth;
  assert.ok(
    widthOccupancy >= 0.72 && widthOccupancy <= 0.85,
    `Expected car horizontal occupancy to be ~80%, got ${(widthOccupancy * 100).toFixed(1)}%`,
  );

  assert.ok(fit.minDistance < fit.fitDistance);
  assert.ok(fit.maxDistance > fit.fitDistance);
  assert.ok(fit.near > 0 && fit.near < 0.1);
  assert.ok(fit.far > fit.fitDistance * 10);
});

test('computeCenterAndFit increases fitDistance on narrow portrait aspect ratios', () => {
  const boxMin = { x: -1, y: 0, z: -2 };
  const boxMax = { x: 1, y: 1.2, z: 2 };

  const desktopFit = computeCenterAndFit(boxMin, boxMax, 40, 16 / 9, 1.25);
  const mobileFit = computeCenterAndFit(boxMin, boxMax, 40, 9 / 16, 1.25);

  assert.ok(
    mobileFit.fitDistance > desktopFit.fitDistance,
    'Portrait viewport should pull camera further back to prevent horizontal clipping',
  );
});

test('computePresetCameraPosition preserves exact fitDistance across all presets', () => {
  const fitDistance = 8.5;
  for (const presetId of ['hero', 'front', 'side', 'rear', 'top'] as const) {
    const pos = computePresetCameraPosition(presetId, fitDistance, {
      x: 0,
      y: 0,
      z: 0,
    });
    const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    assert.ok(Math.abs(dist - fitDistance) < 1e-5);
  }
});

test('validateGlbBuffer validates magic header, version, and file extension', () => {
  // 1. Wrong extension
  const badExt = validateGlbBuffer(new ArrayBuffer(32), 'car.obj');
  assert.equal(badExt.valid, false);
  assert.equal(badExt.errorTitle, 'Unsupported 3D File Format');

  // 2. Empty file
  const empty = validateGlbBuffer(new ArrayBuffer(0), 'daytona_sp3.glb');
  assert.equal(empty.valid, false);
  assert.equal(empty.errorTitle, 'Empty Model File');

  // 3. Invalid magic bytes
  const badMagicBuf = new ArrayBuffer(24);
  new DataView(badMagicBuf).setUint32(0, 0x12345678, true);
  const badMagic = validateGlbBuffer(badMagicBuf, 'daytona_sp3.glb');
  assert.equal(badMagic.valid, false);
  assert.equal(badMagic.errorTitle, 'Invalid GLB Signature');

  // 4. Valid glTF 2.0 binary header
  const validBuf = new ArrayBuffer(28);
  const view = new DataView(validBuf);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true); // version 2
  view.setUint32(8, 28, true); // byteLength
  const validRes = validateGlbBuffer(validBuf, 'ferrari_daytona_sp3.glb');
  assert.equal(validRes.valid, true);
  assert.equal(validRes.version, 2);
  assert.equal(validRes.declaredLength, 28);
});

test('built-in /models/daytona-sp3-web.glb and /environments/studio-small-09-2k.hdr exist with valid headers and credits', () => {
  assert.equal(DEFAULT_MODEL_URL, '/models/daytona-sp3-web.glb');
  assert.equal(MODEL_CREDIT.creator, 'vecarz');
  assert.ok(MODEL_CREDIT.modelUrl.includes('sketchfab.com/3d-models/ferrari-daytona-sp3-2022'));
  assert.ok(MODEL_CREDIT.creatorUrl.includes('sketchfab.com/heynic'));
  assert.ok(MODEL_CREDIT.licenseUrl.includes('creativecommons.org/licenses/by/4.0'));

  const glbDiskPath = path.resolve(process.cwd(), 'public/models/daytona-sp3-web.glb');
  assert.equal(fs.existsSync(glbDiskPath), true, 'daytona-sp3-web.glb must exist in public/models/');
  const fileBuf = fs.readFileSync(glbDiskPath);
  const arrayBuf = fileBuf.buffer.slice(
    fileBuf.byteOffset,
    fileBuf.byteOffset + fileBuf.byteLength,
  );
  const check = validateGlbBuffer(arrayBuf, 'daytona-sp3-web.glb');
  assert.equal(check.valid, true);
  assert.equal(check.version, 2);

  // Verify Poly Haven Studio Small 09 2K HDRI exists and has Radiance #?RADIANCE header
  assert.equal(DEFAULT_HDRI_URL, '/environments/studio-small-09-2k.hdr');
  assert.equal(HDRI_CREDIT.assetUrl, 'https://polyhaven.com/a/studio_small_09');
  const hdrDiskPath = path.resolve(
    process.cwd(),
    'public/environments/studio-small-09-2k.hdr',
  );
  assert.equal(
    fs.existsSync(hdrDiskPath),
    true,
    'studio-small-09-2k.hdr must exist in public/environments/',
  );
  const hdrStats = fs.statSync(hdrDiskPath);
  assert.ok(hdrStats.size > 1_000_000, 'studio-small-09-2k.hdr should be a real 2K HDR file');
  const hdrHeader = fs.readFileSync(hdrDiskPath).subarray(0, 16).toString('ascii');
  assert.ok(
    hdrHeader.startsWith('#?RADIANCE') || hdrHeader.startsWith('#?RGBE'),
    `Expected Radiance HDR header, got: ${hdrHeader}`,
  );
});

test('formatFileSize and formatCount return readable tabular strings', () => {
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(15 * 1024 * 1024), '15.00 MB');
  assert.equal(formatCount(142850), '142,850');
});
