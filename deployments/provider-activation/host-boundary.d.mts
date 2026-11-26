export type CapabilityProfile='website-report'|'private-api'|'meta-collector'|'google-collector';
export function validateHostEnvironment(profile:CapabilityProfile,env:Readonly<Record<string,string|undefined>>):Readonly<{profile:CapabilityProfile;providerVariableCount:number;canExecute:false}>;
