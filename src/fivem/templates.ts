import type { VehicleConfig } from './types';
import { HANDLING_DEFINITIONS } from './types';

export const escapeXML = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const escapeLua = (value: string) =>
  value.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]/g, ' ');

const tag = (name: string, value: string, indent = 6) =>
  ' '.repeat(indent) + '<' + name + '>' + escapeXML(value) + '</' + name + '>';
const valueTag = (name: string, value: number, indent = 6) =>
  ' '.repeat(indent) + '<' + name + ' value="' + value.toFixed(6) + '" />';
const head = '<?xml version="1.0" encoding="UTF-8"?>';

export function vehiclesXML(c: VehicleConfig): string {
  const props: Record<string,string> = {
    modelName:c.spawn,txdName:c.texture,handlingId:c.handling,gameName:c.spawn.toUpperCase(),
    vehicleMakeName:c.make,expressionDictName:'null',expressionName:'null',
    animConvRoofDictName:'null',animConvRoofName:'null',ptfxAssetName:'null',
    audioNameHash:c.audio,layout:c.layout,coverBoundOffsets:'SULTAN_COVER_OFFSET_INFO',
    explosionInfo:'EXPLOSION_INFO_DEFAULT',cameraName:'DEFAULT_FOLLOW_VEHICLE_CAMERA',
    aimCameraName:'DEFAULT_THIRD_PERSON_VEHICLE_AIM_CAMERA',bonnetCameraName:'VEHICLE_BONNET_CAMERA',
    povCameraName:'DEFAULT_POV_CAMERA'
  };
  const extra: Record<string,string> = {
    flags:c.flags,type:c.vehicleType,plateType:c.plateType,dashboardType:'VDT_SULTAN',
    vehicleClass:c.vehicleClass,wheelType:c.wheelType
  };
  return [
    head, '<CVehicleModelInfo__InitDataList>', '  <residentTxd>vehshare</residentTxd>',
    '  <residentAnims />', '  <InitDatas>', '    <Item>',
    ...Object.entries(props).map(([k,v])=>tag(k,v)),
    '      <animConvRoofWindowsAffected />', '      <scenarioLayout />',
    '      <wheelScale value="0.300000" />','      <wheelScaleRear value="0.300000" />',
    '      <dirtLevelMin value="0.000000" />','      <dirtLevelMax value="0.800000" />',
    '      <envEffScaleMin value="0.000000" />','      <envEffScaleMax value="1.000000" />',
    '      <damageMapScale value="0.600000" />','      <damageOffsetScale value="1.000000" />',
    '      <diffuseTint value="0x00FFFFFF" />','      <steerWheelMult value="1.000000" />',
    '      <HDTextureDist value="5.000000" />',
    '      <lodDistances content="float_array">15.0 30.0 60.0 120.0 500.0 500.0</lodDistances>',
    '      <minSeatHeight value="0.300000" />',
    '      <identicalModelSpawnDistance value="20" />',
    '      <maxNumOfSameColor value="10" />',
    '      <defaultBodyHealth value="1000.000000" />',
    '      <pretendOccupantsScale value="1.000000" />',
    '      <visibleSpawnDistScale value="1.000000" />',
    '      <trackerPathWidth value="2.000000" />',
    '      <weaponForceMult value="1.000000" />',
    '      <frequency value="100" />','      <swankness>SWANKNESS_2</swankness>',
    '      <maxNum value="999" />',
    ...Object.entries(extra).map(([k,v])=>tag(k,v)),
    '      <trailers />','      <additionalTrailers />','      <drivers />',
    '      <extraIncludes />','      <doorsWithCollisionWhenClosed />',
    '      <driveableDoors />','      <requiredExtras />','      <rewards />',
    '      <bumpersNeedToCollideWithMap value="false" />',
    '      <needsRopeTexture value="false" />',
    '    </Item>','  </InitDatas>',
    '  <txdRelationships>',
    '    <Item><parent>vehicles</parent><child>' + escapeXML(c.texture) + '</child></Item>',
    '  </txdRelationships>','</CVehicleModelInfo__InitDataList>',''
  ].join('\n');
}

export function handlingXML(c: VehicleConfig): string {
  const overrides = new Map(HANDLING_DEFINITIONS.map(d => [d.xml, c.handlingValues[d.key]]));
  const field=(name:string, fallback:number)=>valueTag(name, overrides.get(name) ?? fallback);
  return [
    head,'<CHandlingDataMgr>','  <HandlingData>','    <Item type="CHandlingData">',
    tag('handlingName',c.handling),
    field('fMass',1600), field('fInitialDragCoeff',8),
    field('fDownforceModifier',1),field('fPercentSubmerged',85),
    '      <vecCentreOfMassOffset x="0.000000" y="0.000000" z="-0.050000" />',
    '      <vecInertiaMultiplier x="1.000000" y="1.100000" z="1.200000" />',
    field('fDriveBiasFront',0),'      <nInitialDriveGears value="' + String(c.handlingValues.gears) + '" />',
    field('fInitialDriveForce',.32),field('fDriveInertia',1),
    field('fClutchChangeRateScaleUpShift',2.5),
    field('fClutchChangeRateScaleDownShift',2),
    field('fInitialDriveMaxFlatVel',175),field('fBrakeForce',.85),
    field('fBrakeBiasFront',.56),field('fHandBrakeForce',.8),
    field('fSteeringLock',35),field('fTractionCurveMax',2.25),
    field('fTractionCurveMin',1.95),field('fTractionCurveLateral',22.5),
    field('fTractionSpringDeltaMax',.13),
    field('fLowSpeedTractionLossMult',1),
    field('fCamberStiffnesss',0),field('fTractionBiasFront',.485),
    field('fTractionLossMult',1),field('fSuspensionForce',2.2),
    field('fSuspensionCompDamp',1.5),field('fSuspensionReboundDamp',2),
    field('fSuspensionUpperLimit',.1),field('fSuspensionLowerLimit',-.1),
    field('fSuspensionRaise',0),field('fSuspensionBiasFront',.5),
    field('fAntiRollBarForce',.6),field('fAntiRollBarBiasFront',.5),
    field('fRollCentreHeightFront',.25),field('fRollCentreHeightRear',.25),
    field('fCollisionDamageMult',1),field('fWeaponDamageMult',1),
    field('fDeformationDamageMult',.8),field('fEngineDamageMult',1.5),
    field('fPetrolTankVolume',65),field('fOilVolume',5),
    field('fSeatOffsetDistX',0),field('fSeatOffsetDistY',0),field('fSeatOffsetDistZ',0),
    '      <nMonetaryValue value="40000" />',
    '      <strModelFlags>440010</strModelFlags>',
    '      <strHandlingFlags>0</strHandlingFlags>',
    '      <strDamageFlags>0</strDamageFlags>',
    '      <AIHandling>AVERAGE</AIHandling>',
    '      <SubHandlingData>',
    '        <Item type="CCarHandlingData">',
    '          <fBackEndPopUpCarImpulseMult value="0.100000" />',
    '          <fBackEndPopUpBuildingImpulseMult value="0.030000" />',
    '          <fBackEndPopUpMaxDeltaSpeed value="0.600000" />',
    '        </Item>','        <Item type="NULL" />','        <Item type="NULL" />',
    '      </SubHandlingData>','    </Item>','  </HandlingData>',
    '</CHandlingDataMgr>',''
  ].join('\n');
}

export function variationsXML(c: VehicleConfig) {
 return [
 head,'<CVehicleModelInfoVariation>','  <variationData>','    <Item>',
 tag('modelName',c.spawn),
 '      <colors>',
 '        <Item><indices content="char_array">0 0 0 0</indices><liveries><Item value="false" /></liveries></Item>',
 '        <Item><indices content="char_array">1 1 1 1</indices><liveries><Item value="false" /></liveries></Item>',
 '      </colors>','      <kits />','      <windowsWithExposedEdges />',
 '      <plateProbabilities>',
 '        <Probability><Name>standardwhite</Name><Value value="100" /></Probability>',
 '      </plateProbabilities>',
 '      <lightSettings value="0" />','      <sirenSettings value="0" />',
 '    </Item>','  </variationData>','</CVehicleModelInfoVariation>',''
 ].join('\n');
}

export function vehicleNamesLua(c: VehicleConfig) {
 return [
   '-- Kurogane Studio - etykiety addonu FiveM',
   'CreateThread(function()',
   "  AddTextEntry('" + escapeLua(c.spawn.toUpperCase()) + "', '" + escapeLua(c.displayName) + "')",
   "  AddTextEntry('" + escapeLua(c.make) + "', '" + escapeLua(c.make) + "')",
   'end)',''
 ].join('\n');
}

export function fxManifest(c: VehicleConfig, metaNames: string[]) {
 const ordered: [string,string][] = [
   ['carcols.meta','CARCOLS_FILE'],
   ['carvariations.meta','VEHICLE_VARIATION_FILE'],
   ['handling.meta','HANDLING_FILE'],
   ['vehiclelayouts.meta','VEHICLE_LAYOUTS_FILE'],
   ['vehicles.meta','VEHICLE_METADATA_FILE']
 ];
 const included = ordered.filter(([name]) => metaNames.includes(name));
 return [
   "fx_version 'cerulean'","game 'gta5'",
   "author '" + escapeLua(c.author) + "'",
   "description '" + escapeLua(c.description) + "'",
   "version '" + escapeLua(c.version) + "'",
   '','files {',
   ...included.map(([name]) => "    'data/" + name + "',"),
   '}','',
   ...included.map(([name,type]) => "data_file '" + type + "' 'data/" + name + "'"),
   ...(c.generateNames ? ["","client_script 'vehicle_names.lua'"] : []),
   ''
 ].join('\n');
}
