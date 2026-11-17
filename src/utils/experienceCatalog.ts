import {DAYTONA_PRESENTATION_GROUPS} from './explosionGroups';
import {ILLUSTRATIVE_MECHANICAL_SPECS} from './illustrativeMechanicalLayer';
import type {PartsCategory} from '../types/experience';
export const PARTS_CATALOG=[...DAYTONA_PRESENTATION_GROUPS,...ILLUSTRATIVE_MECHANICAL_SPECS].map((spec,index)=>({
  ...spec,number:String(index+1).padStart(2,'0'),illustrative:'reconstructionTag' in spec,
  family:(spec.category==='v12_powertrain'?'engine':spec.category==='chassis_suspension'||spec.category==='fixed'?'chassis':spec.category==='wheels'||spec.category==='brakes'?'wheels':'bodywork') as Exclude<PartsCategory,'all'>,
}));
export function getTrayParts(category:PartsCategory,page:number) {
  const parts=PARTS_CATALOG.filter(p=>category==='all'||p.family===category);
  return parts.slice(Math.max(0,Math.min(page,Math.ceil(parts.length/6)-1))*6,Math.max(0,Math.min(page,Math.ceil(parts.length/6)-1))*6+6);
}
export function connectedParts(nodeName:string) {
  const selected=PARTS_CATALOG.find(p=>p.nodeName===nodeName);if(!selected)return [];
  const corner=nodeName.match(/^(Front|Rear)_(left|right)_(wheel|brake)$/);
  if(corner)return PARTS_CATALOG.filter(p=>p.nodeName.startsWith(`${corner[1]}_${corner[2]}_`)||p.nodeName===`Mech_${corner[1]}_Suspension`).map(p=>p.nodeName);
  if(selected.family==='engine')return PARTS_CATALOG.filter(p=>p.family==='engine'||p.nodeName==='Rear_bodywork').map(p=>p.nodeName);
  if(/Left_bodywork|Right_bodywork/.test(nodeName))return [nodeName,'Glazing','Cabin','Underbody_and_trim'];
  return PARTS_CATALOG.filter(p=>p.family===selected.family).map(p=>p.nodeName);
}
