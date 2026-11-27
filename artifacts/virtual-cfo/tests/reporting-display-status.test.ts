import test from 'node:test';
import assert from 'node:assert/strict';
import {missingFigureLabel,supplementalFigureLabel} from '../src/lib/reportingDisplayStatus.ts';
test('Missing figure copy follows source state without treating missing selection as missing data',()=>{
 assert.equal(missingFigureLabel({loading:false,error:false,hasMonth:false}),'—');
 assert.equal(missingFigureLabel({loading:true,error:false,hasMonth:false}),'Loading…');
 assert.equal(missingFigureLabel({loading:true,error:false,hasMonth:true}),'Loading…');
 assert.equal(missingFigureLabel({loading:false,error:true,hasMonth:false}),'—');
 assert.equal(missingFigureLabel({loading:false,error:false,hasMonth:true}),'—');
});

test('Financial figures can be ready while the independent session source is loading',()=>{
 const readyFinancial={loading:false,error:false,hasMonth:true};
 assert.equal(missingFigureLabel(readyFinancial),'—'); // Only for a missing financial measure.
 assert.equal(supplementalFigureLabel(readyFinancial,true),'Loading…');
 assert.equal(supplementalFigureLabel(readyFinancial,false),'—'); // Missing session data after completion.
 assert.equal(supplementalFigureLabel({loading:false,error:false,hasMonth:false},false),'—');
});
