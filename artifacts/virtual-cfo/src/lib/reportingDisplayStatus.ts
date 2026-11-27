/** Display copy only: never supplies, changes or authorizes a numeric value. */
export function missingFigureLabel({loading,error,hasMonth}:{loading:boolean;error:boolean;hasMonth:boolean}):string {
 if(loading)return 'Loading';
 if(error)return 'Data unavailable';
 return hasMonth?'Data unavailable':'Choose a month';
}
