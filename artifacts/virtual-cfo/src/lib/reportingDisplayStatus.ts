/** Display copy only: never supplies, changes or authorizes a numeric value. */
export function missingFigureLabel({loading,error,hasMonth}:{loading:boolean;error:boolean;hasMonth:boolean}):string {
 if(loading)return 'Loading…';
 return '—';
}

/** A slower supplemental read must not inherit the settled financial status. */
export function supplementalFigureLabel(financial:{loading:boolean;error:boolean;hasMonth:boolean},supplementLoading:boolean):string {
 return financial.hasMonth&&supplementLoading?'Loading…':missingFigureLabel(financial);
}
