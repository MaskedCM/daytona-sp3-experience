import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {StudioCanvas} from './components/StudioCanvas';
import {ReferenceModal} from './components/ReferenceModal';
import {ExperienceControls} from './components/ExperienceControls';
import {EngineLab} from './components/EngineLab';
import {PARTS_CATALOG,connectedParts,getTrayParts} from './utils/experienceCatalog';
import {isWheelDesign} from './utils/wheelDesigns';
import {DEFAULT_SETTINGS,type StudioSettings,type ExperienceMode,type StudioApi,type ExperienceSceneOptions} from './types/experience';
import type {ViewerStatus,StudioErrorState} from './types/studio';
import {SoundEngine,DEFAULT_SOUND_VOLUME,type SoundEngineState} from './audio/soundEngine';

gsap.registerPlugin(ScrollTrigger);
function initialSettings():StudioSettings {
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wheel=DEFAULT_SETTINGS.wheel;
  try{const saved=localStorage.getItem('daytona-wheel-design');if(isWheelDesign(saved))wheel=saved;}catch{}
  return {...DEFAULT_SETTINGS,wheel,reducedMotion:reduced,rotate:!reduced,tour:!reduced};
}
const INITIAL_SOUND_STATE:SoundEngineState={
  enabled:false,
  muted:false,
  volume:DEFAULT_SOUND_VOLUME,
  loadState:'idle',
  engineState:'stopped',
  cockpit:false,
  rearCoverOpen:false,
  errorMessage:null,
  activeVoiceCount:0,
};
export default function App() {
  const [settings,setSettings]=useState<StudioSettings>(initialSettings);
  const stateRef=useRef(settings);stateRef.current=settings;
  const [progress,setProgress]=useState(0),progressRef=useRef(0);
  const [selected,setSelected]=useState<string|null>(null),[status,setStatus]=useState<ViewerStatus>('loading');
  const [loading,setLoading]=useState({percent:8,text:'Preparing the SP3 studio…'}),[error,setError]=useState<StudioErrorState|null>(null);
  const [retry,setRetry]=useState(0),[reset,setReset]=useState(0),[credits,setCredits]=useState(false),[capturing,setCapturing]=useState(false),[photoMessage,setPhotoMessage]=useState('');
  const [sound,setSound]=useState<SoundEngineState>(INITIAL_SOUND_STATE);
  const soundEngineRef=useRef<SoundEngine|null>(null);
  const stage=useRef<HTMLDivElement>(null),sequence=useRef<ScrollTrigger|null>(null);
  const carApi=useRef<StudioApi|null>(null),engineApi=useRef<StudioApi|null>(null);
  const beforeTray=useRef<{progress:number;doors:boolean;frontLid:boolean;rearCover:boolean}|null>(null);
  useEffect(()=>{
    const engine=new SoundEngine();
    soundEngineRef.current=engine;
    setSound(engine.getState());
    const unsub=engine.subscribe(setSound);
    return()=>{unsub();engine.dispose();soundEngineRef.current=null;};
  },[]);
  useEffect(()=>{
    soundEngineRef.current?.setAcoustics({cockpit:settings.cockpit,rearCoverOpen:settings.rearCover});
  },[settings.cockpit,settings.rearCover]);
  const onSoundEnable=useCallback(()=>{void soundEngineRef.current?.enable();},[]);
  const onSoundStart=useCallback(()=>{soundEngineRef.current?.startEngine();},[]);
  const onSoundRev=useCallback(()=>{soundEngineRef.current?.revEngine();},[]);
  const onSoundStop=useCallback(()=>{soundEngineRef.current?.stopEngine();},[]);
  const onSoundMuteToggle=useCallback(()=>{const e=soundEngineRef.current;if(e)e.setMuted(!e.getState().muted);},[]);
  const onSoundVolume=useCallback((volume:number)=>{soundEngineRef.current?.setVolume(volume);},[]);
  const onEnginePlayChange=useCallback((playing:boolean)=>{
    const e=soundEngineRef.current;
    if(!e)return;
    const st=e.getState();
    if(!st.enabled||st.loadState!=='ready')return;
    if(playing){if(!st.muted&&st.engineState==='stopped')e.startEngine();}
    else{e.stopEngine();}
  },[]);
  const update=useCallback(<K extends keyof StudioSettings,>(key:K,value:StudioSettings[K])=>{
    if(key==='doors'||key==='frontLid'||key==='rearCover'){
      const prev=stateRef.current[key];
      const next=Boolean(value);
      if(prev!==next){soundEngineRef.current?.playPanelFoley(next?'open':'close');}
    }else if(key==='frontLights'||key==='rearLights'){
      const prev=stateRef.current[key];
      const next=Boolean(value);
      if(prev!==next){soundEngineRef.current?.playLightRelayClick();}
    }
    setSettings(s=>({...s,[key]:value}));
  },[]);
  const jump=useCallback((value:number)=>{
    const p=Math.max(0,Math.min(1,value));progressRef.current=p;setProgress(p);
    if(sequence.current){window.scrollTo({top:sequence.current.start+p*(sequence.current.end-sequence.current.start),behavior:'instant'});sequence.current.update();}
  },[]);
  useEffect(()=>{
    const node=stage.current;if(!node)return;
    const trigger=ScrollTrigger.create({trigger:node,start:'top top',end:'+=3800',pin:true,invalidateOnRefresh:true,onUpdate(self){
      const s=stateRef.current;
      if(s.tray||s.photo||s.cockpit||s.engineLab||s.mode==='customise')return;
      progressRef.current=self.progress;setProgress(self.progress);
      if(self.progress>.015&&s.mode==='showroom')setSettings(old=>({...old,mode:'anatomy'}));
    }});sequence.current=trigger;
    const onResize=()=>{const p=progressRef.current;ScrollTrigger.refresh();window.scrollTo({top:trigger.start+p*(trigger.end-trigger.start),behavior:'instant'});};
    window.addEventListener('resize',onResize);
    const wheel=(event:WheelEvent)=>{const s=stateRef.current;if(!((event.target as Element)?.closest?.('.experience-panel'))&&(s.photo||s.cockpit||s.engineLab||s.tray||s.mode==='customise'))event.preventDefault();};
    window.addEventListener('wheel',wheel,{passive:false});
    return()=>{window.removeEventListener('resize',onResize);window.removeEventListener('wheel',wheel);trigger.kill();sequence.current=null;};
  },[]);
  useEffect(()=>{try{localStorage.setItem('daytona-wheel-design',settings.wheel);}catch{}},[settings.wheel]);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');const change=(e:MediaQueryListEvent)=>setSettings(s=>({...s,reducedMotion:e.matches,rotate:e.matches?false:s.rotate,tour:e.matches?false:s.tour}));media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[]);
  const changeMode=useCallback((mode:ExperienceMode)=>{
    beforeTray.current=null;setSelected(null);
    setSettings(s=>({...s,mode,engineLab:false,tray:false,photo:false,cockpit:false,hidden:[],revealed:[],isolated:null,camera:'hero'}));
    jump(0);setReset(n=>n+1);
  },[jump]);
  const resetView=useCallback(()=>{
    beforeTray.current=null;setSelected(null);setSettings(s=>({...s,camera:'hero',cockpit:false,tray:false,doors:false,frontLid:false,rearCover:false,hidden:[],revealed:[],isolated:null}));jump(0);setReset(n=>n+1);
  },[jump]);
  const select=useCallback((id:string|null)=>{setSelected(id);if(id)setSettings(s=>({...s,rotate:false,cockpit:false,hidden:s.hidden.filter(x=>x!==id),isolated:s.isolated?id:null}));},[]);
  const toggleTray=useCallback(()=>{
    const s=stateRef.current;setSelected(null);
    if(!s.tray){beforeTray.current={progress:progressRef.current,doors:s.doors,frontLid:s.frontLid,rearCover:s.rearCover};setSettings(old=>({...old,tray:true,mode:'anatomy',rotate:false,doors:false,frontLid:false,rearCover:false,cockpit:false,hidden:[],revealed:[],isolated:null}));jump(1);}
    else {const prior=beforeTray.current;beforeTray.current=null;setSettings(old=>({...old,tray:false,doors:prior?.doors??false,frontLid:prior?.frontLid??false,rearCover:prior?.rearCover??false,hidden:[],revealed:[],isolated:null}));jump(prior?.progress??.71);}
    setReset(n=>n+1);
  },[jump]);
  const showConnected=useCallback(()=>{if(!selected)return;const ids=connectedParts(selected);setSettings(s=>({...s,hidden:PARTS_CATALOG.filter(p=>!ids.includes(p.nodeName)).map(p=>p.nodeName),isolated:null,revealed:ids,tray:false}));setSelected(null);},[selected]);
  const openEngine=useCallback(()=>{setSettings(s=>({...s,engineLab:true,mode:'anatomy',rotate:false,cockpit:false,photo:false}));setSelected(null);},[]);
  const togglePhoto=useCallback(()=>{setPhotoMessage('');setSettings(s=>({...s,photo:!s.photo,rotate:false}));},[]);
  const onCarApi=useCallback((api:StudioApi|null)=>{carApi.current=api;},[]),onEngineApi=useCallback((api:StudioApi|null)=>{engineApi.current=api;},[]);
  const onLoaded=useCallback(()=>{setError(null);setReset(n=>n+1);requestAnimationFrame(()=>ScrollTrigger.refresh());},[]);
  const onProgress=useCallback((percent:number,text:string)=>setLoading({percent,text}),[]);
  const capture=useCallback(async(format:string)=>{
    const s=stateRef.current,api=s.engineLab?engineApi.current:carApi.current;
    if(!api){setPhotoMessage('The scene is still preparing. Please try again in a moment.');return;}
    setCapturing(true);setPhotoMessage('Rendering your photograph…');
    const [width,height]=format==='square'?[2160,2160]:format==='portrait'?[2160,2700]:[3840,2160];
    try {
      const blob=await api.capture({width,height,backdrop:s.lighting});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`daytona-sp3-${s.engineLab?'v12-cutaway':'studio'}-${format}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setPhotoMessage('Photograph saved.');
    }catch(err){setPhotoMessage(err instanceof Error?err.message:'The photograph could not be saved. Please try again.');}finally{setCapturing(false);}
  },[]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.matches('input,select,textarea,[contenteditable="true"]'))return;
      if(e.key==='Escape'){if(credits)setCredits(false);else if(settings.photo)togglePhoto();else if(settings.engineLab)update('engineLab',false);else select(null);}
      if(e.key.toLowerCase()==='r')resetView();
      if(e.key===' '&&!settings.engineLab){e.preventDefault();update('rotate',!settings.rotate);}
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[settings,credits,resetView,select,togglePhoto,update]);
  const trayParts=useMemo(()=>getTrayParts(settings.trayCategory,settings.trayPage),[settings.trayCategory,settings.trayPage]);
  const trayIds=useMemo(()=>trayParts.map(p=>p.nodeName),[trayParts]);
  const experience:ExperienceSceneOptions=useMemo(()=>({tray:settings.tray,trayItems:trayIds,hidden:settings.hidden,revealed:settings.revealed,isolated:settings.isolated,cockpit:settings.cockpit,photo:settings.photo,lens:settings.lens,tour:settings.tour&&!settings.reducedMotion,active:!settings.engineLab,caliper:settings.caliper,interior:settings.interior,roof:settings.roof}),[settings,trayIds]);
  const showLabels=!settings.photo&&!settings.cockpit&&settings.mode==='anatomy';
  const panel=settings.mode!=='showroom'&&!settings.photo&&!settings.engineLab&&!settings.cockpit;
  return <div className="sp3-experience" data-mode={settings.mode} data-viewer-status={status} data-photo-mode={settings.photo} data-engine-lab={settings.engineLab} data-parts-tray={settings.tray} data-sound-enabled={sound.enabled} data-sound-state={sound.loadState} data-engine-audio={sound.engineState} data-sound-muted={sound.muted}>
    <div ref={stage} className="experience-stage" data-pinned-stage="true">
      <div className={`editorial-backdrop editorial-backdrop-${settings.lighting} experience-backdrop`} aria-hidden="true"/>
      <main className={`experience-viewport ${panel?'with-panel':''} ${settings.photo?'photo-viewport':''}`} style={settings.engineLab?{visibility:'hidden'}:undefined}>
        <StudioCanvas wheelDesign={settings.wheel} retryCount={retry} scrollProgress={progress} explosionSpread={settings.spread} activePaint={settings.paint} customPaintHex={settings.customPaint}
          showLabels={showLabels} labelDensity={settings.tray?'detailed':settings.labels} structureMode={settings.structure} frontLightsOn={settings.frontLights} rearLightsOn={settings.rearLights}
          doorsOpen={settings.doors} frontLidOpen={settings.frontLid} rearCoverOpen={settings.rearCover} selectedGroup={selected} onSelectGroup={select} onBackToCar={()=>select(null)}
          reducedMotion={settings.reducedMotion} autoRotate={settings.rotate&&!settings.photo&&!settings.cockpit&&!settings.tray} rotationSpeed={settings.speed} rotationDirection={settings.direction}
          lightingPreset={settings.lighting} activeCameraPreset={settings.camera} resetTrigger={reset} showFloorRing={settings.ring&&!settings.tray}
          onStatusChange={setStatus} onProgressChange={onProgress} onModelLoaded={onLoaded} onError={setError} experience={experience} onApiReady={onCarApi}/>
      </main>
      {settings.engineLab&&<EngineLab photo={settings.photo} lens={settings.lens} lighting={settings.lighting} reducedMotion={settings.reducedMotion} onBack={()=>update('engineLab',false)} onApiReady={onEngineApi} onEnginePlayChange={onEnginePlayChange}/>}
      <ExperienceControls settings={settings} update={update} selected={selected} onSelect={select} progress={progress} onProgress={jump} onReset={resetView} onMode={changeMode} onTray={toggleTray} onConnected={showConnected} onPhoto={togglePhoto} onCredits={()=>setCredits(true)} onEngine={openEngine} busy={capturing} message={photoMessage} onCapture={capture} sound={sound} onSoundEnable={onSoundEnable} onSoundStart={onSoundStart} onSoundRev={onSoundRev} onSoundStop={onSoundStop} onSoundMuteToggle={onSoundMuteToggle} onSoundVolume={onSoundVolume}/>
      {settings.tray&&!settings.photo&&!settings.engineLab&&<div className="tray-caption"><span>ASSEMBLY TRAY / {settings.trayCategory.toUpperCase()}</span><p>{trayParts.map(p=>p.number).join(' · ')} <span>— select a label to inspect</span></p></div>}
      {status==='loading'&&!settings.engineLab&&<div className="experience-loading" role="status"><span className="loading-orbit"/><p>Preparing the Daytona SP3</p><strong>{loading.percent}%</strong><small>{loading.text}</small></div>}
      {status==='error'&&<div className="experience-error" role="alert"><h2>{error?.title??'The SP3 could not load'}</h2><p>{error?.detail}</p><button className="primary-action" onClick={()=>{setError(null);setRetry(n=>n+1);}}>Try again</button></div>}
    </div>
    <ReferenceModal open={credits} onClose={()=>setCredits(false)}/>
  </div>;
}

// SP3 experience entry: showroom, anatomy, customisation and V12 lab.
