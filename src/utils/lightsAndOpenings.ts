import * as THREE from 'three';
import { smoothStep01 } from './explosionGroups';

export interface OpeningState {
  doorsOpen: boolean;
  frontLidOpen: boolean;
  rearCoverOpen: boolean;
}

export interface OpeningProgress {
  doors: number;
  frontLid: number;
  rearCover: number;
}

export interface LightingToggleState {
  frontLightsOn: boolean;
  rearLightsOn: boolean;
}

export interface HingedPanelBinding {
  id: 'left_door' | 'right_door' | 'front_lid' | 'rear_cover';
  plainName: string;
  hingeGroup: THREE.Group;
  restLocalPosition: THREE.Vector3;
  restLocalQuaternion: THREE.Quaternion;
  restWorldPivot: THREE.Vector3;
  extractedTriangleCount: number;
}

export interface SpatialLightController {
  frontEmissiveMaterials: THREE.MeshStandardMaterial[];
  rearEmissiveMaterials: THREE.MeshStandardMaterial[];
  frontPointLights: THREE.PointLight[];
  rearPointLights: THREE.PointLight[];
  frontLightMeshCount: number;
  rearLightMeshCount: number;
  setLightsState: (frontOn: boolean, rearOn: boolean) => void;
}

export interface PanelsAndLightsSetupResult {
  hingedPanels: HingedPanelBinding[];
  lightController: SpatialLightController;
  frunkLinerMesh: THREE.Group;
}

interface RawMeshIsland {
  triIndices: number[];
  tris: number;
  box: THREE.Box3;
}

/**
 * Computes raw vertex-index connected islands inside a mesh without spatial welding
 * so adjacent GLB panels separated across shutlines never falsely merge.
 */
function extractRawConnectedIslands(mesh: THREE.Mesh): RawMeshIsland[] {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index;
  if (!pos) return [];

  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
  if (triCount === 0) return [];

  const vertToTris = new Map<number, number[]>();
  const getVert = (t: number, k: number) =>
    idx ? idx.getX(t * 3 + k) : t * 3 + k;

  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const v = getVert(t, k);
      let list = vertToTris.get(v);
      if (!list) {
        list = [];
        vertToTris.set(v, list);
      }
      list.push(t);
    }
  }

  const visited = new Uint8Array(triCount);
  const islands: RawMeshIsland[] = [];
  const vPos = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    if (visited[t]) continue;
    visited[t] = 1;
    const queue: number[] = [t];
    const triIndices: number[] = [];
    const box = new THREE.Box3();

    for (let qi = 0; qi < queue.length; qi++) {
      const ct = queue[qi];
      for (let k = 0; k < 3; k++) {
        const v = getVert(ct, k);
        triIndices.push(v);
        vPos.fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(vPos);
        const neighbors = vertToTris.get(v);
        if (neighbors) {
          for (let ni = 0; ni < neighbors.length; ni++) {
            const nt = neighbors[ni];
            if (!visited[nt]) {
              visited[nt] = 1;
              queue.push(nt);
            }
          }
        }
      }
    }

    islands.push({
      triIndices,
      tris: queue.length,
      box,
    });
  }

  return islands;
}

/**
 * Splits a mesh's triangles using raw-index connected islands so whole trim cards,
 * handles, speakers, window frames, badges, and louvers move cleanly without tearing.
 */
function splitGeometryByRawIslands(
  mesh: THREE.Mesh,
  islandPredicate: (box: THREE.Box3, triCount: number) => boolean,
): {
  matchedIndices: number[];
  remainingIndices: number[];
} {
  const islands = extractRawConnectedIslands(mesh);
  const matchedIndices: number[] = [];
  const remainingIndices: number[] = [];

  for (const isl of islands) {
    if (islandPredicate(isl.box, isl.tris)) {
      matchedIndices.push(...isl.triIndices);
    } else {
      remainingIndices.push(...isl.triIndices);
    }
  }

  return { matchedIndices, remainingIndices };
}

/**
 * Splits a single indexed BufferGeometry into two index lists (`matchedIndices` and `remainingIndices`)
 * based on a world-space triangle centroid & vertex predicate.
 */
function splitGeometryByWorldTrianglePredicate(
  mesh: THREE.Mesh,
  predicate: (
    v0World: THREE.Vector3,
    v1World: THREE.Vector3,
    v2World: THREE.Vector3,
    centroidWorld: THREE.Vector3,
  ) => boolean,
): {
  matchedIndices: number[];
  remainingIndices: number[];
} {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index;
  const matchedIndices: number[] = [];
  const remainingIndices: number[] = [];

  if (!pos) {
    return { matchedIndices, remainingIndices };
  }

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);

  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

    v0.fromBufferAttribute(pos, a).applyMatrix4(mesh.matrixWorld);
    v1.fromBufferAttribute(pos, b).applyMatrix4(mesh.matrixWorld);
    v2.fromBufferAttribute(pos, c).applyMatrix4(mesh.matrixWorld);

    centroid
      .copy(v0)
      .add(v1)
      .add(v2)
      .multiplyScalar(1 / 3);

    if (predicate(v0, v1, v2, centroid)) {
      matchedIndices.push(a, b, c);
    } else {
      remainingIndices.push(a, b, c);
    }
  }

  return { matchedIndices, remainingIndices };
}

interface ClipPolyVertex {
  worldPos: THREE.Vector3;
  normal: THREE.Vector3 | null;
  uv: THREE.Vector2 | null;
  uv1: THREE.Vector2 | null;
  origIndex?: number;
}

interface ClipPlaneDef {
  axis: 'x' | 'y' | 'z';
  value: number;
  keepGreater: boolean;
}

/**
 * Cleanly clips triangles intersecting a world-space rectangular region along exact planar cutlines,
 * interpolating position, normal, and UVs so rear clamshell engine covers have zero sawtooth teeth.
 */
function splitGeometryWithPlanarCuts(
  mesh: THREE.Mesh,
  candidateTriPredicate: (
    v0: THREE.Vector3,
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    centroid: THREE.Vector3,
  ) => boolean,
  planes: readonly ClipPlaneDef[],
  hingePivotGroup: THREE.Group,
  extractedMeshName: string,
): number {
  const origGeo = mesh.geometry;
  const posAttr = origGeo.attributes.position;
  if (!posAttr || !mesh.parent) return 0;

  mesh.updateWorldMatrix(true, false);
  const idx = origGeo.index;
  const normAttr = origGeo.attributes.normal;
  const uvAttr = origGeo.attributes.uv;
  const uv1Attr = origGeo.attributes.uv1;

  const triCount = idx
    ? Math.floor(idx.count / 3)
    : Math.floor(posAttr.count / 3);
  if (triCount === 0) return 0;

  const invWorld = mesh.matrixWorld.clone().invert();
  const invNormalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const worldToLocalNorm = new THREE.Matrix3().getNormalMatrix(invWorld);
  void invNormalMatrix;

  const matchedIndices: number[] = [];
  const remainingIndices: number[] = [];

  const extraPositions: number[] = [];
  const extraNormals: number[] = [];
  const extraUvs: number[] = [];
  const extraUv1s: number[] = [];
  const baseVertexCount = posAttr.count;
  let nextNewVertexIndex = baseVertexCount;

  const appendVertex = (v: ClipPolyVertex): number => {
    if (v.origIndex !== undefined) {
      return v.origIndex;
    }
    const localP = v.worldPos.clone().applyMatrix4(invWorld);
    extraPositions.push(localP.x, localP.y, localP.z);
    if (normAttr) {
      const n = (v.normal ? v.normal.clone() : new THREE.Vector3(0, 1, 0))
        .applyMatrix3(worldToLocalNorm)
        .normalize();
      extraNormals.push(n.x, n.y, n.z);
    }
    if (uvAttr) {
      extraUvs.push(v.uv ? v.uv.x : 0, v.uv ? v.uv.y : 0);
    }
    if (uv1Attr) {
      extraUv1s.push(v.uv1 ? v.uv1.x : 0, v.uv1 ? v.uv1.y : 0);
    }
    const assigned = nextNewVertexIndex;
    nextNewVertexIndex += 1;
    return assigned;
  };

  const makeOrigVertex = (vertIdx: number): ClipPolyVertex => {
    const wp = new THREE.Vector3()
      .fromBufferAttribute(posAttr, vertIdx)
      .applyMatrix4(mesh.matrixWorld);
    const n = normAttr
      ? new THREE.Vector3()
          .fromBufferAttribute(normAttr, vertIdx)
          .transformDirection(mesh.matrixWorld)
          .normalize()
      : null;
    const uv = uvAttr
      ? new THREE.Vector2(uvAttr.getX(vertIdx), uvAttr.getY(vertIdx))
      : null;
    const uv1 = uv1Attr
      ? new THREE.Vector2(uv1Attr.getX(vertIdx), uv1Attr.getY(vertIdx))
      : null;
    return { worldPos: wp, normal: n, uv, uv1, origIndex: vertIdx };
  };

  const lerpVertex = (
    a: ClipPolyVertex,
    b: ClipPolyVertex,
    t: number,
  ): ClipPolyVertex => {
    const wp = new THREE.Vector3().lerpVectors(a.worldPos, b.worldPos, t);
    const n =
      a.normal && b.normal
        ? new THREE.Vector3().lerpVectors(a.normal, b.normal, t).normalize()
        : null;
    const uv =
      a.uv && b.uv
        ? new THREE.Vector2().lerpVectors(a.uv, b.uv, t)
        : null;
    const uv1 =
      a.uv1 && b.uv1
        ? new THREE.Vector2().lerpVectors(a.uv1, b.uv1, t)
        : null;
    return { worldPos: wp, normal: n, uv, uv1 };
  };

  const evalPlane = (v: ClipPolyVertex, p: ClipPlaneDef): number => {
    const coord = v.worldPos[p.axis];
    return p.keepGreater ? coord - p.value : p.value - coord;
  };

  const clipPolygonPair = (
    poly: ClipPolyVertex[],
    plane: ClipPlaneDef,
  ): { inside: ClipPolyVertex[]; outside: ClipPolyVertex[] } => {
    const inside: ClipPolyVertex[] = [];
    const outside: ClipPolyVertex[] = [];
    const n = poly.length;
    if (n < 3) return { inside, outside };

    const eps = 1e-6;
    for (let i = 0; i < n; i++) {
      const cur = poly[i];
      const nxt = poly[(i + 1) % n];
      const dc = evalPlane(cur, plane);
      const dn = evalPlane(nxt, plane);
      const curIn = dc >= -eps;
      const nxtIn = dn >= -eps;

      if (curIn) inside.push(cur);
      else outside.push(cur);

      if ((curIn && !nxtIn) || (!curIn && nxtIn)) {
        const denom = dc - dn;
        const t = Math.abs(denom) > 1e-9 ? Math.max(0, Math.min(1, dc / denom)) : 0.5;
        const inter = lerpVertex(cur, nxt, t);
        inside.push(inter);
        outside.push(inter);
      }
    }

    return {
      inside: inside.length >= 3 ? inside : [],
      outside: outside.length >= 3 ? outside : [],
    };
  };

  const fanPolygon = (poly: ClipPolyVertex[], target: number[]) => {
    if (poly.length < 3) return;
    const idx0 = appendVertex(poly[0]);
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const cross = new THREE.Vector3();
    for (let i = 1; i < poly.length - 1; i++) {
      e1.subVectors(poly[i].worldPos, poly[0].worldPos);
      e2.subVectors(poly[i + 1].worldPos, poly[0].worldPos);
      cross.crossVectors(e1, e2);
      if (cross.lengthSq() < 1e-12) continue;
      target.push(idx0, appendVertex(poly[i]), appendVertex(poly[i + 1]));
    }
  };

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

    v0.fromBufferAttribute(posAttr, a).applyMatrix4(mesh.matrixWorld);
    v1.fromBufferAttribute(posAttr, b).applyMatrix4(mesh.matrixWorld);
    v2.fromBufferAttribute(posAttr, c).applyMatrix4(mesh.matrixWorld);
    centroid.copy(v0).add(v1).add(v2).multiplyScalar(1 / 3);

    if (!candidateTriPredicate(v0, v1, v2, centroid)) {
      remainingIndices.push(a, b, c);
      continue;
    }

    const verts = [makeOrigVertex(a), makeOrigVertex(b), makeOrigVertex(c)];
    const allInside = planes.every((pl) =>
      verts.every((v) => evalPlane(v, pl) >= -1e-6),
    );
    if (allInside) {
      matchedIndices.push(a, b, c);
      continue;
    }

    const strictlyOutsideAny = planes.some((pl) =>
      verts.every((v) => evalPlane(v, pl) < -1e-6),
    );
    if (strictlyOutsideAny) {
      remainingIndices.push(a, b, c);
      continue;
    }

    let remPolys: ClipPolyVertex[][] = [verts];
    const outsidePolys: ClipPolyVertex[][] = [];

    for (const pl of planes) {
      const nextInside: ClipPolyVertex[][] = [];
      for (const poly of remPolys) {
        const { inside, outside } = clipPolygonPair(poly, pl);
        if (inside.length >= 3) nextInside.push(inside);
        if (outside.length >= 3) outsidePolys.push(outside);
      }
      remPolys = nextInside;
    }

    for (const poly of remPolys) fanPolygon(poly, matchedIndices);
    for (const poly of outsidePolys) fanPolygon(poly, remainingIndices);
  }

  if (matchedIndices.length === 0) return 0;

  const buildCompactedGeometry = (
    indices: number[],
    includeExtras: boolean,
  ): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    if (indices.length === 0) {
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      g.setIndex([]);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      return g;
    }

    const oldToNew = new Map<number, number>();
    const uniqueOld: number[] = [];
    const newIndices = new Array<number>(indices.length);

    for (let i = 0; i < indices.length; i++) {
      const ov = indices[i];
      let nv = oldToNew.get(ov);
      if (nv === undefined) {
        nv = uniqueOld.length;
        oldToNew.set(ov, nv);
        uniqueOld.push(ov);
      }
      newIndices[i] = nv;
    }

    const vCount = uniqueOld.length;
    const attrNames = Object.keys(origGeo.attributes);
    for (const attrName of attrNames) {
      const src = origGeo.attributes[attrName];
      const itemSize = src.itemSize;
      const arr = new Float32Array(vCount * itemSize);
      const extraArr =
        includeExtras && attrName === 'position'
          ? extraPositions
          : includeExtras && attrName === 'normal'
            ? extraNormals
            : includeExtras && attrName === 'uv'
              ? extraUvs
              : includeExtras && attrName === 'uv1'
                ? extraUv1s
                : null;

      for (let nv = 0; nv < vCount; nv++) {
        const ov = uniqueOld[nv];
        if (ov < baseVertexCount) {
          arr[nv * itemSize] = src.getX(ov);
          if (itemSize >= 2) arr[nv * itemSize + 1] = src.getY(ov);
          if (itemSize >= 3) arr[nv * itemSize + 2] = src.getZ(ov);
          if (itemSize >= 4) arr[nv * itemSize + 3] = src.getW(ov);
        } else if (extraArr) {
          const eIdx = (ov - baseVertexCount) * itemSize;
          for (let c = 0; c < itemSize; c++) {
            arr[nv * itemSize + c] = extraArr[eIdx + c] ?? 0;
          }
        }
      }
      g.setAttribute(attrName, new THREE.BufferAttribute(arr, itemSize));
    }

    g.setIndex(newIndices);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  };

  const hasExtras = extraPositions.length > 0;
  const extractedGeo = buildCompactedGeometry(matchedIndices, hasExtras);
  const staticGeo = buildCompactedGeometry(remainingIndices, hasExtras);
  mesh.geometry = staticGeo;

  const extractedMesh = new THREE.Mesh(extractedGeo, mesh.material);
  extractedMesh.name = extractedMeshName;
  extractedMesh.castShadow = mesh.castShadow;
  extractedMesh.receiveShadow = mesh.receiveShadow;

  hingePivotGroup.updateWorldMatrix(true, false);
  const invPivotWorld = hingePivotGroup.matrixWorld.clone().invert();
  const relMatrix = invPivotWorld.multiply(mesh.matrixWorld);
  relMatrix.decompose(
    extractedMesh.position,
    extractedMesh.quaternion,
    extractedMesh.scale,
  );
  hingePivotGroup.add(extractedMesh);

  return Math.floor(matchedIndices.length / 3);
}

function compactGeometryByIndices(
  origGeo: THREE.BufferGeometry,
  indices: number[],
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  if (indices.length === 0) {
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    g.setIndex([]);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  const oldToNew = new Map<number, number>();
  const uniqueOld: number[] = [];
  const newIndices = new Array<number>(indices.length);

  for (let i = 0; i < indices.length; i++) {
    const ov = indices[i];
    let nv = oldToNew.get(ov);
    if (nv === undefined) {
      nv = uniqueOld.length;
      oldToNew.set(ov, nv);
      uniqueOld.push(ov);
    }
    newIndices[i] = nv;
  }

  const vCount = uniqueOld.length;
  for (const attrName of Object.keys(origGeo.attributes)) {
    const src = origGeo.attributes[attrName];
    const itemSize = src.itemSize;
    const arr = new Float32Array(vCount * itemSize);
    for (let nv = 0; nv < vCount; nv++) {
      const ov = uniqueOld[nv];
      arr[nv * itemSize] = src.getX(ov);
      if (itemSize >= 2) arr[nv * itemSize + 1] = src.getY(ov);
      if (itemSize >= 3) arr[nv * itemSize + 2] = src.getZ(ov);
      if (itemSize >= 4) arr[nv * itemSize + 3] = src.getW(ov);
    }
    g.setAttribute(attrName, new THREE.BufferAttribute(arr, itemSize));
  }

  g.setIndex(newIndices);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Extracts a subset of triangles from `sourceMesh` into a new child `THREE.Mesh` mounted inside
 * `hingePivotGroup` (which is positioned at `worldHingePivot` inside `sourceMesh.parent`).
 * The remaining static triangles stay in `sourceMesh`.
 * When `hingePivotGroup.rotation` matches its rest pose, every vertex sits at its exact original world position.
 */
function extractTrianglesIntoHingeGroup(
  sourceMesh: THREE.Mesh,
  matchedIndices: number[],
  remainingIndices: number[],
  hingePivotGroup: THREE.Group,
  extractedMeshName: string,
): number {
  if (matchedIndices.length === 0 || !sourceMesh.parent) {
    return 0;
  }

  const origGeo = sourceMesh.geometry;
  const extractedGeo = compactGeometryByIndices(origGeo, matchedIndices);
  const staticGeo = compactGeometryByIndices(origGeo, remainingIndices);
  sourceMesh.geometry = staticGeo;

  const extractedMesh = new THREE.Mesh(extractedGeo, sourceMesh.material);
  extractedMesh.name = extractedMeshName;
  extractedMesh.castShadow = sourceMesh.castShadow;
  extractedMesh.receiveShadow = sourceMesh.receiveShadow;

  hingePivotGroup.updateWorldMatrix(true, false);
  const invPivotWorld = hingePivotGroup.matrixWorld.clone().invert();
  const relMatrix = invPivotWorld.multiply(sourceMesh.matrixWorld);
  relMatrix.decompose(
    extractedMesh.position,
    extractedMesh.quaternion,
    extractedMesh.scale,
  );

  hingePivotGroup.add(extractedMesh);
  return Math.floor(matchedIndices.length / 3);
}

/**
 * Extracts topological connected component Island 0 of `Front_bodywork__Rosso_Magma`
 * (the exact 3,306-triangle front luggage lid panel between the front fenders).
 */
function findFrontLuggageLidTriangles(mesh: THREE.Mesh): {
  matchedIndices: number[];
  remainingIndices: number[];
} {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index;
  if (!pos || !idx) {
    return { matchedIndices: [], remainingIndices: [] };
  }

  const vCount = pos.count;
  const parent = new Int32Array(vCount);
  for (let i = 0; i < vCount; i++) parent[i] = i;

  const find = (i: number): number => {
    let cur = i;
    while (parent[cur] !== cur) {
      parent[cur] = parent[parent[cur]];
      cur = parent[cur];
    }
    return cur;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const posMap = new Map<string, number>();
  for (let i = 0; i < vCount; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    const prev = posMap.get(key);
    if (prev !== undefined) union(i, prev);
    else posMap.set(key, i);
  }

  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    union(a, b);
    union(b, c);
  }

  const islands = new Map<
    number,
    { tris: number; box: THREE.Box3; triIndices: number[] }
  >();
  const v = new THREE.Vector3();
  const triCount = Math.floor(idx.count / 3);

  for (let t = 0; t < triCount; t++) {
    const a = idx.getX(t * 3);
    const b = idx.getX(t * 3 + 1);
    const c = idx.getX(t * 3 + 2);
    const r = find(a);
    let entry = islands.get(r);
    if (!entry) {
      entry = { tris: 0, box: new THREE.Box3(), triIndices: [] };
      islands.set(r, entry);
    }
    entry.tris++;
    entry.triIndices.push(a, b, c);
    for (const vi of [a, b, c]) {
      v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld);
      entry.box.expandByPoint(v);
    }
  }

  const matchedIndices: number[] = [];
  const remainingIndices: number[] = [];

  for (const isl of islands.values()) {
    const b = isl.box;
    const isLidIsland =
      isl.tris > 1500 &&
      b.min.x >= -1.55 &&
      b.max.x <= 1.55 &&
      b.min.y >= -0.22 &&
      b.max.y <= 0.58 &&
      b.min.z >= 2.85 &&
      b.max.z <= 5.68;

    if (isLidIsland) {
      matchedIndices.push(...isl.triIndices);
    } else {
      remainingIndices.push(...isl.triIndices);
    }
  }

  return { matchedIndices, remainingIndices };
}

/**
 * Classifies whether a raw connected island inside `Underbody_and_trim` belongs to the
 * Left (`side = -1`) or Right (`side = +1`) butterfly door assembly (inner card, backing shell,
 * window frame, armrests, handles, trim, and door-mounted Ferrari shield) while keeping fixed
 * rocker sills, fender mirrors, wheelhouse liners, seats, and dashboard strictly anchored.
 */
function isDoorUnderbodyIsland(
  box: THREE.Box3,
  side: -1 | 1,
  meshName: string,
): boolean {
  const shortName = meshName.replace(/^Underbody_and_trim__/, '');

  // Fixed rocker sills & lower chassis never move with doors
  if (shortName === 'Color_M08') return false;
  // Fixed front fender wheelhouse vents / ducts sit ahead of door shutline
  if (shortName === 'BlackChrome_3' || shortName === 'BlackChrome_4') {
    return false;
  }

  const sameSide = side === -1 ? box.max.x < -1.25 : box.min.x > 1.25;
  if (!sameSide) return false;

  const minAbsX = side === -1 ? -box.max.x : box.min.x;
  const maxAbsX = side === -1 ? -box.min.x : box.max.x;

  // Door-mounted Scuderia Ferrari shield on the forward outer door panel (z = 1.75..1.97)
  if (shortName === 'FerrariBadge') {
    return minAbsX >= 2.45 && box.min.z >= 1.70 && box.max.z <= 2.02;
  }

  // Outer-edge black backing / seals right behind the painted door skin (Black1)
  if (shortName === 'Black1') {
    if (box.max.y <= -1.06) return false; // underbody floor strip stays fixed
    return (
      minAbsX >= 1.75 &&
      maxAbsX <= 2.65 &&
      box.min.y >= -1.04 &&
      box.max.y <= 1.22 &&
      box.min.z >= -1.04 &&
      box.max.z <= 2.39
    );
  }

  // Exclude forward front-fender garnish in BlackChrome_1 (z >= 1.70)
  if (shortName === 'BlackChrome_1' && box.min.z >= 1.70) {
    return false;
  }

  // Door inner backing structure in UnderCarrier (below sills is fixed rocker, so filter door shell bounds)
  if (shortName === 'UnderCarrier') {
    return (
      minAbsX >= 1.32 &&
      maxAbsX <= 2.63 &&
      box.min.y >= -1.12 &&
      box.max.y <= 1.22 &&
      box.min.z >= -1.02 &&
      box.max.z <= 2.37
    );
  }

  // Exclude fixed fender-mounted mirror stalks (|x| > 2.15 or z > 2.22)
  if (maxAbsX > 2.15 || box.max.z > 2.22) {
    return false;
  }

  // Exclude fixed floor sill kickplates / seat rail trims (dip below door card bottom y = -0.64)
  if (box.min.y < -0.64) {
    // BlackChrome has a small lower rear door trim piece at |x|=1.96..2.11, y=-0.90..-0.57, z=-0.69..-0.49
    if (
      shortName === 'BlackChrome' &&
      minAbsX >= 1.92 &&
      box.min.z >= -0.75 &&
      box.max.z <= -0.45
    ) {
      return true;
    }
    return false;
  }

  // Exclude fixed targa roll-bar roof trim along upper inner opening (|x| < 1.32, y >= 1.08)
  if (minAbsX < 1.32 && box.min.y >= 1.05) {
    return false;
  }

  // Window trims: include door window frames & quarter window frames (|x| in 1.28..1.92, z in -0.95..1.96)
  if (shortName === 'WindowsTrims') {
    return (
      minAbsX >= 1.28 &&
      maxAbsX <= 1.94 &&
      box.min.y >= 0.45 &&
      box.max.y <= 1.24 &&
      box.min.z >= -0.95 &&
      box.max.z <= 1.96
    );
  }

  // General door card, backing panel, window weatherstrip, armrest, handles, latches, switches
  const DOOR_TRIM_MESHES = new Set([
    't_ext_front_bumper_spoiler',
    'Black1_1',
    'BlackTrims1',
    'BlackTrims1_1',
    'BlackTrims1_2',
    'BlackTrims1_3',
    'BlackTrims1_4',
    'BlackTrims1_5',
    'BlackChrome',
    'BlackChrome_1',
    'BlackChrome_2',
    'Chrome1',
    'Chrome1_1',
  ]);
  if (!DOOR_TRIM_MESHES.has(shortName)) {
    return false;
  }

  return (
    minAbsX >= 1.28 &&
    maxAbsX <= 2.15 &&
    box.min.y >= -0.64 &&
    box.max.y <= 1.23 &&
    box.min.z >= -0.95 &&
    box.max.z <= 2.20
  );
}

/**
 * Classifies whether a raw connected island inside `Cabin` is mounted on the
 * Left (`side = -1`) or Right (`side = +1`) butterfly door (speakers, door switch icons,
 * door card stitching, and the asymmetric right-door upper leather trim inside `BlackSeats`),
 * while leaving seats, seat bolsters, center console, steering wheel, and dashboard untouched.
 */
function isDoorCabinIsland(
  box: THREE.Box3,
  side: -1 | 1,
  meshName: string,
): boolean {
  const shortName = meshName.replace(/^Cabin__/, '');
  const sameSide = side === -1 ? box.max.x < -1.25 : box.min.x > 1.25;
  if (!sameSide) return false;

  const minAbsX = side === -1 ? -box.max.x : box.min.x;
  const maxAbsX = side === -1 ? -box.min.x : box.max.x;

  if (shortName === 'Speakers') {
    return (
      minAbsX >= 1.30 &&
      maxAbsX <= 1.70 &&
      box.min.y >= -0.58 &&
      box.max.y <= -0.05 &&
      box.min.z >= 1.15 &&
      box.max.z <= 2.18
    );
  }

  if (shortName === 'Icons') {
    return (
      minAbsX >= 1.32 &&
      maxAbsX <= 1.82 &&
      box.min.y >= -0.46 &&
      box.max.y <= -0.20 &&
      box.min.z >= 1.05 &&
      box.max.z <= 1.40
    );
  }

  if (shortName === 'Stitching') {
    // Exclude seat bolster stitching at |x| <= 1.59, y = -0.61..-0.51
    return (
      minAbsX >= 1.44 &&
      maxAbsX <= 1.86 &&
      box.min.y >= -0.45 &&
      box.max.y <= 0.55 &&
      box.min.z >= -0.82 &&
      box.max.z <= 1.62
    );
  }

  // Asymmetric Collada export placed the right door's upper leather beltline pad in Cabin__BlackSeats(_0);
  // it runs forward to z = 0.82 and out to x = 1.73, whereas fixed seat bolsters stop at z <= -0.39.
  if (
    side === 1 &&
    (shortName === 'BlackSeats' || shortName === 'BlackSeats_0')
  ) {
    return (
      box.min.x >= 1.41 &&
      box.max.x <= 1.76 &&
      box.min.y >= 0.05 &&
      box.max.y <= 0.60 &&
      box.min.z >= -0.80 &&
      box.max.z <= 0.85 &&
      box.max.z >= -0.10
    );
  }

  return false;
}

/**
 * Sets up:
 * 1. Genuine panel surface splits and rigid cross-group hinge bindings for:
 *    - Butterfly Doors (Left & Right: outer skin + glazing + inner door cards, backing, frames, handles, trim, badges)
 *    - Front Luggage Lid (bonnet skin + underside aero-duct trims; luggage tub stays fixed)
 *    - Rear Engine Cover (cleanly clipped central deck + underside deck trims + louvers + silver spine + glazing; fenders, fuel cap & V12 stay fixed)
 * 2. Spatial front and rear light mesh separation, emissive materials, and bounded PointLights.
 */
export function setupPanelsAndSpatialLights(
  modelRoot: THREE.Object3D,
  isSoftwareGl = false,
): PanelsAndLightsSetupResult {
  modelRoot.updateMatrixWorld(true);
  const hingedPanels: HingedPanelBinding[] = [];

  const createHingeGroupInParent = (
    parentObj: THREE.Object3D,
    name: string,
    worldPivot: THREE.Vector3,
  ): THREE.Group => {
    parentObj.updateWorldMatrix(true, false);
    const localPivot = worldPivot.clone();
    parentObj.worldToLocal(localPivot);

    const hingeGroup = new THREE.Group();
    hingeGroup.name = name;
    hingeGroup.position.copy(localPivot);
    parentObj.add(hingeGroup);
    hingeGroup.updateWorldMatrix(true, false);
    hingeGroup.userData.restLocalPosition = hingeGroup.position.clone();
    hingeGroup.userData.restLocalQuaternion = hingeGroup.quaternion.clone();
    return hingeGroup;
  };

  const glazingMesh = modelRoot.getObjectByName(
    'Glazing__Windows',
  ) as THREE.Mesh | null;
  const underbodyGroup = modelRoot.getObjectByName('Underbody_and_trim');
  const cabinGroup = modelRoot.getObjectByName('Cabin');

  // Snapshot child mesh arrays before adding new hinge groups inside Underbody_and_trim / Cabin
  const underbodyMeshes: THREE.Mesh[] = [];
  underbodyGroup?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) underbodyMeshes.push(m);
  });
  const cabinMeshes: THREE.Mesh[] = [];
  cabinGroup?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) cabinMeshes.push(m);
  });

  // ---------------------------------------------------------------------------
  // 1. Left & Right Butterfly Doors
  // ---------------------------------------------------------------------------
  for (const side of [-1, 1] as const) {
    const bodyGroupName = side === -1 ? 'Left_bodywork' : 'Right_bodywork';
    const bodyMeshName =
      side === -1
        ? 'Left_bodywork__Rosso_Magma'
        : 'Right_bodywork__Rosso_Magma';
    const panelId = side === -1 ? 'left_door' : 'right_door';
    const plainName =
      side === -1 ? 'Left Butterfly Door' : 'Right Butterfly Door';
    const sideLabel = side === -1 ? 'Left' : 'Right';

    const bodyGroup = modelRoot.getObjectByName(bodyGroupName);
    const bodyMesh = modelRoot.getObjectByName(
      bodyMeshName,
    ) as THREE.Mesh | null;

    if (bodyGroup && bodyMesh) {
      const worldPivot = new THREE.Vector3(side * 1.85, 0.34, 1.95);
      const doorHingeGroup = createHingeGroupInParent(
        bodyGroup,
        `Hinge_${sideLabel}_Door`,
        worldPivot,
      );

      // 1a. 100% of Left_bodywork / Right_bodywork exterior door skin (no jagged cropping)
      const { matchedIndices, remainingIndices } =
        splitGeometryByWorldTrianglePredicate(bodyMesh, () => true);

      let tris = extractTrianglesIntoHingeGroup(
        bodyMesh,
        matchedIndices,
        remainingIndices,
        doorHingeGroup,
        `${bodyMeshName}__DoorPanel`,
      );

      // 1b. Side door glazing (main door glass + forward quarter glass on the door waist)
      if (glazingMesh) {
        const glassSplit = splitGeometryByRawIslands(glazingMesh, (b) => {
          const sameSide = side === -1 ? b.max.x < -1.24 : b.min.x > 1.24;
          if (!sameSide) return false;
          const minAbsX = side === -1 ? -b.max.x : b.min.x;
          const maxAbsX = side === -1 ? -b.min.x : boxMaxX(b, side);
          return (
            minAbsX >= 1.24 &&
            maxAbsX <= 2.02 &&
            b.min.y >= 0.18 &&
            b.max.y <= 1.28 &&
            b.min.z >= -0.92 &&
            b.max.z <= 1.98
          );
        });
        if (glassSplit.matchedIndices.length > 0) {
          tris += extractTrianglesIntoHingeGroup(
            glazingMesh,
            glassSplit.matchedIndices,
            glassSplit.remainingIndices,
            doorHingeGroup,
            `Glazing__${sideLabel}DoorWindow`,
          );
        }
      }

      // 1c. Door inner cards, backing shells, window frames, handles, armrests, trim & Scuderia shield from Underbody_and_trim
      for (const m of underbodyMeshes) {
        const split = splitGeometryByRawIslands(m, (b) =>
          isDoorUnderbodyIsland(b, side, m.name),
        );
        if (split.matchedIndices.length > 0) {
          tris += extractTrianglesIntoHingeGroup(
            m,
            split.matchedIndices,
            split.remainingIndices,
            doorHingeGroup,
            `${m.name}__${sideLabel}Door`,
          );
        }
      }

      // 1d. Door-mounted speakers, switch icons, stitching, and right upper leather pad from Cabin
      for (const m of cabinMeshes) {
        const split = splitGeometryByRawIslands(m, (b) =>
          isDoorCabinIsland(b, side, m.name),
        );
        if (split.matchedIndices.length > 0) {
          tris += extractTrianglesIntoHingeGroup(
            m,
            split.matchedIndices,
            split.remainingIndices,
            doorHingeGroup,
            `${m.name}__${sideLabel}Door`,
          );
        }
      }

      hingedPanels.push({
        id: panelId,
        plainName,
        hingeGroup: doorHingeGroup,
        restLocalPosition: doorHingeGroup.position.clone(),
        restLocalQuaternion: doorHingeGroup.quaternion.clone(),
        restWorldPivot: worldPivot,
        extractedTriangleCount: tris,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Front Luggage Lid (bonnet island + underside aero-duct trims; tub fixed)
  // ---------------------------------------------------------------------------
  const frontBodyGroup = modelRoot.getObjectByName('Front_bodywork');
  const frontBodyMesh = modelRoot.getObjectByName(
    'Front_bodywork__Rosso_Magma',
  ) as THREE.Mesh | null;

  if (frontBodyGroup && frontBodyMesh) {
    const worldPivot = new THREE.Vector3(0, 0.44, 3.04);
    const frontLidHingeGroup = createHingeGroupInParent(
      frontBodyGroup,
      'Hinge_Front_Luggage_Lid',
      worldPivot,
    );

    const { matchedIndices, remainingIndices } =
      findFrontLuggageLidTriangles(frontBodyMesh);

    let tris = extractTrianglesIntoHingeGroup(
      frontBodyMesh,
      matchedIndices,
      remainingIndices,
      frontLidHingeGroup,
      'Front_bodywork__LuggageLidPanel',
    );

    // Attach lid-mounted underside hood ducts / liner slats directly to frontLidHingeGroup
    for (const m of underbodyMeshes) {
      const shortName = m.name.replace(/^Underbody_and_trim__/, '');
      if (
        shortName !== 'BlackTrims1_6' &&
        shortName !== 'BlackChrome_3' &&
        shortName !== 'Black1'
      ) {
        continue;
      }
      const split = splitGeometryByRawIslands(m, (b) => {
        if (shortName === 'BlackTrims1_6') {
          return (
            b.min.x >= -1.20 &&
            b.max.x <= 1.20 &&
            b.min.y >= -0.12 &&
            b.max.y <= 0.42 &&
            b.min.z >= 3.78 &&
            b.max.z <= 5.60
          );
        }
        if (shortName === 'BlackChrome_3') {
          const minAbsX = Math.min(Math.abs(b.min.x), Math.abs(b.max.x));
          const maxAbsX = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
          return (
            minAbsX >= 1.0 &&
            maxAbsX <= 1.44 &&
            b.min.y >= 0.05 &&
            b.max.y <= 0.42 &&
            b.min.z >= 3.50 &&
            b.max.z <= 4.78
          );
        }
        if (shortName === 'Black1') {
          return (
            b.min.x >= -1.08 &&
            b.max.x <= 1.08 &&
            b.min.y >= -0.12 &&
            b.max.y <= 0.34 &&
            b.min.z >= 3.80 &&
            b.max.z <= 5.50
          );
        }
        return false;
      });
      if (split.matchedIndices.length > 0) {
        tris += extractTrianglesIntoHingeGroup(
          m,
          split.matchedIndices,
          split.remainingIndices,
          frontLidHingeGroup,
          `${m.name}__FrontLidTrim`,
        );
      }
    }

    hingedPanels.push({
      id: 'front_lid',
      plainName: 'Front Luggage Lid',
      hingeGroup: frontLidHingeGroup,
      restLocalPosition: frontLidHingeGroup.position.clone(),
      restLocalQuaternion: frontLidHingeGroup.quaternion.clone(),
      restWorldPivot: worldPivot,
      extractedTriangleCount: tris,
    });
  }

  // Sculpted carbon-fibre front luggage compartment tub beneath the Front Luggage Lid (stays fixed)
  const frunkLinerGroup = new THREE.Group();
  frunkLinerGroup.name = 'Front_Luggage_Compartment_Tub';
  {
    const tubMat = new THREE.MeshStandardMaterial({
      name: 'Frunk_Carbon_Liner',
      color: 0x161920,
      roughness: 0.42,
      metalness: 0.18,
      fog: false,
    });
    const floorBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.06, 2.05),
      tubMat,
    );
    floorBox.position.set(0, -0.32, 4.22);
    frunkLinerGroup.add(floorBox);

    const rearWall = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.56, 0.06),
      tubMat,
    );
    rearWall.position.set(0, -0.04, 3.20);
    frunkLinerGroup.add(rearWall);

    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.34, 0.06),
      tubMat,
    );
    frontWall.position.set(0, -0.15, 5.24);
    frunkLinerGroup.add(frontWall);

    for (const side of [-1, 1] as const) {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.44, 2.05),
        tubMat,
      );
      sideWall.position.set(side * 1.05, -0.1, 4.22);
      frunkLinerGroup.add(sideWall);
    }

    if (underbodyGroup) {
      underbodyGroup.add(frunkLinerGroup);
    } else {
      modelRoot.add(frunkLinerGroup);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Rear Engine Cover (clean planar clip within |x|<=1.16, z in [-5.24,-1.42]
  //    + WindowsTrims deck + louvers + silver spine + glazing; fuel cap & V12 fixed)
  // ---------------------------------------------------------------------------
  const rearBodyGroup = modelRoot.getObjectByName('Rear_bodywork');
  const rearBodyMesh = modelRoot.getObjectByName(
    'Rear_bodywork__Rosso_Magma',
  ) as THREE.Mesh | null;

  if (rearBodyGroup && rearBodyMesh) {
    const worldPivot = new THREE.Vector3(0, 0.78, -5.24);
    const rearCoverHingeGroup = createHingeGroupInParent(
      rearBodyGroup,
      'Hinge_Rear_Engine_Cover',
      worldPivot,
    );

    const rearCoverPlanes: ClipPlaneDef[] = [
      { axis: 'x', value: -1.16, keepGreater: true },
      { axis: 'x', value: 1.16, keepGreater: false },
      { axis: 'z', value: -5.24, keepGreater: true },
      { axis: 'z', value: -1.42, keepGreater: false },
    ];

    let tris = splitGeometryWithPlanarCuts(
      rearBodyMesh,
      (v0, v1, v2, centroid) => {
        const maxY = Math.max(v0.y, v1.y, v2.y);
        return (
          maxY >= 0.56 &&
          centroid.y >= 0.54 &&
          Math.min(v0.z, v1.z, v2.z) <= -1.38 &&
          Math.max(v0.z, v1.z, v2.z) >= -5.28 &&
          Math.min(v0.x, v1.x, v2.x) <= 1.24 &&
          Math.max(v0.x, v1.x, v2.x) >= -1.24
        );
      },
      rearCoverPlanes,
      rearCoverHingeGroup,
      'Rear_bodywork__EngineCoverPanel',
    );

    // Rear louvered engine bay window island from Glazing__Windows mounted directly on rearCoverHingeGroup
    if (glazingMesh) {
      const rearGlassSplit = splitGeometryByRawIslands(glazingMesh, (b) => {
        return (
          b.min.x >= -0.45 &&
          b.max.x <= 0.45 &&
          b.min.y >= 0.45 &&
          b.max.y <= 1.10 &&
          b.min.z >= -4.45 &&
          b.max.z <= -2.75
        );
      });
      if (rearGlassSplit.matchedIndices.length > 0) {
        tris += extractTrianglesIntoHingeGroup(
          glazingMesh,
          rearGlassSplit.matchedIndices,
          rearGlassSplit.remainingIndices,
          rearCoverHingeGroup,
          'Glazing__EngineBayWindow',
        );
      }
    }

    // Rear engine cover trim, louvers, vents, silver spine & WindowsTrims deck mounted directly on rearCoverHingeGroup
    for (const m of underbodyMeshes) {
      const shortName = m.name.replace(/^Underbody_and_trim__/, '');

      if (shortName === 'WindowsTrims') {
        tris += splitGeometryWithPlanarCuts(
          m,
          (v0, v1, v2, centroid) => {
            const maxY = Math.max(v0.y, v1.y, v2.y);
            return (
              maxY >= 0.56 &&
              centroid.y >= 0.52 &&
              Math.min(v0.z, v1.z, v2.z) <= -1.38 &&
              Math.max(v0.z, v1.z, v2.z) >= -5.28 &&
              Math.min(v0.x, v1.x, v2.x) <= 1.24 &&
              Math.max(v0.x, v1.x, v2.x) >= -1.24
            );
          },
          rearCoverPlanes,
          rearCoverHingeGroup,
          'Underbody_and_trim__WindowsTrims__RearCover',
        );
        continue;
      }

      if (shortName === 'v_ext_argento_nurburgring_matt') {
        const split = splitGeometryByRawIslands(
          m,
          (b) => b.min.z >= -4.60 && b.max.z <= -1.415 && b.min.y >= 0.55,
        );
        if (split.matchedIndices.length > 0) {
          tris += extractTrianglesIntoHingeGroup(
            m,
            split.matchedIndices,
            split.remainingIndices,
            rearCoverHingeGroup,
            'Underbody_and_trim__EngineSpineLouvers',
          );
        }
        continue;
      }

      if (
        shortName === 'BlackTrims1_6' ||
        shortName === 'BlackTrims1_7' ||
        shortName === 'Grille1' ||
        shortName === 'UnderCarrier' ||
        shortName === 'Chrome1_1'
      ) {
        const split = splitGeometryByRawIslands(m, (b) => {
          return (
            b.min.x >= -1.12 &&
            b.max.x <= 1.12 &&
            b.min.y >= 0.54 &&
            b.max.y <= 1.38 &&
            b.min.z >= -5.18 &&
            b.max.z <= -1.42
          );
        });
        if (split.matchedIndices.length > 0) {
          tris += extractTrianglesIntoHingeGroup(
            m,
            split.matchedIndices,
            split.remainingIndices,
            rearCoverHingeGroup,
            `${m.name}__RearCover`,
          );
        }
      }
    }

    hingedPanels.push({
      id: 'rear_cover',
      plainName: 'Rear Engine Cover',
      hingeGroup: rearCoverHingeGroup,
      restLocalPosition: rearCoverHingeGroup.position.clone(),
      restLocalQuaternion: rearCoverHingeGroup.quaternion.clone(),
      restWorldPivot: worldPivot,
      extractedTriangleCount: tris,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Spatial Front Lights & Rear Lights Identification + Bounded PointLights
  // ---------------------------------------------------------------------------
  const frontEmissiveMaterials: THREE.MeshStandardMaterial[] = [];
  const rearEmissiveMaterials: THREE.MeshStandardMaterial[] = [];
  const frontPointLights: THREE.PointLight[] = [];
  const rearPointLights: THREE.PointLight[] = [];
  let frontLightMeshCount = 0;
  let rearLightMeshCount = 0;

  const lightingGroup = modelRoot.getObjectByName('Lighting') ?? modelRoot;
  const drlMesh = modelRoot.getObjectByName(
    'Lighting__DRLs',
  ) as THREE.Mesh | null;
  const headlightsGlassMesh = modelRoot.getObjectByName(
    'Lighting__HeadlightsGlass',
  ) as THREE.Mesh | null;
  const brakeLightsGlassMesh = modelRoot.getObjectByName(
    'Lighting__BrakeLightsGlass',
  ) as THREE.Mesh | null;
  const rearRedMainMesh = modelRoot.getObjectByName(
    'Rear_bodywork__RedMain',
  ) as THREE.Mesh | null;

  if (drlMesh && drlMesh.parent) {
    const baseMat = (
      Array.isArray(drlMesh.material) ? drlMesh.material[0] : drlMesh.material
    ) as THREE.MeshStandardMaterial;

    const frontDrlMat = baseMat.clone();
    frontDrlMat.name = 'Spatial_Front_DRL_Emissive';
    frontDrlMat.fog = false;
    frontEmissiveMaterials.push(frontDrlMat);

    const rearDrlMat = baseMat.clone();
    rearDrlMat.name = 'Spatial_Rear_Lamp_Emissive';
    rearDrlMat.fog = false;
    rearEmissiveMaterials.push(rearDrlMat);

    const frontSplit = splitGeometryByWorldTrianglePredicate(
      drlMesh,
      (_v0, _v1, _v2, c) => c.z > 3.5,
    );

    if (frontSplit.matchedIndices.length > 0) {
      const frontGeo = compactGeometryByIndices(
        drlMesh.geometry,
        frontSplit.matchedIndices,
      );
      const frontMesh = new THREE.Mesh(frontGeo, frontDrlMat);
      frontMesh.name = 'Lighting__Front_DRL_Blades';
      frontMesh.position.copy(drlMesh.position);
      frontMesh.quaternion.copy(drlMesh.quaternion);
      frontMesh.scale.copy(drlMesh.scale);
      drlMesh.parent.add(frontMesh);
      frontLightMeshCount += 1;

      drlMesh.geometry = compactGeometryByIndices(
        drlMesh.geometry,
        frontSplit.remainingIndices,
      );
    }

    const rearSplit = splitGeometryByWorldTrianglePredicate(
      drlMesh,
      (_v0, _v1, _v2, c) => c.z < -4.0,
    );

    if (rearSplit.matchedIndices.length > 0) {
      const rearGeo = compactGeometryByIndices(
        drlMesh.geometry,
        rearSplit.matchedIndices,
      );
      const rearMesh = new THREE.Mesh(rearGeo, rearDrlMat);
      rearMesh.name = 'Lighting__Rear_Marker_Lamps';
      rearMesh.position.copy(drlMesh.position);
      rearMesh.quaternion.copy(drlMesh.quaternion);
      rearMesh.scale.copy(drlMesh.scale);
      drlMesh.parent.add(rearMesh);
      rearLightMeshCount += 1;

      drlMesh.geometry = compactGeometryByIndices(
        drlMesh.geometry,
        rearSplit.remainingIndices,
      );
    }
  }

  if (headlightsGlassMesh) {
    const baseGlassMat = (
      Array.isArray(headlightsGlassMesh.material)
        ? headlightsGlassMesh.material[0]
        : headlightsGlassMesh.material
    ) as THREE.MeshStandardMaterial;
    const frontLensMat = baseGlassMat.clone();
    frontLensMat.name = 'Spatial_Front_Headlight_Lens';
    frontLensMat.fog = false;
    headlightsGlassMesh.material = frontLensMat;
    frontEmissiveMaterials.push(frontLensMat);
    frontLightMeshCount += 1;
  }

  if (brakeLightsGlassMesh) {
    const baseBrakeMat = (
      Array.isArray(brakeLightsGlassMesh.material)
        ? brakeLightsGlassMesh.material[0]
        : brakeLightsGlassMesh.material
    ) as THREE.MeshStandardMaterial;
    const rearLensMat = baseBrakeMat.clone();
    rearLensMat.name = 'Spatial_Rear_Taillight_Lens';
    rearLensMat.fog = false;
    brakeLightsGlassMesh.material = rearLensMat;
    rearEmissiveMaterials.push(rearLensMat);
    rearLightMeshCount += 1;
  }

  if (rearRedMainMesh) {
    const baseBarMat = (
      Array.isArray(rearRedMainMesh.material)
        ? rearRedMainMesh.material[0]
        : rearRedMainMesh.material
    ) as THREE.MeshStandardMaterial;
    const rearBarMat = baseBarMat.clone();
    rearBarMat.name = 'Spatial_Rear_Taillight_Bar';
    rearBarMat.fog = false;
    rearRedMainMesh.material = rearBarMat;
    rearEmissiveMaterials.push(rearBarMat);
    rearLightMeshCount += 1;
  }

  lightingGroup.updateWorldMatrix(true, false);
  for (const side of [-1, 1] as const) {
    const frontLight = new THREE.PointLight(0xf2f7ff, 0, 5.8, 2.0);
    frontLight.name =
      side === -1 ? 'Front_Left_Headlamp_Light' : 'Front_Right_Headlamp_Light';
    const frontWorldPos = new THREE.Vector3(side * 1.92, -0.22, 5.38);
    lightingGroup.worldToLocal(frontWorldPos);
    frontLight.position.copy(frontWorldPos);
    frontLight.castShadow = false;
    lightingGroup.add(frontLight);
    frontPointLights.push(frontLight);

    const rearLight = new THREE.PointLight(0xff1420, 0, 5.2, 2.0);
    rearLight.name =
      side === -1 ? 'Rear_Left_Taillamp_Light' : 'Rear_Right_Taillamp_Light';
    const rearWorldPos = new THREE.Vector3(side * 1.48, 0.56, -5.98);
    lightingGroup.worldToLocal(rearWorldPos);
    rearLight.position.copy(rearWorldPos);
    rearLight.castShadow = false;
    lightingGroup.add(rearLight);
    rearPointLights.push(rearLight);
  }

  for (const m of [...frontEmissiveMaterials, ...rearEmissiveMaterials]) {
    const origHex = m.emissive ? m.emissive.getHex() : 0x000000;
    m.userData.__origEmissiveHex = origHex;
    m.userData.__origEmissiveIntensity =
      origHex !== 0x000000 ? (m.emissiveIntensity ?? 0) : 0;
    m.userData.__origColorHex = m.color ? m.color.getHex() : 0xffffff;
  }

  const setLightsState = (frontOn: boolean, rearOn: boolean) => {
    for (const mat of frontEmissiveMaterials) {
      if (frontOn) {
        const isLens = mat.name.includes('Lens');
        mat.emissive.setHex(isLens ? 0xdbeafe : 0xf8fbff);
        mat.emissiveIntensity = isLens ? 1.15 : 3.6;
        if (!isLens) {
          mat.color.setHex(0xffffff);
        }
      } else {
        mat.emissive.setHex(mat.userData.__origEmissiveHex ?? 0x000000);
        mat.emissiveIntensity = mat.userData.__origEmissiveIntensity ?? 0;
        if (mat.userData.__origColorHex !== undefined) {
          mat.color.setHex(mat.userData.__origColorHex);
        }
      }
      mat.needsUpdate = true;
    }

    for (const light of frontPointLights) {
      light.intensity = frontOn ? (isSoftwareGl ? 1.2 : 1.85) : 0;
    }

    for (const mat of rearEmissiveMaterials) {
      if (rearOn) {
        const isLens = mat.name.includes('Lens');
        mat.emissive.setHex(0xff1420);
        mat.emissiveIntensity = isLens ? 1.85 : 3.8;
        if (!isLens) {
          mat.color.setHex(0xff2430);
        }
      } else {
        mat.emissive.setHex(mat.userData.__origEmissiveHex ?? 0x000000);
        mat.emissiveIntensity = mat.userData.__origEmissiveIntensity ?? 0;
        if (mat.userData.__origColorHex !== undefined) {
          mat.color.setHex(mat.userData.__origColorHex);
        }
      }
      mat.needsUpdate = true;
    }

    for (const light of rearPointLights) {
      light.intensity = rearOn ? (isSoftwareGl ? 1.1 : 1.65) : 0;
    }
  };

  return {
    hingedPanels,
    lightController: {
      frontEmissiveMaterials,
      rearEmissiveMaterials,
      frontPointLights,
      rearPointLights,
      frontLightMeshCount,
      rearLightMeshCount,
      setLightsState,
    },
    frunkLinerMesh: frunkLinerGroup,
  };
}

function boxMaxX(b: THREE.Box3, side: -1 | 1): number {
  return side === -1 ? -b.min.x : b.max.x;
}

const _parentWorldQuat = new THREE.Quaternion();
const _invParentWorldQuat = new THREE.Quaternion();
const _panelWorldDelta = new THREE.Quaternion();
const _doorYaw = new THREE.Quaternion();
const _doorLift = new THREE.Quaternion();
const _doorRoll = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);

function applyWorldDeltaToHingeGroup(
  group: THREE.Group,
  restPos: THREE.Vector3,
  restQuat: THREE.Quaternion,
  worldDelta: THREE.Quaternion,
): void {
  group.parent?.updateWorldMatrix(true, false);
  if (group.parent) {
    group.parent.getWorldQuaternion(_parentWorldQuat);
  } else {
    _parentWorldQuat.identity();
  }
  _invParentWorldQuat.copy(_parentWorldQuat).invert();
  group.position.copy(restPos);
  group.quaternion
    .copy(_invParentWorldQuat)
    .multiply(worldDelta)
    .multiply(_parentWorldQuat)
    .multiply(restQuat);
}

function restoreHingeGroup(
  group: THREE.Group,
  restPos: THREE.Vector3,
  restQuat: THREE.Quaternion,
): void {
  group.position.copy(restPos);
  group.quaternion.copy(restQuat);
}

/**
 * Applies smooth, physically plausible hinge arcs to the Butterfly Doors (Left & Right),
 * Front Luggage Lid, and Rear Engine Cover from stored rest poses, rigidly syncing every
 * cross-group linked hinge group via world-space quaternion conjugation so outer skins,
 * inner door cards, glazing, handles, trims, and louvers share one exact rigid transform.
 * At progress === 0, restores the exact stored rest pose (zero translation/rotation delta).
 */
export function applyHingedPanelTransforms(
  panels: readonly HingedPanelBinding[],
  doorsOrState: number | OpeningProgress,
  frontLidProgressArg = 0,
  rearCoverProgressArg = 0,
): { maxHingeAngleRad: number; maxAngleRad: number; allRestored: boolean } {
  const doorsProgress =
    typeof doorsOrState === 'object' ? doorsOrState.doors : doorsOrState;
  const frontLidProgress =
    typeof doorsOrState === 'object'
      ? doorsOrState.frontLid
      : frontLidProgressArg;
  const rearCoverProgress =
    typeof doorsOrState === 'object'
      ? doorsOrState.rearCover
      : rearCoverProgressArg;

  let maxHingeAngleRad = 0;

  for (const panel of panels) {
    const { hingeGroup, restLocalPosition, restLocalQuaternion } = panel;
    const linked =
      (hingeGroup.userData.linkedHingeGroups as THREE.Group[] | undefined) ||
      [];

    if (panel.id === 'left_door' || panel.id === 'right_door') {
      const t = Math.max(0, Math.min(1, doorsProgress));
      if (t <= 1e-4) {
        restoreHingeGroup(hingeGroup, restLocalPosition, restLocalQuaternion);
        for (const lg of linked) {
          restoreHingeGroup(
            lg,
            (lg.userData.restLocalPosition as THREE.Vector3) ?? lg.position,
            (lg.userData.restLocalQuaternion as THREE.Quaternion) ??
              new THREE.Quaternion(),
          );
        }
        continue;
      }

      const side = panel.id === 'left_door' ? -1 : 1;
      // Clear the cabin first, then lift the rear edge in a butterfly sweep.
      const outwardPhase = smoothStep01(Math.min(1, t / 0.4));
      const upwardPhase = smoothStep01(Math.max(0, (t - 0.18) / 0.82));
      const yaw = -side * (0.36 * outwardPhase + 0.18 * upwardPhase);
      const lift = 0.95 * upwardPhase;
      const roll = side * 0.10 * upwardPhase;
      _doorYaw.setFromAxisAngle(_axisY, yaw);
      _doorLift.setFromAxisAngle(_axisX, lift);
      _doorRoll.setFromAxisAngle(_axisZ, roll);
      _panelWorldDelta.copy(_doorYaw).multiply(_doorLift).multiply(_doorRoll);

      applyWorldDeltaToHingeGroup(
        hingeGroup,
        restLocalPosition,
        restLocalQuaternion,
        _panelWorldDelta,
      );
      for (const lg of linked) {
        applyWorldDeltaToHingeGroup(
          lg,
          (lg.userData.restLocalPosition as THREE.Vector3) ?? lg.position,
          (lg.userData.restLocalQuaternion as THREE.Quaternion) ??
            new THREE.Quaternion(),
          _panelWorldDelta,
        );
      }

      const angle = 2 * Math.acos(Math.min(1, Math.abs(_panelWorldDelta.w)));
      if (angle > maxHingeAngleRad) maxHingeAngleRad = angle;
    } else if (panel.id === 'front_lid') {
      const t = smoothStep01(Math.max(0, Math.min(1, frontLidProgress)));
      if (t <= 1e-4) {
        restoreHingeGroup(hingeGroup, restLocalPosition, restLocalQuaternion);
        for (const lg of linked) {
          restoreHingeGroup(
            lg,
            (lg.userData.restLocalPosition as THREE.Vector3) ?? lg.position,
            (lg.userData.restLocalQuaternion as THREE.Quaternion) ??
              new THREE.Quaternion(),
          );
        }
        continue;
      }

      // Tilt front edge upward around rear cowl hinge (rx = -0.58 rad ≈ -33.2°)
      const rx = -0.58 * t;
      _panelWorldDelta.setFromAxisAngle(_axisX, rx);
      applyWorldDeltaToHingeGroup(
        hingeGroup,
        restLocalPosition,
        restLocalQuaternion,
        _panelWorldDelta,
      );
      for (const lg of linked) {
        applyWorldDeltaToHingeGroup(
          lg,
          (lg.userData.restLocalPosition as THREE.Vector3) ?? lg.position,
          (lg.userData.restLocalQuaternion as THREE.Quaternion) ??
            new THREE.Quaternion(),
          _panelWorldDelta,
        );
      }

      if (Math.abs(rx) > maxHingeAngleRad) maxHingeAngleRad = Math.abs(rx);
    } else if (panel.id === 'rear_cover') {
      const t = smoothStep01(Math.max(0, Math.min(1, rearCoverProgress)));
      if (t <= 1e-4) {
        restoreHingeGroup(hingeGroup, restLocalPosition, restLocalQuaternion);
        for (const lg of linked) {
          restoreHingeGroup(
            lg,
            (lg.userData.restLocalPosition as THREE.Vector3) ?? lg.position,
            (lg.userData.restLocalQuaternion as THREE.Quaternion) ??
              new THREE.Quaternion(),
          );
        }
        continue;
      }

      // Tilt rear engine cover clamshell upward around rear hinge (rx = -0.60 rad ≈ -34.4°)
      const rx = -0.60 * t;
      _panelWorldDelta.setFromAxisAngle(_axisX, rx);
      applyWorldDeltaToHingeGroup(
        hingeGroup,
        restLocalPosition,
        restLocalQuaternion,
        _panelWorldDelta,
      );
      for (const lg of linked) {
        applyWorldDeltaToHingeGroup(
          lg,
          (lg.userData.restLocalPosition as THREE.Vector3) ?? lg.position,
          (lg.userData.restLocalQuaternion as THREE.Quaternion) ??
            new THREE.Quaternion(),
          _panelWorldDelta,
        );
      }

      if (Math.abs(rx) > maxHingeAngleRad) maxHingeAngleRad = Math.abs(rx);
    }
  }

  let allRestored = true;
  for (const panel of panels) {
    if (
      panel.hingeGroup.position.distanceTo(panel.restLocalPosition) > 1e-5 ||
      panel.hingeGroup.quaternion.angleTo(panel.restLocalQuaternion) > 1e-5
    ) {
      allRestored = false;
      break;
    }
    const linked =
      (panel.hingeGroup.userData.linkedHingeGroups as
        | THREE.Group[]
        | undefined) || [];
    for (const lg of linked) {
      const rp = lg.userData.restLocalPosition as THREE.Vector3 | undefined;
      const rq = lg.userData.restLocalQuaternion as
        | THREE.Quaternion
        | undefined;
      if (
        (rp && lg.position.distanceTo(rp) > 1e-5) ||
        (rq && lg.quaternion.angleTo(rq) > 1e-5)
      ) {
        allRestored = false;
        break;
      }
    }
    if (!allRestored) break;
  }

  return {
    maxHingeAngleRad,
    maxAngleRad: maxHingeAngleRad,
    allRestored,
  };
}
