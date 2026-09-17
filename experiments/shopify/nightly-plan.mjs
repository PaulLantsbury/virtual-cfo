/** Once per store-local calendar date, at 02:00. Pure preparation, no timers.
 * On a missing 02:00 use the first valid minute after it; on an overlap use
 * its first occurrence. The runner only admits this minute (no daytime catch-up).
 */
export function nightlyPlan(now,timezone){
 const instant=new Date(now);if(!Number.isFinite(instant.getTime()))throw Error('Invalid schedule clock');
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const parts=d=>Object.fromEntries(fmt.formatToParts(d).map(p=>[p.type,p.value]));
 const p=parts(instant),localDate=`${p.year}-${p.month}-${p.day}`;
 const midnight=Date.parse(`${localDate}T00:00:00Z`);let scheduledAt;
 // Bound timezone offsets and DST transitions without relying on host TZ.
 for(let t=midnight-15*3600000;t<=midnight+39*3600000;t+=60000){
  const q=parts(new Date(t));if(`${q.year}-${q.month}-${q.day}`===localDate&&`${q.hour}:${q.minute}`>='02:00'){scheduledAt=new Date(t);break;}
 }
 if(!scheduledAt)throw Error('Local schedule unavailable');
 return Object.freeze({localDate,timezone,localTime:'02:00',scheduledAt:scheduledAt.toISOString(),due:instant>=scheduledAt&&instant.getTime()<scheduledAt.getTime()+60000});
}
