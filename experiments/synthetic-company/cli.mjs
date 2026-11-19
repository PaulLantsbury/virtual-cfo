#!/usr/bin/env node
import { generate, summarise } from './generator.mjs';
const args=process.argv.slice(2), options={};let full=false;
try {
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(arg==='--full') {full=true;continue;}
    if(!['--as-of','--from','--months','--company'].includes(arg)||!args[i+1]||args[i+1].startsWith('--'))throw Error(`Unknown or incomplete option: ${arg}`);
    options[{'--as-of':'asOf','--from':'from','--months':'months','--company':'company'}[arg]]=arg==='--months'?Number(args[++i]):args[++i];
  }
  const f=generate(options);
  process.stdout.write(JSON.stringify(full?f:{scope:f.scope,from:f.from,to:f.to,eventCount:f.events.length,days:f.daily.length,fingerprint:f.fingerprint,totals:summarise(f),limitations:f.limitations},null,2)+'\n');
}catch(error) {process.stderr.write(`${error.message}\n`);process.exitCode=1;}
