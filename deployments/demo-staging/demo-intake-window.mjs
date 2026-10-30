// Fixed NEW reader trial proposal. No date/timezone/clock setting is read from env.
export const DEMO_INTAKE_START='2026-10-30T00:00:00.000Z';
export const DEMO_INTAKE_END='2026-11-06T03:00:00.000Z';
export function demoIntakeWindow(now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))return Object.freeze({state:'disabled',reason:'invalid_clock'});
 if(now.valueOf()<Date.parse(DEMO_INTAKE_START))return Object.freeze({state:'disabled',reason:'trial_not_started'});
 if(now.valueOf()>=Date.parse(DEMO_INTAKE_END))return Object.freeze({state:'trial_expired',reason:'bounded_demo_reader_trial_ended'});
 return Object.freeze({state:'admitted'});
}
