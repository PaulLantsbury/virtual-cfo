import test from 'node:test';
import assert from 'node:assert/strict';
import {missingFigureLabel} from '../src/lib/reportingDisplayStatus.ts';
test('Missing figure copy follows source state without treating missing selection as missing data',()=>{
 assert.equal(missingFigureLabel({loading:false,error:false,hasMonth:false}),'Choose a month');
 assert.equal(missingFigureLabel({loading:true,error:false,hasMonth:false}),'Loading');
 assert.equal(missingFigureLabel({loading:true,error:false,hasMonth:true}),'Loading');
 assert.equal(missingFigureLabel({loading:false,error:true,hasMonth:false}),'Data unavailable');
 assert.equal(missingFigureLabel({loading:false,error:false,hasMonth:true}),'Data unavailable');
});
