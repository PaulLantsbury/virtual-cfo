/** Local preparation only. Never connects to a source, database or scheduler. */
import {mkdir, writeFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareHistoricalStagingPackage, HISTORICAL_STAGING_TARGET} from './historical-staging-package.mjs';
import {buildDailyTestingPlan} from '../shopify/daily-testing-plan.mjs';

export async function prepareDashboardTestPackage({reviewerId, startMonday, outputDirectory, current=false}) {
  if (typeof outputDirectory !== 'string' || !outputDirectory.trim()) throw Error('Explicit output directory required');
  // Resolve/validate all financial and calendar inputs before creating output.
  const historical = await prepareHistoricalStagingPackage({...HISTORICAL_STAGING_TARGET, reviewerId,current});
  const daily = buildDailyTestingPlan({startMonday, targetStore: HISTORICAL_STAGING_TARGET.storeId, route: 'synthetic-financial'});
  const directory = resolve(outputDirectory);
  await mkdir(directory, {recursive: true});
  if ((await readdir(directory)).length) throw Error('Output directory must be empty; existing package must not be overwritten');
  const {applySql, rehearsalSql, preflightSql, postflightSql, rollbackSql, compatibilityPreflightSql, ...manifest} = historical;
  const files = {'historical-manifest.json': JSON.stringify(manifest, null, 2)+'\n',
    'historical-preflight.sql': preflightSql, 'historical-rehearsal.sql': rehearsalSql,
    'historical-apply.sql': applySql, 'historical-postflight.sql': postflightSql,
    'historical-rollback.sql': rollbackSql, 'schema-readiness.sql': compatibilityPreflightSql, 'daily-disabled-plan.json': JSON.stringify(daily, null, 2)+'\n'};
  for (const [name, contents] of Object.entries(files)) await writeFile(resolve(directory, name), contents, {flag: 'wx'});
  return {status: 'prepared-only', directory, files: Object.keys(files), manifestSha256: manifest.manifestSha256,
    schemaSha256: manifest.schemaSha256, sqlSha256: manifest.sqlSha256, rows: manifest.rows};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [reviewerId, startMonday, outputDirectory, fixtureMode, ...extra] = process.argv.slice(2);
  if ((fixtureMode && fixtureMode!=='current-2026-10-09') || extra.length || !reviewerId || !startMonday || !outputDirectory) throw Error('Usage: node experiments/financial-v1/prepare-dashboard-test-package.mjs EXISTING_APPROVED_REVIEWER_UUID EXPLICIT_MONDAY EMPTY_OUTPUT_DIRECTORY [current-2026-10-09]');
  console.log(JSON.stringify(await prepareDashboardTestPackage({reviewerId, startMonday, outputDirectory, current:fixtureMode==='current-2026-10-09'}), null, 2));
}
