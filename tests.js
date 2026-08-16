'use strict';
const E=require('./engine.js'),fs=require('fs'),results=[];
function check(name,expected,calculated,tolerance,units=''){const error=Math.abs(calculated-expected),pass=Number.isFinite(calculated)&&error<=tolerance;results.push({name,pass,expected,calculated,error,tolerance,units});return pass;}
function truth(name,value){return check(name,1,value?1:0,0);}
const c=E.defaultConfig(),solved=E.solveSteadyState(c),ss=solved.metrics;
truth('test_steady_state_convergence',solved.converged);
check('test_solids_balance',0,ss.systemSolidsResidual,1e-8,'t/h');
check('test_water_balance',0,ss.systemWaterResidual,1e-8,'t/h');
check('test_mill_water_balance',0,ss.R_water_mill,1e-8,'t/h');
check('test_sump_water_balance',0,ss.R_water_sump,1e-8,'t/h');
check('test_cyclone_water_balance',0,ss.R_water_cyclone,1e-8,'t/h');
check('test_cyclone_solids_balance',0,ss.R_cyclone,1e-8,'t/h');
check('test_circulating_load',ss.F_UF/c.freshSolidsTph*100,ss.CL,1e-9,'%');
check('test_steady_product_equals_fresh',ss.F_fresh,ss.F_OF,.01,'t/h');
const pp=E.pulpProperties(60,40,2.7),expectedDensity=100/(60/2.7+40);
check('test_pulp_density',expectedDensity,pp.density,1e-12,'t/m3');
check('test_solids_percentage',60,pp.solidsPct,1e-12,'%');
check('test_pulp_volumetric_flow',60/2.7+40,pp.volumeM3,1e-12,'m3/h');
check('test_sump_inventory',ss.sumpSolidsMassT/c.oreDensityTpm3+ss.sumpWaterMassT,ss.sumpVolumeM3,1e-9,'m3');
check('test_sump_level',100*ss.sumpVolumeM3/c.sumpVolumeM3,ss.sumpLevelPct,1e-9,'%');
check('test_auto_level_tracks_setpoint',c.sumpLevelSetpointPct,ss.sumpLevelPct,.01,'%');
truth('test_pump_flow_limit',ss.Q_pump<=c.pumpMaxFlowM3h+1e-9);
const manualConfig=E.defaultConfig({...c,pumpControlMode:'manual',pumpSpeedPct:50}),manualMetrics=E.metrics(E.cloneState(solved.state),manualConfig);check('test_manual_pump_speed',50,manualMetrics.pumpSpeedEffectivePct,1e-9,'%');
check('test_cyclone_flow_split',ss.Q_cyclone,ss.Q_UF+ss.Q_OF,1e-8,'m3/h');
truth('test_physical_solids_percentages',['solidsPctMillIn','solidsPctMillOut','solidsPctSump','solidsPctCyclone','solidsPctUF','solidsPctOF'].every(k=>ss[k]>0&&ss[k]<100));
const drift=E.cloneState(solved.state);E.advance(drift,c,30*60,1);const dm=E.metrics(drift,c);
check('test_no_drift_P80',ss.P80_OF,dm.P80_OF,.25,'um');check('test_no_drift_CL',ss.CL,dm.CL,.25,'%');check('test_no_drift_sump_level',ss.sumpLevelPct,dm.sumpLevelPct,.05,'%');check('test_no_drift_density',ss.densityCyclone,dm.densityCyclone,.002,'t/m3');
const startup=E.startupState(c);E.advance(startup,c,1200*60,2);const sm=E.metrics(startup,c);
check('test_startup_convergence_P80',ss.P80_OF,sm.P80_OF,1,'um');check('test_startup_convergence_CL',ss.CL,sm.CL,1,'%');check('test_startup_convergence_level',ss.sumpLevelPct,sm.sumpLevelPct,.2,'%');check('test_startup_convergence_density',ss.densityCyclone,sm.densityCyclone,.01,'t/m3');
function stepCase(name,changes,minutes=240){const cc=E.defaultConfig(Object.assign({},c,changes)),s=E.cloneState(solved.state),initial=E.metrics(s,c),samples=[];s.status='TRANSITORIO';s.stableFor=0;for(let n=0;n<minutes*6;n++){E.advance(s,cc,10,1);samples.push(E.metrics(s,cc));}const final=samples.at(-1),keys=['P80_OF','CL','sumpLevelPct','densityCyclone','solidsPctCyclone','Q_cyclone','W_OF','W_UF','F_OF','F_UF'];return{name,changes,initial:Object.fromEntries(keys.map(k=>[k,initial[k]])),minimum:Object.fromEntries(keys.map(k=>[k,Math.min(...samples.map(x=>x[k]))])),maximum:Object.fromEntries(keys.map(k=>[k,Math.max(...samples.map(x=>x[k]))])),final:Object.fromEntries(keys.map(k=>[k,final[k]])),status:final.status};}
const steps=[stepCase('water_mill_60_to_80',{millWaterM3h:80}),stepCase('water_sump_20_to_40',{sumpWaterM3h:40}),stepCase('pump_speed_70_to_90',{pumpSpeedPct:90}),stepCase('active_cyclones_6_to_5',{activeCyclones:5}),stepCase('pressure_100_to_120',{feedPressureKpa:120}),stepCase('Wi_14_to_17',{wiKwhT:17}),stepCase('feed_100_to_120',{freshSolidsTph:120})];
truth('test_water_step',steps[0].final.solidsPctCyclone<steps[0].initial.solidsPctCyclone);
truth('test_sump_water_step',steps[1].final.solidsPctCyclone<steps[1].initial.solidsPctCyclone);
truth('test_pump_speed_step',steps[2].minimum.sumpLevelPct<steps[2].initial.sumpLevelPct);
truth('test_active_cyclones_step',steps[3].final.P80_OF!==steps[3].initial.P80_OF);
truth('test_pressure_step',steps[4].final.P80_OF!==steps[4].initial.P80_OF);
truth('test_wi_step',steps[5].final.P80_OF>steps[5].initial.P80_OF);
truth('test_feed_step',steps[6].final.F_OF>steps[6].initial.F_OF);
// Critical 60-minute external conservation audit using trapezoidal integration.
const cons=E.cloneState(solved.state),before=E.metrics(cons,c),initialS=before.M_mill+before.sumpSolidsMassT,initialW=before.millWaterMassT+before.sumpWaterMassT;let outS=0,outW=0,prev=before;
for(let sec=0;sec<3600;sec++){E.advance(cons,c,1,1);const now=E.metrics(cons,c);outS+=(prev.F_OF+now.F_OF)/2/3600;outW+=(prev.W_OF+now.W_OF)/2/3600;prev=now;}
const after=E.metrics(cons,c),inputS=c.freshSolidsTph,inputW=c.millWaterM3h+c.sumpWaterM3h+E.moistureWaterTph(c),solidConservation=inputS-outS-((after.M_mill+after.sumpSolidsMassT)-initialS),waterConservation=inputW-outW-((after.millWaterMassT+after.sumpWaterMassT)-initialW);
check('test_no_mass_creation',0,solidConservation,.002,'t over 60 min');check('test_no_water_creation',0,waterConservation,.002,'t over 60 min');
const dtBase=E.startupState(c);E.advance(dtBase,c,90*60,.1);const dtm=E.metrics(dtBase,c);[.5,1,2].forEach(dt=>{const s=E.startupState(c);E.advance(s,c,90*60,dt);const m=E.metrics(s,c);check('test_dt_independence_'+dt+'_P80',dtm.P80_OF,m.P80_OF,.35,'um');check('test_dt_independence_'+dt+'_level',dtm.sumpLevelPct,m.sumpLevelPct,.1,'%');});
const speedBase=E.startupState(c);E.advance(speedBase,c,30*60,1);const speedM=E.metrics(speedBase,c);[1,5,10,20].forEach(x=>{const s=E.startupState(c);E.advance(s,c,30*60,1);const m=E.metrics(s,c);check('test_speed_independence_'+x+'x_P80',speedM.P80_OF,m.P80_OF,.01,'um');check('test_speed_independence_'+x+'x_level',speedM.sumpLevelPct,m.sumpLevelPct,.01,'%');});
const known=E.weibullFractions(150,1.2);check('test_p80_interpolation',150,E.p80FromFractions(known),2.5,'um');
const passed=results.filter(x=>x.pass).length,report={generatedAt:new Date().toISOString(),summary:{passed,failed:results.length-passed,total:results.length},steadyState:ss,conservation60min:{solidResidualT:solidConservation,waterResidualT:waterConservation},perturbations:steps,tests:results};fs.writeFileSync('TEST_RESULTS.json',JSON.stringify(report,null,2));results.forEach(x=>console.log(`${x.pass?'PASS':'FAIL'} ${x.name}: expected=${x.expected} calculated=${x.calculated} error=${x.error} tolerance=${x.tolerance} ${x.units}`));console.log(`SUMMARY ${passed}/${results.length} PASS`);process.exitCode=passed===results.length?0:1;
