import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildEngineMechanism,ENGINE_PARTS,STROKES,type EnginePartId} from '../utils/engineMechanism';
import {captureScenePhoto} from '../utils/experienceScene';
import type {StudioApi} from '../types/experience';
import type {LightingPresetId} from '../types/studio';

export function EngineLab({photo,lens,lighting,reducedMotion,onBack,onApiReady,onEnginePlayChange}:{photo:boolean;lens:number;lighting:LightingPresetId;reducedMotion:boolean;onBack:()=>void;onApiReady:(api:StudioApi|null)=>void;onEnginePlayChange?:(playing:boolean)=>void}) {
  const mount=useRef<HTMLDivElement>(null);
  const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(.5),[section,setSection]=useState(.57),[selected,setSelected]=useState<EnginePartId>('all'),[stroke,setStroke]=useState(0);
  const state=useRef({playing,speed,section,selected});state.current={playing,speed,section,selected};
  const apiCallback=useRef(onApiReady);apiCallback.current=onApiReady;
  const wake=useRef<()=>void>(()=>{});
  const runtime=useRef<{camera:THREE.PerspectiveCamera;controls:OrbitControls;renderer:THREE.WebGLRenderer;key:THREE.DirectionalLight;rim:THREE.DirectionalLight}|null>(null);
  useEffect(()=>{
    const container=mount.current;if(!container)return;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.90;
    renderer.domElement.setAttribute('aria-label','Illustrative V12 working engine cutaway');renderer.domElement.dataset.testid='engine-lab-canvas';container.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.05,100);camera.position.set(7,5,8);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.8,0);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=18;controls.maxPolarAngle=Math.PI*.53;
    const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(new RoomEnvironment(),.05);scene.environment=env.texture;pmrem.dispose();
    scene.environmentIntensity=.7;scene.add(new THREE.HemisphereLight(0xd9eaff,0x11151d,1.3));
    const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(4,8,5);scene.add(key);const rim=new THREE.DirectionalLight(0xffbba8,1.6);rim.position.set(-5,3,-3);scene.add(rim);
    runtime.current={camera,controls,renderer,key,rim};
    const mechanism=buildEngineMechanism();scene.add(mechanism.root);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(6,80),new THREE.MeshBasicMaterial({color:'#141b25'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.57;scene.add(floor);
    let frame=0,disposed=false,lastTime=0,angle=0,lastStroke=-1,idleFrames=0;
    function draw(time:number) {
      if(disposed)return;
      const dt=Math.min(.05,(time-lastTime)/1000||0);lastTime=time;
      if(state.current.playing)angle+=dt*state.current.speed*3;
      const phase=mechanism.update(angle,state.current.section,state.current.selected);
      if(phase!==lastStroke){setStroke(phase);lastStroke=phase;}
      controls.update();renderer.render(scene,camera);renderer.domElement.dataset.stroke=STROKES[phase].name;renderer.domElement.dataset.playing=String(state.current.playing);
      if(state.current.playing||idleFrames++<50)frame=requestAnimationFrame(draw);else frame=0;
    }
    wake.current=()=>{idleFrames=0;if(!frame){lastTime=performance.now();frame=requestAnimationFrame(draw);}};
    controls.addEventListener('change',wake.current);
    const resize=()=>{const width=container.clientWidth,height=container.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();wake.current();};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    apiCallback.current({capture:options=>captureScenePhoto(renderer,scene,camera,options,controls.target)});
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();runtime.current=null;apiCallback.current(null);mechanism.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});env.dispose();floor.geometry.dispose();(floor.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove();};
  },[]);
  useEffect(()=>{const h=runtime.current;if(!h)return;const next=photo?THREE.MathUtils.radToDeg(2*Math.atan(24/(2*lens))):38;const factor=Math.tan(THREE.MathUtils.degToRad(h.camera.fov/2))/Math.tan(THREE.MathUtils.degToRad(next/2));h.camera.position.sub(h.controls.target).multiplyScalar(factor).add(h.controls.target);h.camera.fov=next;h.camera.updateProjectionMatrix();h.key.color.set(lighting==='rosso'?'#ffdfcc':'#eef6ff');h.rim.color.set(lighting==='technical'?'#9acbff':lighting==='rosso'?'#ff687d':'#ffbba8');h.renderer.toneMappingExposure=lighting==='technical'?.96:.9;wake.current();},[photo,lens,lighting]);
  useEffect(()=>{if(reducedMotion)setPlaying(false);},[reducedMotion]);
  useEffect(()=>{if(runtime.current)runtime.current.renderer.domElement.dataset.playing=String(playing);wake.current();},[playing,speed,section,selected]);
  const part=ENGINE_PARTS.find(p=>p.id===selected)!;
  return <section className={`engine-lab ${photo?'photo-lab':''}`} aria-label="Engine anatomy lab">
    <div className="engine-lab-stage" ref={mount}/>
    {!photo&&<>
      <aside className="experience-panel engine-lab-panel">
        <button className="text-action" onClick={onBack}>← Back to SP3</button>
        <p className="eyebrow">ANATOMY / POWERTRAIN</p><h2>Inside the V12.</h2><p className="muted">Illustrative mechanical reconstruction</p>
        <nav aria-label="Engine component hierarchy" className="engine-parts">{ENGINE_PARTS.map((p,i)=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}><span>{String(i).padStart(2,'0')}</span>{p.name}</button>)}</nav>
        <article className="part-explainer"><h3>{part.name}</h3><p>{part.description}</p></article>
        <label className="range-label">Section depth <output>{Math.round(section*100)}%</output><input aria-label="Engine section depth" type="range" min="0" max="1" step=".01" value={section} onChange={e=>setSection(+e.target.value)}/></label>
        <div className="stroke-display" style={{'--stroke-color':STROKES[stroke].color} as React.CSSProperties}><span>{STROKES[stroke].name}</span><p>{STROKES[stroke].description}</p></div>
      </aside>
      <div className="engine-playback experience-panel">
        <button className="primary-action" aria-pressed={playing} onClick={()=>{const next=!playing;setPlaying(next);onEnginePlayChange?.(next);}}>{playing?'Pause engine':'Play engine'}</button>
        <label className="range-label">Animation speed <output>{speed.toFixed(1)}×</output><input aria-label="Engine animation speed" type="range" min=".1" max="2" step=".1" value={speed} onChange={e=>setSpeed(+e.target.value)}/></label>
        <div className="stroke-display" style={{'--stroke-color':STROKES[stroke].color} as React.CSSProperties}><span>{STROKES[stroke].name}</span><p>{STROKES[stroke].description}</p></div>
      </div>
      <div className="engine-lab-caption"><span>65° V12</span><span>12 pistons · 4 strokes · 2 crankshaft turns</span></div>
    </>}
  </section>;
}
