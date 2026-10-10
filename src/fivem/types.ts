export type VehicleAsset = { name: string; bytes: Uint8Array; source: string };
export type HandlingField = 'mass'|'drag'|'driveBias'|'gears'|'driveForce'|'maxSpeed'|'brakeForce'|'brakeBias'|'handBrake'|'steeringLock'|'tractionMax'|'tractionMin'|'tractionLoss'|'suspensionForce'|'suspensionRaise'|'tankVolume'|'collisionDamage'|'engineDamage';
export type VehicleConfig = {
  spawn: string; resource: string; displayName: string; make: string; author: string;
  description: string; version: string; handling: string; texture: string;
  audio: string; vehicleClass: string; vehicleType: string; wheelType: string;
  layout: string; plateType: string; flags: string; generateNames: boolean;
  keepExisting: boolean; handlingValues: Record<HandlingField, number>;
};
export type Check = { level: 'error'|'warning'|'ok'; text: string };
export const HANDLING_DEFINITIONS: {key:HandlingField;label:string;xml:string;min:number;max:number;step:number}[] = [
  {key:'mass',label:'Masa (kg)',xml:'fMass',min:300,max:20000,step:10},
  {key:'drag',label:'Opór powietrza',xml:'fInitialDragCoeff',min:0.1,max:50,step:.1},
  {key:'driveBias',label:'Napęd 0=RWD / 1=FWD',xml:'fDriveBiasFront',min:0,max:1,step:.05},
  {key:'gears',label:'Biegi',xml:'nInitialDriveGears',min:1,max:10,step:1},
  {key:'driveForce',label:'Siła silnika',xml:'fInitialDriveForce',min:.01,max:2,step:.01},
  {key:'maxSpeed',label:'Limit prędkości (handling)',xml:'fInitialDriveMaxFlatVel',min:30,max:500,step:5},
  {key:'brakeForce',label:'Siła hamulców',xml:'fBrakeForce',min:.01,max:5,step:.05},
  {key:'brakeBias',label:'Balans hamowania przód',xml:'fBrakeBiasFront',min:0,max:1,step:.05},
  {key:'handBrake',label:'Hamulec ręczny',xml:'fHandBrakeForce',min:0,max:5,step:.05},
  {key:'steeringLock',label:'Kąt skrętu',xml:'fSteeringLock',min:5,max:90,step:1},
  {key:'tractionMax',label:'Przyczepność max',xml:'fTractionCurveMax',min:.1,max:5,step:.05},
  {key:'tractionMin',label:'Przyczepność min',xml:'fTractionCurveMin',min:.1,max:5,step:.05},
  {key:'tractionLoss',label:'Utrata trakcji',xml:'fTractionLossMult',min:.1,max:5,step:.05},
  {key:'suspensionForce',label:'Twardość zawieszenia',xml:'fSuspensionForce',min:.1,max:10,step:.1},
  {key:'suspensionRaise',label:'Wysokość zawieszenia',xml:'fSuspensionRaise',min:-.3,max:.3,step:.01},
  {key:'tankVolume',label:'Pojemność baku (l)',xml:'fPetrolTankVolume',min:1,max:500,step:1},
  {key:'collisionDamage',label:'Uszkodzenia kolizyjne',xml:'fCollisionDamageMult',min:0,max:10,step:.1},
  {key:'engineDamage',label:'Uszkodzenia silnika',xml:'fEngineDamageMult',min:0,max:10,step:.1},
];
export const DEFAULTS: VehicleConfig = {
  spawn: '',resource:'',displayName:'',make:'KUROGANE',author:'Krzysio_YT',description:'Stworzone dla FourSevenRP',version:'1.0.0',
  handling:'',texture:'',audio:'SULTAN',vehicleClass:'VC_SPORT',vehicleType:'VEHICLE_TYPE_CAR',
  wheelType:'VWT_SPORT',layout:'LAYOUT_STANDARD',plateType:'VPT_FRONT_AND_BACK_PLATES',
  flags:'FLAG_SPORTS',generateNames:true,keepExisting:true,
  handlingValues:{
    mass:1600,drag:8,driveBias:0,gears:6,driveForce:.32,maxSpeed:175,
    brakeForce:.85,brakeBias:.56,handBrake:.8,steeringLock:35,
    tractionMax:2.25,tractionMin:1.95,tractionLoss:1,
    suspensionForce:2.2,suspensionRaise:0,tankVolume:65,collisionDamage:1,engineDamage:1.5,
  },
};
export const CLASSES=['VC_COMPACT','VC_SEDAN','VC_SUV','VC_COUPE','VC_MUSCLE','VC_SPORT_CLASSIC','VC_SPORT','VC_SUPER','VC_MOTORCYCLE','VC_OFF_ROAD','VC_INDUSTRIAL','VC_UTILITY','VC_VAN','VC_SERVICE','VC_EMERGENCY','VC_COMMERCIAL'];
export const WHEELS=['VWT_SPORT','VWT_MUSCLE','VWT_LOWRIDER','VWT_SUV','VWT_OFFROAD','VWT_TUNER','VWT_HIEND','VWT_BIKE'];
export const PLATES=['VPT_FRONT_AND_BACK_PLATES','VPT_FRONT_ONLY','VPT_BACK_ONLY','VPT_NONE'];
