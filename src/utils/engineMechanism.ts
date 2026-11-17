import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const ENGINE_PARTS = [
  {id:'all',name:'Complete V12',description:'An illustrative 65° V12 assembly. Explore the parts, then play the mechanism to see how they work together.'},
  {id:'block',name:'Cylinder block',description:'The block holds two banks of six cylinder bores and supports the crankshaft. Move the section slider to reveal the internals.'},
  {id:'pistons',name:'Pistons & rings',description:'Twelve pistons slide inside the cylinder liners. Their rings seal the combustion chamber while allowing the pistons to move.'},
  {id:'rods',name:'Connecting rods',description:'Each rod links a piston to a crank pin, turning the piston’s straight-line movement into rotation.'},
  {id:'crankshaft',name:'Crankshaft',description:'Offset crank pins collect force from the connecting rods. Counterweights balance some of the moving mass.'},
  {id:'valvetrain',name:'Valves & camshafts',description:'The camshafts run at half crankshaft speed. Intake and exhaust valves open during different stages of the four-stroke cycle.'},
  {id:'heads',name:'Cylinder heads',description:'The two heads close the cylinders and contain the valves, spark plugs and passages for intake air and exhaust gas.'},
  {id:'intake',name:'Intake runners',description:'Twelve runners guide incoming air towards the cylinders. The two plenums distribute air to the two banks.'},
] as const;
export type EnginePartId = typeof ENGINE_PARTS[number]['id'];
export const STROKES = [
  {name:'Intake',color:'#42b8ff',description:'The piston descends as the intake valves admit fresh air.'},
  {name:'Compression',color:'#edc55a',description:'Both valve sets close and the rising piston compresses the charge.'},
  {name:'Power',color:'#ff6742',description:'Ignition raises pressure and drives the piston down.'},
  {name:'Exhaust',color:'#ae8bff',description:'The piston rises while the exhaust valves release the spent gases.'},
] as const;
/** Slider-crank solution in a tilted cylinder plane; rod length stays constant. */
export function pistonPosition(theta:number,bankAngle:number,radius=.23,rodLength=.92) {
  const axis=new THREE.Vector3(Math.sin(bankAngle),Math.cos(bankAngle),0);
  const pin=new THREE.Vector3(Math.cos(theta)*radius,Math.sin(theta)*radius,0);
  const along=axis.dot(pin);
  return {axis,pin,distance:along+Math.sqrt(Math.max(0,rodLength*rodLength-pin.lengthSq()+along*along))};
}
export function buildEngineMechanism() {
  const root=new THREE.Group();root.name='Illustrative_V12_Lab';
  const groups=new Map<EnginePartId,THREE.Group>();
  for(const part of ENGINE_PARTS.filter(p=>p.id!=='all')){const group=new THREE.Group();group.name=part.name;groups.set(part.id,group);root.add(group);}
  const sectionPlane=new THREE.Plane(new THREE.Vector3(-1,0,0),2.4);
  const materials={
    aluminium:new THREE.MeshStandardMaterial({color:'#8e9aa6',metalness:.78,roughness:.28}),
    steel:new THREE.MeshStandardMaterial({color:'#505b68',metalness:.9,roughness:.22}),
    piston:new THREE.MeshStandardMaterial({color:'#c1ccd6',metalness:.85,roughness:.2}),
    ring:new THREE.MeshStandardMaterial({color:'#303941',metalness:.88,roughness:.27}),
    red:new THREE.MeshStandardMaterial({color:'#a91624',metalness:.38,roughness:.44}),
    carbon:new THREE.MeshStandardMaterial({color:'#172029',metalness:.25,roughness:.44}),
    liner:new THREE.MeshStandardMaterial({color:'#a6d1e5',metalness:.3,roughness:.25,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),
    block:new THREE.MeshStandardMaterial({color:'#6b7886',metalness:.72,roughness:.34,side:THREE.DoubleSide}),
  };
  function mesh(group:EnginePartId,geo:THREE.BufferGeometry,mat:THREE.Material,pos:THREE.Vector3|[number,number,number]) {
    const obj=new THREE.Mesh(geo,mat);Array.isArray(pos)?obj.position.set(...pos):obj.position.copy(pos);obj.castShadow=true;obj.receiveShadow=true;groups.get(group)!.add(obj);return obj;
  }
  const pistons:Array<{body:THREE.Group;rod:THREE.Mesh;gas:THREE.Mesh;valves:THREE.Mesh[];z:number;bank:number;phase:number}>=[];
  const crank=groups.get('crankshaft')!;
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,5.2,28),materials.steel);shaft.rotation.x=Math.PI/2;crank.add(shaft);
  for(let i=0;i<7;i++) {
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.15,32),materials.steel);disc.rotation.x=Math.PI/2;disc.position.z=-2.25+i*.75;crank.add(disc);
    const cap=mesh('block',new THREE.BoxGeometry(.66,.22,.23),materials.aluminium,[0,-.32,disc.position.z]);cap.name=`Main bearing cap ${i+1}`;
  }
  for(let i=0;i<6;i++){
    const phase=i*Math.PI/3,pin=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.23,20),materials.steel);
    pin.rotation.x=Math.PI/2;pin.position.set(.23*Math.cos(phase),.23*Math.sin(phase),-1.875+i*.75);crank.add(pin);
    const web=new THREE.Mesh(new THREE.BoxGeometry(.30,.11,.10),materials.steel);web.position.copy(pin.position).multiply(new THREE.Vector3(.5,.5,1));web.rotation.z=phase;crank.add(web);
  }
  const camshafts:THREE.Mesh[]=[];
  for(const side of [-1,1]) {
    const angle=side*THREE.MathUtils.degToRad(32.5),axis=new THREE.Vector3(Math.sin(angle),Math.cos(angle),0);
    const block=mesh('block',new RoundedBoxGeometry(.78,1.3,4.9,2,.06),materials.block,axis.clone().multiplyScalar(.83));block.rotation.z=-angle;
    const head=mesh('heads',new RoundedBoxGeometry(.87,.24,4.95,2,.07),materials.red,axis.clone().multiplyScalar(1.65));head.rotation.z=-angle;
    for(let rib=0;rib<5;rib++){const detail=new THREE.Mesh(new THREE.BoxGeometry(.025,.014,4.3),materials.aluminium);detail.position.set((rib-2)*.12,.126,0);head.add(detail);}
    for(let c=0;c<2;c++) {
      const cam=mesh('valvetrain',new THREE.CylinderGeometry(.045,.045,4.9,16),materials.steel,[axis.x*1.9+(c?1:-1)*.18,axis.y*1.9,0]);cam.rotation.x=Math.PI/2;camshafts.push(cam);
    }
    for(let i=0;i<6;i++) {
      const z=-1.875+i*.75;
      const liner=mesh('block',new THREE.CylinderGeometry(.285,.285,.85,28,1,true),materials.liner,axis.clone().multiplyScalar(1.25).setZ(z));liner.rotation.z=-angle;
      const body=new THREE.Group();groups.get('pistons')!.add(body);body.rotation.z=-angle;body.name=`${side<0?'Left':'Right'} piston ${i+1}`;
      const crown=new THREE.Mesh(new THREE.CylinderGeometry(.255,.25,.26,32),materials.piston);body.add(crown);
      for(let ring=0;ring<3;ring++){const band=new THREE.Mesh(new THREE.TorusGeometry(.254,.014,6,28),materials.ring);band.rotation.x=Math.PI/2;band.position.y=.09-ring*.042;body.add(band);}
      const wrist=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.52,16),materials.steel);wrist.rotation.z=Math.PI/2;body.add(wrist);
      const rod=mesh('rods',new THREE.CylinderGeometry(.045,.065,1,12),materials.aluminium,[0,0,z]);rod.name=`Connecting rod ${side<0?'L':'R'}${i+1}`;
      const gasMaterial=new THREE.MeshBasicMaterial({color:STROKES[0].color,transparent:true,opacity:.26,depthWrite:false});
      const gas=mesh('pistons',new THREE.CylinderGeometry(.245,.245,1,24),gasMaterial,[0,0,z]);gas.rotation.z=-angle;
      const valves:THREE.Mesh[]=[];
      for(let v=0;v<4;v++) {
        const valve=mesh('valvetrain',new THREE.CylinderGeometry(.025,.025,.3,10),materials.steel,[axis.x*1.58+(v%2?1:-1)*.10,axis.y*1.58,z+(v<2?-.1:.1)]);valve.rotation.z=-angle;
        const disk=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.026,14),materials.aluminium);disk.position.y=-.15;valve.add(disk);valves.push(valve);
      }
      const runner=mesh('intake',new THREE.CylinderGeometry(.105,.14,.42,20),materials.aluminium,[axis.x*.9,1.97,z]);runner.rotation.z=side*.45;
      const bolt=mesh('heads',new THREE.CylinderGeometry(.055,.055,.16,6),materials.steel,[axis.x*1.7,axis.y*1.7+.13,z]);bolt.name=`Head fastener ${i+1}`;
      const rib=mesh('block',new RoundedBoxGeometry(.12,.72,.36,1,.035),materials.aluminium,[axis.x*.8+side*.43,.54,z]);rib.rotation.z=-angle;
      pistons.push({body,rod,gas,valves,z,bank:angle,phase:i*Math.PI/3});
    }
    const plenum=mesh('intake',new RoundedBoxGeometry(.48,.28,4.4,3,.12),materials.carbon,[side*.39,2.25,0]);plenum.name='Carbon intake plenum';
  }
  const crankcase=mesh('block',new RoundedBoxGeometry(1.1,.45,5,2,.1),materials.block,[0,-.3,0]);crankcase.name='Crankcase and oil sump';
  const rodAxis=new THREE.Vector3(0,1,0),delta=new THREE.Vector3();
  let wasSectioned=false;
  return {
    root,groups,
    update(angle:number,section:number,selected:EnginePartId) {
      crank.rotation.z=angle;
      camshafts.forEach(c=>c.rotation.y=angle/2);
      sectionPlane.constant=2.4-section*4.8;
      const sectioned=section>.01;
      if(wasSectioned!==sectioned){materials.block.clippingPlanes=sectioned?[sectionPlane]:[];materials.block.needsUpdate=true;wasSectioned=sectioned;}
      for(const [id,group] of groups)group.visible=selected==='all'||id===selected||(selected==='pistons'&&(id==='crankshaft'||id==='rods'))||(selected==='rods'&&id==='crankshaft');
      for(const p of pistons) {
        const phase=angle+p.phase,solution=pistonPosition(phase,p.bank);
        const piston=solution.axis.clone().multiplyScalar(solution.distance).setZ(p.z);
        p.body.position.copy(piston);
        const pin=solution.pin.clone().setZ(p.z);p.rod.position.copy(pin).add(piston).multiplyScalar(.5);delta.copy(piston).sub(pin);p.rod.scale.y=delta.length();p.rod.quaternion.setFromUnitVectors(rodAxis,delta.normalize());
        const cycle=((phase%(Math.PI*4))+Math.PI*4)%(Math.PI*4),stroke=Math.floor(cycle/Math.PI);
        (p.gas.material as THREE.MeshBasicMaterial).color.set(STROKES[stroke].color);
        const gap=Math.max(.02,1.57-solution.distance-.13);p.gas.scale.y=gap;p.gas.position.copy(solution.axis).multiplyScalar(solution.distance+.13+gap/2).setZ(p.z);
        p.valves.forEach((v,index)=>{const active=index<2?stroke===0:stroke===3;const lift=active?.085*Math.sin(cycle%Math.PI):0;v.position.y=solution.axis.y*1.58-lift;});
      }
      return Math.floor((((angle%(Math.PI*4))+Math.PI*4)%(Math.PI*4))/Math.PI);
    }
  };
}
