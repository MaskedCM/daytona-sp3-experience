import React,{useState} from 'react';
import {CAMERA_PRESETS} from '../utils/modelBounds';
import {PAINT_SWATCHES} from '../types/studio';
import {WHEEL_DESIGNS} from '../utils/wheelDesigns';
import {PARTS_CATALOG,connectedParts} from '../utils/experienceCatalog';
import type {StudioSettings,ExperienceMode,PartsCategory} from '../types/experience';
import type {SoundEngineState} from '../audio/soundEngine';

export type UpdateSettings=<K extends keyof StudioSettings>(key:K,value:StudioSettings[K])=>void;
interface Props {
  settings:StudioSettings;
  update:UpdateSettings;
  selected:string|null;
  onSelect:(id:string|null)=>void;
  progress:number;
  onProgress:(n:number)=>void;
  onReset:()=>void;
  onMode:(mode:ExperienceMode)=>void;
  onTray:()=>void;
  onConnected:()=>void;
  onPhoto:()=>void;
  onCredits:()=>void;
  onEngine:()=>void;
  busy:boolean;
  message:string;
  onCapture:(format:string)=>void;
  sound:SoundEngineState;
  onSoundEnable:()=>void;
  onSoundStart:()=>void;
  onSoundRev:()=>void;
  onSoundStop:()=>void;
  onSoundMuteToggle:()=>void;
  onSoundVolume:(volume:number)=>void;
}
const FAMILIES=[['all','All assemblies'],['bodywork','Body & cabin'],['wheels','Wheels & brakes'],['chassis','Chassis'],['engine','Powertrain']] as const;
function Toggle({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){return <button className="control-toggle" aria-pressed={active} onClick={onClick}>{children}</button>;}
export function ExperienceControls(p:Props) {
  const {settings:s,update:u,sound}=p;
  const [query,setQuery]=useState(''),[family,setFamily]=useState<PartsCategory>('all'),[format,setFormat]=useState('landscape');
  const selected=PARTS_CATALOG.find(part=>part.nodeName===p.selected);
  const items=PARTS_CATALOG.filter(part=>(family==='all'||part.family===family)&&`${part.plainName} ${part.description}`.toLowerCase().includes(query.toLowerCase()));
  const connected=selected?connectedParts(selected.nodeName):[];
  const toggle=(key:'doors'|'frontLid'|'rearCover'|'frontLights'|'rearLights'|'rotate'|'ring'|'reducedMotion'|'structure'|'tour')=>()=>u(key,!s[key]);
  const camera=(id:StudioSettings['camera'])=>{u('cockpit',false);u('camera',id);u('tour',false);p.onSelect(null);};
  if(s.photo)return <div className="photo-workbench experience-panel" aria-label="Photo Mode controls">
    <div><p className="eyebrow">PHOTO MODE</p><h2>Your SP3. Your frame.</h2><p className="muted">Drag to compose. Export excludes every control.</p></div>
    <label>Lens<select aria-label="Photo lens" value={s.lens} onChange={e=>u('lens',+e.target.value as 35|50|85)}><option value="35">35 mm · Wide</option><option value="50">50 mm · Natural</option><option value="85">85 mm · Portrait</option></select></label>
    <label>Lighting<select aria-label="Photo lighting" value={s.lighting} onChange={e=>u('lighting',e.target.value as StudioSettings['lighting'])}><option value="studio">Soft studio</option><option value="rosso">Warm Rosso</option><option value="technical">Cool technical</option></select></label>
    <label>Output<select aria-label="Photo format" value={format} onChange={e=>setFormat(e.target.value)}><option value="landscape">4K landscape · 3840 × 2160</option><option value="square">Square · 2160 × 2160</option><option value="portrait">Portrait · 2160 × 2700</option></select></label>
    <div className="button-row"><button className="primary-action" onClick={()=>p.onCapture(format)} disabled={p.busy}>{p.busy?'Rendering…':'Save photograph'}</button><button onClick={p.onPhoto}>Exit Photo Mode</button></div><p role="status" className="muted">{p.message}</p>
  </div>;
  const acousticProfile=sound.cockpit?'cockpit-muffled':sound.rearCoverOpen?'cover-open-detail':'exterior';
  return <>
    <header className="experience-header"><a href="#studio" className="experience-wordmark" onClick={e=>{e.preventDefault();p.onMode('showroom');}}><span className="wordmark-mark">F</span><span>DAYTONA <b>SP3</b><small>THE ANATOMY OF AN ICON</small></span></a>
      <nav aria-label="Experience modes" className="mode-switch">{(['showroom','anatomy','customise'] as const).map(mode=><button key={mode} aria-pressed={s.mode===mode&&!s.engineLab} onClick={()=>p.onMode(mode)}>{mode==='customise'?'Customise':mode==='anatomy'?'Anatomy':'Showroom'}</button>)}</nav>
      <div className="header-actions">
        {!sound.enabled&&sound.loadState==='idle'&&<button className="sound-enable-action" onClick={p.onSoundEnable} aria-pressed={false} data-testid="enable-sound-btn">Enable sound</button>}
        <button className="icon-action" onClick={p.onCredits} aria-label="Reference and model credits">ⓘ</button>
        <button className="photo-action" onClick={p.onPhoto}>Photo Mode ↗</button>
      </div>
    </header>
    {(sound.enabled||sound.loadState==='loading'||sound.loadState==='error')&&<section className="sound-control-bar" aria-label="Illustrative sound controls" data-testid="sound-control-bar" data-load-state={sound.loadState} data-engine-state={sound.engineState} data-acoustics={acousticProfile}>
      <span className="sound-illustrative-tag" title="Daytona SP3 engine start, continuous running loop and original recorded revs from DARK WORKS Assetto Corsa EVO gameplay video; generic door foley.">Illustrative audio</span>
      {sound.loadState==='loading'&&<span role="status" className="sound-feedback" data-testid="sound-loading-feedback">Loading audio…</span>}
      {sound.loadState==='error'&&<>
        <span role="alert" className="sound-feedback sound-feedback-error" data-testid="sound-error-feedback">{sound.errorMessage||'Audio failed to load'}</span>
        <button onClick={p.onSoundEnable} data-testid="retry-sound-btn">Retry sound</button>
      </>}
      {sound.loadState==='ready'&&<>
        <button onClick={p.onSoundStart} disabled={sound.muted||sound.engineState==='starting'||sound.engineState==='idling'} aria-pressed={sound.engineState==='starting'||sound.engineState==='idling'} title={sound.engineState==='revving'?'Return from recorded revs to continuous running loop (holds until Stop)':'Startup once, then continuous running loop until Stop'} data-testid="sound-start-btn">Start engine</button>
        <button onClick={p.onSoundRev} disabled={sound.muted} aria-pressed={sound.engineState==='revving'} title="Repeat original recorded revs until Stop" data-testid="sound-rev-btn">Rev</button>
        <button onClick={p.onSoundStop} disabled={sound.engineState==='stopped'} title="Stop continuous running or recorded revs" data-testid="sound-stop-btn">Stop</button>
        <span className="dock-divider"/>
        <button onClick={p.onSoundMuteToggle} aria-pressed={sound.muted} data-testid="sound-mute-btn">Mute</button>
        <label className="sound-volume-label"><span>Volume</span><input aria-label="Sound volume" data-testid="sound-volume-slider" type="range" min="0" max="1" step="0.01" value={sound.volume} onChange={e=>p.onSoundVolume(+e.target.value)}/><output>{Math.round(sound.volume*100)}%</output></label>
        {(sound.cockpit||sound.rearCoverOpen)&&<span className="sound-acoustic-chip" data-testid="sound-acoustic-chip">{sound.cockpit?'Cockpit filter':'Cover open'}</span>}
        <button className="sound-credits-btn" onClick={p.onCredits} data-testid="sound-credits-btn">Audio credits</button>
      </>}
    </section>}
    {!s.engineLab&&!s.cockpit&&s.mode==='showroom'&&<div className="showroom-caption"><p className="eyebrow">FERRARI / ICONA SERIES / 2022</p><h1>V12.<br/><em>9,500 rpm.</em></h1><p>Naturally aspirated.<br/>Inspired by the 1967 Daytona 1–2–3.</p><button className="text-action" onClick={()=>p.onMode('anatomy')}>Explore the anatomy <span>↓</span></button></div>}
    {!s.engineLab&&!s.cockpit&&s.mode!=='showroom'&&<aside className="experience-panel main-control-panel" aria-label={s.mode==='anatomy'?'Anatomy controls':'Customisation controls'}>
      {s.mode==='customise'?<>
        <p className="eyebrow">ATELIER / 01</p><h2>Make it yours.</h2><p className="muted">Every finish. One unmistakable silhouette.</p>
        <section className="control-section"><h3>Exterior paint <span>{s.paint==='original'?'Rosso Magma':s.paint}</span></h3><div className="swatch-grid">{PAINT_SWATCHES.filter(x=>x.id!=='custom').map(color=><button key={color.id} aria-label={`Paint: ${color.label}`} aria-pressed={s.paint===color.id} style={{'--swatch':color.hex} as React.CSSProperties} onClick={()=>u('paint',color.id)}><i/>{color.label}</button>)}</div><label className="custom-colour">Custom colour<input aria-label="Custom exterior colour" type="color" value={s.customPaint} onChange={e=>{u('customPaint',e.target.value);u('paint','custom');}}/></label></section>
        <section className="control-section"><h3>Wheel design</h3><div className="choice-grid">{WHEEL_DESIGNS.map((wheel,i)=><button key={wheel.id} aria-pressed={s.wheel===wheel.id} onClick={()=>u('wheel',wheel.id)}><span className={`rim-icon rim-${i}`} aria-hidden="true">{['✦','✳','✺','❋','✵','◉'][i]}</span>{wheel.label}</button>)}</div></section>
        <section className="control-section"><h3>Brake calipers</h3><div className="finish-row">{[['original','Factory'],['#c41625','Red'],['#e6bd37','Yellow'],['#363a40','Black'],['#8a949f','Silver']].map(([id,label])=><button key={id} aria-pressed={s.caliper===id} onClick={()=>u('caliper',id)}>{label}</button>)}</div></section>
        <section className="control-section"><h3>Interior leather</h3><div className="finish-row">{(['original','black','tan','red'] as const).map(id=><button key={id} aria-pressed={s.interior===id} onClick={()=>u('interior',id)}>{id==='original'?'Factory':id}</button>)}</div><h3>Hardtop finish</h3><div className="finish-row">{(['original','carbon','body'] as const).map(id=><button key={id} aria-pressed={s.roof===id} onClick={()=>u('roof',id)}>{id==='original'?'Factory':id==='body'?'Body colour':'Carbon weave'}</button>)}</div></section>
        <button className="wide-action" aria-pressed={s.cockpit} onClick={()=>{u('cockpit',!s.cockpit);u('rotate',false);}}> {s.cockpit?'Return outside':'Step inside the cockpit'} ↗</button>
      </>:<>
        <div className="panel-heading"><div><p className="eyebrow">ANATOMY / {s.tray?'PARTS TRAY':'EXPLORER'}</p><h2>{s.tray?'Every assembly.':'Beneath the surface.'}</h2></div><button className="icon-action" onClick={()=>p.onMode('showroom')} aria-label="Close anatomy panel">×</button></div>
        <div className="anatomy-tabs"><Toggle active={!s.tray} onClick={()=>{if(s.tray)p.onTray();}}>On the car</Toggle><Toggle active={s.tray} onClick={p.onTray}>Parts tray</Toggle></div>
        {!s.tray?<><label className="range-label">Disassembly <output>{Math.round(p.progress*100)}%</output><input aria-label="Disassembly progress" type="range" min="0" max="1" step=".001" value={p.progress} onChange={e=>p.onProgress(+e.target.value)}/></label><div className="finish-row"><button onClick={()=>p.onProgress(0)}>Assembled</button><button onClick={()=>p.onProgress(.71)}>Exterior</button><button onClick={()=>p.onProgress(1)}>Chassis & V12</button></div><div className="finish-row"><Toggle active={s.structure} onClick={toggle('structure')}>Structure</Toggle><Toggle active={s.tour} onClick={toggle('tour')}>Guided camera</Toggle></div></>:<><label className="select-label">Tray collection<select aria-label="Tray collection" value={s.trayCategory} onChange={e=>{u('trayCategory',e.target.value as PartsCategory);u('trayPage',0);}}>{FAMILIES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><div className="button-row"><button disabled={s.trayPage===0} onClick={()=>u('trayPage',s.trayPage-1)}>← Previous</button><span className="muted">Page {s.trayPage+1}</span><button disabled={(s.trayPage+1)*6>=PARTS_CATALOG.filter(x=>s.trayCategory==='all'||x.family===s.trayCategory).length} onClick={()=>u('trayPage',s.trayPage+1)}>Next →</button></div></>}
        <button className="engine-entry" onClick={p.onEngine}><span>V12 / MECHANICAL LAB</span><strong>See the engine work <span>↗</span></strong><small>Cutaway · moving internals · four-stroke cycle</small></button>
        {selected?<article className="part-explainer selected-part"><button className="text-action" onClick={()=>p.onSelect(null)}>← All assemblies</button><p className="eyebrow">SP3 / {selected.family.toUpperCase()} / {selected.number}</p><h3>{selected.plainName}</h3>{selected.illustrative&&<span className="illustrative-chip">Illustrative reconstruction</span>}<p>{selected.description.replace('Illustrative mechanical reconstruction: ','')}</p><div className="button-row"><Toggle active={s.isolated===selected.nodeName} onClick={()=>u('isolated',s.isolated?null:selected.nodeName)}>Isolate part</Toggle><button onClick={()=>{u('hidden',[...s.hidden,selected.nodeName]);u('isolated',null);p.onSelect(null);}}>Hide part</button></div><button className="wide-action" onClick={p.onConnected}>Show connected assemblies ↗</button><div className="connected-chips">{connected.filter(id=>id!==selected.nodeName).map(id=><button key={id} onClick={()=>p.onSelect(id)}>{PARTS_CATALOG.find(x=>x.nodeName===id)?.plainName}</button>)}</div></article>:<>
          <label className="part-search"><span>Find a component</span><input aria-label="Search components" placeholder="Engine, brakes, glazing…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <label className="sr-only">Assembly family<select aria-label="Assembly family" value={family} onChange={e=>setFamily(e.target.value as PartsCategory)}>{FAMILIES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <div className="parts-list" aria-label="Component hierarchy">{FAMILIES.filter(([id])=>id!=='all'&&(family==='all'||family===id)).map(([id,name])=>{const parts=items.filter(x=>x.family===id);return parts.length?<details key={id} open><summary>{name} <span>{parts.length}</span></summary>{parts.map(part=><div className="part-row" key={part.nodeName}><button onClick={()=>p.onSelect(part.nodeName)}><span>{part.number}</span>{part.plainName}{part.illustrative&&<small>ILL.</small>}</button><button className="part-visibility" aria-label={`${s.hidden.includes(part.nodeName)?'Show':'Hide'} ${part.plainName}`} aria-pressed={!s.hidden.includes(part.nodeName)} onClick={()=>u('hidden',s.hidden.includes(part.nodeName)?s.hidden.filter(id=>id!==part.nodeName):[...s.hidden,part.nodeName])}>{s.hidden.includes(part.nodeName)?'○':'●'}</button></div>)}</details>:null;})}{items.length===0&&<p className="muted">No matching assemblies.</p>}</div>
        </>}
        {(s.hidden.length>0||s.isolated)&&<button className="wide-action" onClick={()=>{u('hidden',[]);u('revealed',[]);u('isolated',null);p.onSelect(null);}}>Restore every assembly ({s.hidden.length} hidden)</button>}
        <details className="advanced-controls"><summary>View settings</summary><label className="select-label">Labels<select aria-label="Label density" value={s.labels} onChange={e=>u('labels',e.target.value as StudioSettings['labels'])}>{['off','minimal','balanced','detailed'].map(id=><option key={id} value={id}>{id}</option>)}</select></label><label className="range-label">Explosion spacing <output>{s.spread.toFixed(1)}×</output><input aria-label="Explosion spread" type="range" min="1" max="3" step=".1" value={s.spread} onChange={e=>u('spread',+e.target.value)}/></label><div className="finish-row"><Toggle active={s.ring} onClick={toggle('ring')}>Floor ring</Toggle><Toggle active={s.reducedMotion} onClick={toggle('reducedMotion')}>Reduced motion</Toggle></div></details>
      </>}
    </aside>}
    {!s.engineLab&&<footer className="experience-dock" aria-label="Vehicle controls">
      <div className="dock-panel-controls"><Toggle active={s.doors} onClick={toggle('doors')}>Doors</Toggle><Toggle active={s.frontLid} onClick={toggle('frontLid')}>Front lid</Toggle><Toggle active={s.rearCover} onClick={toggle('rearCover')}>Engine cover</Toggle><span className="dock-divider"/><Toggle active={s.frontLights} onClick={toggle('frontLights')}>Front lights</Toggle><Toggle active={s.rearLights} onClick={toggle('rearLights')}>Rear lights</Toggle></div>
      <div className="dock-camera-controls"><Toggle active={s.rotate} onClick={toggle('rotate')}>{s.rotate?'Pause orbit':'Auto-rotate'}</Toggle><select aria-label="Camera angle" value={s.cockpit?'cockpit':s.camera} onChange={e=>{if(e.target.value==='cockpit'){u('cockpit',true);u('rotate',false);p.onProgress(0);}else camera(e.target.value as StudioSettings['camera']);}}>{CAMERA_PRESETS.map(camera=><option key={camera.id} value={camera.id}>{camera.label}</option>)}<option value="cockpit">Cockpit</option></select><select aria-label="Studio lighting" value={s.lighting} onChange={e=>u('lighting',e.target.value as StudioSettings['lighting'])}><option value="studio">Soft studio</option><option value="rosso">Rosso</option><option value="technical">Technical</option></select><button onClick={p.onReset}>Reset view ↺</button></div>
    </footer>}
    {s.cockpit&&!s.engineLab&&<div className="cockpit-hint"><span>COCKPIT VIEW · DRAG TO LOOK AROUND</span><button onClick={()=>{u('cockpit',false);p.onReset();}}>Exit cockpit ↗</button></div>}
    {!s.engineLab&&!s.cockpit&&s.mode==='showroom'&&<div className="showroom-specs"><span><b>V12</b> NATURALLY ASPIRATED</span><span><b>840</b> CV</span><span><b>6.5</b> LITRES</span></div>}
  </>;
}
