import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {pistonPosition,buildEngineMechanism} from './engineMechanism';
import {prepareFinishMaterials,applyExperienceLayout,indexedBounds,fitVisibleScene} from './experienceScene';
import {capturePresentationGroupBindings,applyPresentationExplosion} from './explosionGroups';
import {setupPanelsAndSpatialLights,applyHingedPanelTransforms} from './lightsAndOpenings';
import {buildIllustrativeMechanicalLayer,applyMechanicalLayerExplosion} from './illustrativeMechanicalLayer';
import {PARTS_CATALOG,getTrayParts,connectedParts} from './experienceCatalog';
import type {ExperienceSceneOptions} from '../types/experience';
const options:ExperienceSceneOptions={tray:false,trayItems:[],hidden:[],isolated:null,cockpit:false,photo:false,lens:50,tour:false,active:true,caliper:'original',interior:'original',roof:'original'};

test('tilted V12 slider-crank preserves rod length throughout two crankshaft revolutions',()=>{
  for(const bank of [-32.5,32.5])for(let sample=0;sample<=720;sample++){
    const solution=pistonPosition(sample*Math.PI/180,bank*Math.PI/180);
    const piston=solution.axis.clone().multiplyScalar(solution.distance);
    assert.ok(Math.abs(piston.distanceTo(solution.pin)-.92)<1e-10);
    assert.ok(solution.distance>0);
    assert.ok(piston.clone().cross(solution.axis).length()<1e-10,'Pistons remain on their cylinder axes');
  }
});
test('engine lab contains twelve pistons and rods and exposes every four-stroke phase',()=>{
  const engine=buildEngineMechanism();
  assert.equal(engine.groups.get('pistons')!.children.filter(o=>o instanceof THREE.Group).length,12);
  assert.equal(engine.groups.get('rods')!.children.length,12);
  const phases=new Set<number>();for(let angle=0;angle<4*Math.PI;angle+=.1)phases.add(engine.update(angle,.6,'all'));
  assert.deepEqual([...phases],[0,1,2,3]);
  engine.update(1,.6,'crankshaft');assert.ok(engine.groups.get('crankshaft')!.visible);assert.equal(engine.groups.get('heads')!.visible,false);
  engine.update(1,0,'all');assert.ok([...engine.groups.values()].every(g=>g.visible));
});
test('assembly catalogue and tray paging preserve all 32 assemblies without duplicates',()=>{
  assert.equal(PARTS_CATALOG.length,32);
  const pages=Array.from({length:6},(_,page)=>getTrayParts('all',page)).flat();
  assert.equal(new Set(pages.map(p=>p.nodeName)).size,32);
  assert.ok(connectedParts('Front_left_wheel').includes('Front_left_brake'));
  assert.ok(connectedParts('Mech_V12_Engine_Block').includes('Mech_Twin_Cam_Covers'));
});
test('real SP3: finish changes target calipers, leather and hardtop; tray restores exact car transforms',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);loader.register(()=>({name:'qa-no-images',loadTexture:async()=>new THREE.Texture()}));
  const bytes=await fs.readFile('public/models/daytona-sp3-web.glb');
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);scene.position.sub(new THREE.Box3().setFromObject(scene).getCenter(new THREE.Vector3()));scene.updateMatrixWorld(true);
  const rig=setupPanelsAndSpatialLights(scene,true);
  const finishes=prepareFinishMaterials(scene);
  const roof:THREE.Mesh[]=[],calipers:THREE.Mesh[]=[];
  scene.traverse(o=>{if(o instanceof THREE.Mesh){if(o.userData.isHardtop)roof.push(o);if((o.material as THREE.Material)?.name.endsWith('_Calipers'))calipers.push(o);}});
  assert.ok(roof.length>0,'The actual opaque hardtop has a separate finish');assert.equal(calipers.length,4);
  const originals=calipers.map(m=>(m.material as THREE.MeshStandardMaterial).color.clone());
  const paint=scene.getObjectByName('Left_bodywork__Rosso_Magma__DoorPanel') as THREE.Mesh;const paintMaterial=paint.material;
  finishes.apply({...options,caliper:'#e6bd37',interior:'tan',roof:'carbon'},'#7c8490');
  assert.ok(calipers.every(m=>(m.material as THREE.MeshStandardMaterial).color.getHexString()==='e6bd37'));
  assert.equal(paint.material,paintMaterial,'Finish controls must not replace painted door materials');
  finishes.apply(options,'#d41217');calipers.forEach((m,i)=>assert.ok((m.material as THREE.MeshStandardMaterial).color.equals(originals[i])));
  const exterior=capturePresentationGroupBindings(scene),mechanical=buildIllustrativeMechanicalLayer();
  // Production keeps the mechanical root beside the centred GLB, outside its imported transform.
  const stage=new THREE.Group();stage.add(scene,mechanical.rootGroup);stage.updateMatrixWorld(true);
  const bindings=[...exterior,...mechanical.bindings];
  for(let page=0;page<6;page++){
    applyPresentationExplosion(exterior,0);applyMechanicalLayerExplosion(mechanical.bindings,0);
    const parts=getTrayParts('all',page);
    applyExperienceLayout(bindings,{...options,tray:true,trayItems:parts.map(p=>p.nodeName)});scene.updateMatrixWorld(true);
    for(const [i,part] of parts.entries()){
      const object=bindings.find(b=>b.spec.nodeName===part.nodeName)!.object;
      const box=new THREE.Box3();object.traverseVisible(o=>{if(o instanceof THREE.Mesh)box.union(indexedBounds(o));});
      assert.ok(!box.isEmpty());const centre=box.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(centre.x-(i%3-1)*7)<.02,`${part.nodeName} is not in its tray column`);
      assert.ok(Math.abs(centre.z-(Math.floor(i/3)-.5)*7)<.02,`${part.nodeName} is not in its tray row`);
    }
  }
  applyPresentationExplosion(exterior,0);applyMechanicalLayerExplosion(mechanical.bindings,0);applyHingedPanelTransforms(rig.hingedPanels,0,0,0);
  for(const binding of bindings){assert.ok(binding.object.position.distanceTo(binding.origLocalPosition)<1e-9);assert.ok(binding.object.quaternion.angleTo(binding.origLocalQuaternion)<1e-7);assert.ok(binding.object.scale.distanceTo(binding.origLocalScale)<1e-9);}
  applyExperienceLayout(bindings,{...options,hidden:['Front_left_wheel'],isolated:'Rear_bodywork'});
  assert.equal(exterior.find(b=>b.spec.nodeName==='Front_left_wheel')!.object.visible,false);assert.ok(exterior.find(b=>b.spec.nodeName==='Rear_bodywork')!.object.visible);
  finishes.dispose();
});
test('adaptive framing fits both landscape and portrait without clipping sampled geometry',()=>{
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(5,3,12),new THREE.MeshBasicMaterial()));
  for(const aspect of [16/9,1,9/16]){
    const camera=new THREE.PerspectiveCamera(40,aspect,.01,1000),target=new THREE.Vector3();
    const controls={target,update(){camera.lookAt(target);camera.updateMatrixWorld();}};
    fitVisibleScene(camera,controls,[root],new THREE.Vector3(.68,.25,.68));
    root.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const point=new THREE.Vector3().fromBufferAttribute(p,i).project(camera);assert.ok(Math.abs(point.x)<=1&&Math.abs(point.y)<=1);}}});
  }
});
