export function reportingConfigReadiness(env: Record<string,string|undefined>): {
 event:'web_reporting_configuration';enabled:boolean;staging:boolean;expectedProject:boolean;
 present:Record<string,boolean>;validDedicatedConfiguration:boolean;
};
