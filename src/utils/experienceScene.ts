import * as THREE from 'three';
import type { CapturedGroupBinding } from './explosionGroups';
import type { CapturedMechanicalBinding } from './illustrativeMechanicalLayer';
import type { ExperienceSceneOptions, PhotoOptions } from '../types/experience';

type Binding = CapturedGroupBinding | CapturedMechanicalBinding;
const position = new THREE.Vector3();
export function indexedBounds(mesh: THREE.Mesh): THREE.Box3 {
  const box=new THREE.Box3(), p=mesh.geometry.attributes.position, idx=mesh.geometry.index;
  mesh.updateWorldMatrix(true,false);
  for(let i=0;i<(idx?.count??p?.count??0);i++)box.expandByPoint(position.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld));
  return box;
}
function subset(source: THREE.BufferGeometry, indices: number[]) {
  const geometry=source.clone().setIndex(indices), box=new THREE.Box3(), point=new THREE.Vector3();
  for(const index of indices)box.expandByPoint(point.fromBufferAttribute(source.attributes.position,index));
  geometry.boundingBox=box;geometry.boundingSphere=box.isEmpty()?new THREE.Sphere(new THREE.Vector3(),0):box.getBoundingSphere(new THREE.Sphere());
  return geometry;
}
/** Split only the opaque hardtop surface; leave door glass, roll hoop and windscreen intact. */
export function prepareFinishMaterials(model: THREE.Object3D) {
  const sources: THREE.Mesh[]=[];
  model.traverse(o=>{if(o instanceof THREE.Mesh && /^Underbody_and_trim__/.test(o.name) && /Black1|BlackTrims|UnderCarrier/.test(o.name))sources.push(o);});
  for(const mesh of sources) {
    const p=mesh.geometry.attributes.position, idx=mesh.geometry.index;
    if(!p||!idx)continue;
    mesh.updateWorldMatrix(true,false);
    const roof:number[]=[],rest:number[]=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),centroid=new THREE.Vector3();
    for(let i=0;i<idx.count;i+=3) {
      a.fromBufferAttribute(p,idx.getX(i)).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,idx.getX(i+1)).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,idx.getX(i+2)).applyMatrix4(mesh.matrixWorld);
      centroid.copy(a).add(b).add(c).divideScalar(3);
      const chosen=centroid.y>1.15 && Math.abs(centroid.x)<1.32 && centroid.z>-.95 && centroid.z<.85;
      (chosen?roof:rest).push(idx.getX(i),idx.getX(i+1),idx.getX(i+2));
    }
    if(roof.length<30)continue;
    const original=mesh.geometry;
    const material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).clone() as THREE.MeshStandardMaterial;
    const roofMesh=new THREE.Mesh(subset(original,roof),material);
    roofMesh.name=`${mesh.name}__HardtopFinish`;roofMesh.position.copy(mesh.position);roofMesh.quaternion.copy(mesh.quaternion);roofMesh.scale.copy(mesh.scale);
    roofMesh.castShadow=true;roofMesh.receiveShadow=true;roofMesh.userData.isHardtop=true;
    mesh.geometry=subset(original,rest);mesh.parent!.add(roofMesh);
  }
  const finishes: Array<{mesh:THREE.Mesh; material:THREE.MeshStandardMaterial; color:THREE.Color; map:THREE.Texture|null; roughness:number; metalness:number; kind:'caliper'|'interior'|'roof'}>=[];
  model.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const point=new THREE.Vector3(),box=new THREE.Box3(),indices=o.geometry.index,positions=o.geometry.attributes.position;
    for(let i=0;i<(indices?.count??positions?.count??0);i++)box.expandByPoint(point.fromBufferAttribute(positions,indices?indices.getX(i):i));
    o.geometry.boundingBox=box;o.geometry.boundingSphere=box.isEmpty()?new THREE.Sphere(new THREE.Vector3(),0):box.getBoundingSphere(new THREE.Sphere());
    const m=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshStandardMaterial;
    if(/wheel_001$/.test(m?.name)){m.roughness=.85;m.metalness=.02;}
    const kind=o.userData.isHardtop?'roof':/_Calipers$/.test(m?.name)?'caliper':/BlackSeats|v_int_leather_NERO/.test(m?.name)?'interior':null;
    if(!kind||!m?.isMeshStandardMaterial)return;
    const material=m.clone();o.material=material;
    finishes.push({mesh:o,material,color:material.color.clone(),map:material.map,roughness:material.roughness,metalness:material.metalness,kind});
  });
  let weave:THREE.CanvasTexture|null=null;
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d')!;
    context.fillStyle='#24282c';context.fillRect(0,0,128,128);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){context.fillStyle=(x+y)%4<2?'#41464b':'#15191e';context.fillRect(x*8,y*8,7,7);}
    weave=new THREE.CanvasTexture(canvas);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(12,12);weave.colorSpace=THREE.SRGBColorSpace;
  }
  return {
    count:finishes.length,
    apply(options:ExperienceSceneOptions,paintHex:string) {
      for(const f of finishes) {
        const value=f.kind==='roof'?options.roof:f.kind==='interior'?options.interior:options.caliper;
        const m=f.material;m.color.copy(f.color);m.map=f.map;m.roughness=f.roughness;m.metalness=f.metalness;
        if(value!=='original') {
          if(f.kind==='caliper'){m.color.set(value);m.map=null;m.roughness=.28;}
          if(f.kind==='interior'){m.color.set(value==='tan'?'#ad7650':value==='red'?'#731b22':'#17191c');m.map=null;m.roughness=.74;m.metalness=.03;}
          if(f.kind==='roof'){m.color.set(value==='carbon'?'#8d969e':paintHex);m.map=value==='carbon'?weave:null;m.roughness=value==='carbon'?.36:.22;m.metalness=value==='carbon'?.25:.35;}
        }
        m.needsUpdate=true;
      }
    },
    dispose(){weave?.dispose();}
  };
}

/** Layout uses stored assembly transforms, so leaving the tray restores hinges and explosion exactly. */
export function applyExperienceLayout(bindings:readonly Binding[], options:ExperienceSceneOptions) {
  const shown=new Set(options.trayItems);
  for(const binding of bindings) {
    const object=binding.object;
    if(options.tray) {
      const index=options.trayItems.indexOf(binding.spec.nodeName);
      object.visible=shown.has(binding.spec.nodeName);
      if(index<0)continue;
      const turn=binding.spec.nodeName.match(/^(Front|Rear)_(left|right)_(wheel|brake)$/);
      const angle=turn?(turn[2]==='left'?Math.PI/2:-Math.PI/2):binding.spec.nodeName==='Left_bodywork'?Math.PI/2:binding.spec.nodeName==='Right_bodywork'?-Math.PI/2:binding.spec.nodeName==='Rear_bodywork'?Math.PI:0;
      const deltaRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
      const parentRotation=binding.parent.getWorldQuaternion(new THREE.Quaternion());
      object.quaternion.copy(parentRotation).invert().multiply(deltaRotation).multiply(parentRotation).multiply(binding.origLocalQuaternion);
      const size=binding.origWorldBox.getSize(new THREE.Vector3());
      const scale=Math.min(1.5,5.3/Math.max(size.x,size.y,size.z,.1));
      object.scale.copy(binding.origLocalScale).multiplyScalar(scale);
      const x=(index%3-1)*7, z=(Math.floor(index/3)-.5)*7;
      const origin=binding.parent.localToWorld(binding.origLocalPosition.clone());
      const delta=binding.origWorldCenter.clone().sub(origin).multiplyScalar(scale).applyQuaternion(deltaRotation);
      const target=new THREE.Vector3(x, .5+size.y*scale/2,z).sub(delta);
      object.position.copy(binding.parent.worldToLocal(target));
    }
    if(options.revealed?.includes(binding.spec.nodeName))object.visible=true;
    if(options.hidden.includes(binding.spec.nodeName))object.visible=false;
    if(options.isolated && options.isolated!==binding.spec.nodeName)object.visible=false;
    if(options.isolated===binding.spec.nodeName)object.visible=true;
  }
}

export function fitVisibleScene(camera:THREE.PerspectiveCamera, controls:{target:THREE.Vector3;update:()=>unknown}, roots:THREE.Object3D[], direction:THREE.Vector3, margin=1.16) {
  const box=new THREE.Box3(),points:THREE.Vector3[]=[];
  roots.forEach(root=>{root.updateWorldMatrix(true,true);root.traverseVisible(o=>{
    if(!(o instanceof THREE.Mesh)||!o.geometry.attributes.position)return;
    const geometry=o.geometry,p=geometry.attributes.position,idx=geometry.index,count=idx?.count??p.count;
    if(!count)return;
    let samples=geometry.userData.framingSamples as THREE.Vector3[]|undefined;
    if(!samples){samples=[];for(let i=0;i<count;i+=Math.max(1,Math.floor(count/160)))samples.push(new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i):i));geometry.userData.framingSamples=samples;}
    samples.forEach(sample=>{const point=sample.clone().applyMatrix4(o.matrixWorld);box.expandByPoint(point);points.push(point);});
  });});
  if(box.isEmpty())return;
  const center=box.getCenter(new THREE.Vector3()), size=box.getSize(new THREE.Vector3());
  const vFov=THREE.MathUtils.degToRad(camera.fov), hFov=2*Math.atan(Math.tan(vFov/2)*camera.aspect);
  direction.normalize();const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  let distance=0;
  for(const point of points){const corner=point.sub(center);distance=Math.max(distance,Math.abs(corner.dot(right))/Math.tan(hFov/2)+corner.dot(direction),Math.abs(corner.dot(up))/Math.tan(vFov/2)+corner.dot(direction));}
  controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,Math.max(1,distance)*margin);camera.updateProjectionMatrix();controls.update();
}

/** Render at the requested resolution using the same colour pipeline as the live view. */
export async function captureScenePhoto(renderer:THREE.WebGLRenderer, scene:THREE.Scene, camera:THREE.PerspectiveCamera, options:PhotoOptions,focus?:THREE.Vector3):Promise<Blob> {
  const scale=Math.min(1,4096/options.width,4096/options.height,renderer.capabilities.maxTextureSize/Math.max(options.width,options.height));
  const width=Math.round(options.width*scale),height=Math.round(options.height*scale);
  const oldTarget=renderer.getRenderTarget(),oldAspect=camera.aspect,oldSize=renderer.getSize(new THREE.Vector2()),oldPixelRatio=renderer.getPixelRatio(),oldPosition=camera.position.clone();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;
  const background=ctx.createRadialGradient(width*.45,height*.35,0,width*.5,height*.5,width*.8);
  background.addColorStop(0,options.backdrop==='rosso'?'#302027':options.backdrop==='technical'?'#233247':'#26303d');background.addColorStop(1,'#080b12');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
  try {
    camera.aspect=width/height;if(focus&&camera.aspect<oldAspect)camera.position.copy(focus).add(oldPosition.clone().sub(focus).multiplyScalar(oldAspect/camera.aspect));camera.updateProjectionMatrix();renderer.setRenderTarget(null);renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,width,height);
  } finally {
    renderer.setRenderTarget(oldTarget);renderer.setPixelRatio(oldPixelRatio);renderer.setSize(oldSize.x,oldSize.y,false);camera.aspect=oldAspect;camera.position.copy(oldPosition);camera.updateProjectionMatrix();renderer.render(scene,camera);
  }
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create the photograph.')),'image/png'));
}
