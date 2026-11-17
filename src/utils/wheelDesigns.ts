import * as THREE from 'three';

export const WHEEL_DESIGNS = [
  { id: 'factory', label: 'Factory SP3' },
  { id: 'split-y', label: 'Split-Y' },
  { id: 'ten-spoke', label: 'Ten-Spoke' },
  { id: 'cross-mesh', label: 'Cross-Mesh' },
  { id: 'five-blade', label: 'Five-Blade' },
  { id: 'aero-disc', label: 'Aero Disc' },
] as const;
export type WheelDesignId = typeof WHEEL_DESIGNS[number]['id'];
type CustomDesignId = Exclude<WheelDesignId, 'factory'>;
export function isWheelDesign(value: unknown): value is WheelDesignId {
  return WHEEL_DESIGNS.some(d => d.id === value);
}
export interface WheelDesignBinding {
  assembly: THREE.Object3D;
  originalRims: THREE.Mesh[];
  originalVisibility: boolean[];
  alternatives: Record<CustomDesignId, THREE.Group>;
  center: THREE.Vector3;
  radius: number;
  depth: number;
}
export interface WheelDesignController {
  bindings: WheelDesignBinding[];
  setDesign: (design: WheelDesignId) => void;
}

/** Unlike geometry.boundingBox this includes only vertices referenced by rendered triangles. */
export function indexedWorldBounds(mesh: THREE.Mesh): THREE.Box3 {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  const p = mesh.geometry.attributes.position, idx = mesh.geometry.index;
  if (!p) return box;
  mesh.updateWorldMatrix(true, false);
  for (let i=0; i<(idx?.count ?? p.count); i++) {
    box.expandByPoint(v.fromBufferAttribute(p,idx ? idx.getX(i) : i).applyMatrix4(mesh.matrixWorld));
  }
  return box;
}

// Rim-local XY is radial, +Z faces out of the car. Units are one rim radius.
function createRim(design: CustomDesignId, depth: number, badge?: THREE.Material): THREE.Group {
  const root = new THREE.Group();
  root.name = `Rim_${design}`;
  const colors = { 'split-y':0xc3c8d0, 'ten-spoke':0x59616f, 'cross-mesh':0xa48754,
    'five-blade':0xb5bdc9, 'aero-disc':0x8e99a9 };
  const face = new THREE.MeshPhysicalMaterial({ name:`Wheel_${design}_ForgedMetal`,color:colors[design],
    metalness:0.94,roughness:design==='cross-mesh'?0.31:0.24,clearcoat:0.35,clearcoatRoughness:0.22 });
  const lip = new THREE.MeshStandardMaterial({name:`Wheel_${design}_MachinedLip`,color:0xd2d8e1,metalness:0.98,roughness:0.19});
  const dark = new THREE.MeshStandardMaterial({name:`Wheel_${design}_Barrel`,color:0x242a33,metalness:0.86,roughness:0.32,side:THREE.DoubleSide});
  const bolt = new THREE.MeshStandardMaterial({name:`Wheel_${design}_Fasteners`,color:0x9399a2,metalness:1,roughness:0.22});
  const add = (g: THREE.BufferGeometry, m: THREE.Material, name: string, z=0) => {
    const mesh = new THREE.Mesh(g,m); mesh.name=name; mesh.position.z=z;
    mesh.castShadow=true; mesh.receiveShadow=true; root.add(mesh); return mesh;
  };
  const barrel = add(new THREE.CylinderGeometry(0.969,0.969,depth,64,1,true),dark,'Rim barrel',-depth/2);
  barrel.rotation.x=Math.PI/2;
  add(new THREE.TorusGeometry(0.969,0.027,8,64),lip,'Diamond-cut outer rim lip',0);
  add(new THREE.TorusGeometry(0.968,0.021,8,64),dark,'Inner barrel bead',-depth+0.02);
  const extrude = (shape: THREE.Shape, name:string, material=face, thickness=0.065) =>
    add(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSize:0.006,
      bevelThickness:0.006,bevelSegments:1,steps:1,curveSegments:16}),material,name,-0.075);
  const point = (r:number,a:number) => new THREE.Vector2(Math.sin(a)*r,Math.cos(a)*r);
  const beam = (a:THREE.Vector2,b:THREE.Vector2,w0:number,w1:number,name:string) => {
    const n=new THREE.Vector2(-(b.y-a.y),b.x-a.x).normalize();
    const s=new THREE.Shape();
    s.moveTo(a.x+n.x*w0/2,a.y+n.y*w0/2);
    s.lineTo(b.x+n.x*w1/2,b.y+n.y*w1/2);
    s.lineTo(b.x-n.x*w1/2,b.y-n.y*w1/2);
    s.lineTo(a.x-n.x*w0/2,a.y-n.y*w0/2); s.closePath();
    extrude(s,name);
  };
  if(design==='split-y') {
    for(let i=0;i<5;i++) {
      const a=i*Math.PI*2/5;
      beam(point(0.14,a),point(0.53,a),0.13,0.085,`Y-spoke ${i+1} stem`);
      for(const sign of [-1,1]) beam(point(0.48,a),point(0.945,a+sign*0.17),0.075,0.065,`Y-spoke ${i+1} branch ${sign}`);
    }
  } else if(design==='ten-spoke') {
    for(let i=0;i<10;i++) beam(point(0.15,i*Math.PI/5),point(0.945,i*Math.PI/5+0.055),0.072,0.049,`Forged spoke ${i+1}`);
  } else if(design==='cross-mesh') {
    for(let i=0;i<20;i++) for(const sign of [-1,1]) {
      const a=i*Math.PI/10;
      beam(point(0.20,a),point(0.943,a+sign*0.32),0.026,0.022,`Lattice spoke ${i+1} ${sign}`);
    }
    add(new THREE.TorusGeometry(0.79,0.014,6,64),face,'Lattice reinforcement ring',-0.048);
  } else if(design==='five-blade') {
    for(let i=0;i<5;i++) {
      const shape=new THREE.Shape();
      shape.moveTo(-0.09,0.14); shape.quadraticCurveTo(-0.06,0.58,0.02,0.945);
      shape.lineTo(0.25,0.91); shape.quadraticCurveTo(0.24,0.53,0.09,0.14); shape.closePath();
      const blade=extrude(shape,`Swept blade ${i+1}`);blade.rotation.z=i*Math.PI*2/5;
    }
  } else {
    const disc=new THREE.Shape();disc.absarc(0,0,0.943,0,Math.PI*2,false);
    const bore=new THREE.Path();bore.absarc(0,0,0.19,0,Math.PI*2,true);disc.holes.push(bore);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6, hole=new THREE.Path();
      const pts=[[-0.033,0.62],[-0.033,0.875],[0.033,0.875],[0.033,0.62]];
      pts.forEach(([x,y],j)=>{const xx=x*Math.cos(a)-y*Math.sin(a), yy=x*Math.sin(a)+y*Math.cos(a);if(j===0)hole.moveTo(xx,yy);else hole.lineTo(xx,yy);});
      hole.closePath();disc.holes.push(hole);
    }
    extrude(disc,'Vented aero disc',face,0.045);
    add(new THREE.TorusGeometry(0.53,0.006,4,64),lip,'Aero disc machined accent',-0.019);
  }
  const hub=add(new THREE.CylinderGeometry(0.163,0.185,0.105,32),face,'Centre-lock hub',-0.004);
  hub.rotation.x=Math.PI/2;
  const lock=add(new THREE.CylinderGeometry(0.095,0.095,0.055,6),bolt,'Centre-lock nut',0.067);
  lock.rotation.x=Math.PI/2;
  if(badge) add(new THREE.CircleGeometry(0.071,32),badge,'Original wheel crest',0.097);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    const screw=add(new THREE.CylinderGeometry(0.018,0.018,0.015,6),bolt,`Hub fastener ${i+1}`,0.05);
    screw.rotation.x=Math.PI/2;screw.position.x=Math.sin(a)*0.13;screw.position.y=Math.cos(a)*0.13;
  }
  return root;
}

/** Alternatives inherit each existing wheel assembly's explosion and inspection transforms. */
export function setupWheelDesigns(model: THREE.Object3D): WheelDesignController {
  model.updateWorldMatrix(true,true);
  const bindings: WheelDesignBinding[]=[];
  for(const name of ['Front_left_wheel','Front_right_wheel','Rear_left_wheel','Rear_right_wheel']) {
    const assembly=model.getObjectByName(name); if(!assembly) continue;
    const rims:THREE.Mesh[]=[];let badge:THREE.Material|undefined;
    assembly.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||o.name.startsWith('Rim_'))return;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      if(mats.some(m=>/_Rims[12]$/.test(m.name))) rims.push(o);
      if(!badge && mats.some(m=>/_RimBadges1$/.test(m.name))) badge=mats[0];
    });
    if(rims.length===0)continue;
    const bounds=new THREE.Box3();for(const rim of rims) bounds.union(indexedWorldBounds(rim));
    const size=bounds.getSize(new THREE.Vector3()), center=bounds.getCenter(new THREE.Vector3());
    const side=name.includes('_left_')?-1:1;
    // Place the new face inside the existing machined lip envelope, with the original axle/radius.
    const radius=Math.max(size.y,size.z)/2;
    center.x=(side<0?bounds.min.x:bounds.max.x)-side*radius*0.10;
    const depth=Math.max(radius*0.3,size.x-radius*0.125);
    const alternatives={} as Record<CustomDesignId,THREE.Group>;
    for(const design of WHEEL_DESIGNS) {
      if(design.id==='factory')continue;
      const root=createRim(design.id,depth/radius,badge);
      root.name=`CustomRim_${name}_${design.id}`;
      root.position.copy(center);root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),side*Math.PI/2);
      root.scale.setScalar(radius); root.updateMatrixWorld(true);
      assembly.attach(root); root.visible=false;
      root.userData.wheelDesign=design.id;
      alternatives[design.id]=root;
    }
    bindings.push({assembly,originalRims:rims,originalVisibility:rims.map(r=>r.visible),alternatives,center,radius,depth});
  }
  return {bindings,setDesign(design){
    for(const b of bindings) {
      b.originalRims.forEach((rim,i)=>{rim.visible=design==='factory' && b.originalVisibility[i];});
      for(const [id,root] of Object.entries(b.alternatives))root.visible=id===design;
    }
  }};
}
