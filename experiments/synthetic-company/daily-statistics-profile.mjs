/** Independently generated from a fresh upstream PostgreSQL 17.6 extension 1.11 fixture. Never populate from a hosted catalog. */
export const PG17_STATISTICS_PROFILE=Object.freeze({
 id:'postgresql-17.6-pg-stat-statements-1.11-upstream-default',
 platformAclRoles:Object.freeze([]),
 viewPins:Object.freeze({
  pg_stat_statements:'7fbe2a88f4bb053055495d59628bfed5f1731fe97d536b11d8d6491c24cb9db9',
  pg_stat_statements_info:'4e57da93ea76e93065e164eed1bc1d8b6dbe070cfe6fad0173519bb04a083cb2',
 }),
 functionPins:Object.freeze({
  'pg_stat_statements(boolean)':'cef578474901b1236c32481e5f418e5dc7980a284ee749d333e2e455e59218a0',
  'pg_stat_statements_info()':'86637bdea844ec7d2d824c822945bd8e004d33c394905c55ce48cf7f4c04ee7f',
  'pg_stat_statements_reset(oid, oid, bigint, boolean)':'6c68a1252af9ad63659ac61a27b3760ef3e947e390e8405649a7c9a89d2696d0',
 }),
});
/** Supabase's pinned public bootstrap source grants existing dashboard_user metadata rights. No grant is made by this candidate. */
export const PG17_STATISTICS_SUPABASE_PROFILE=Object.freeze({
 id:'postgresql-17.6-pg-stat-statements-1.11-supabase-bootstrap-8698fe8',
 source:'https://github.com/supabase/postgres/blob/8698fe81703a4eade3b18bbe0adddd89628d15c2/migrations/db/init-scripts/00000000000003-post-setup.sql',
 platformAclRoles:Object.freeze([Object.freeze({name:'dashboard_user',login:false,superuser:false,bypassRls:false,replication:true,createRole:true,createDb:true,inherit:true})]),
 viewPins:Object.freeze({pg_stat_statements:'a9cff0bbd1fe3bc8de3c17fb4ac8b325567bf70038be62cddd3b7983476b7217',pg_stat_statements_info:'c63b71ccd5679e0125fc02bfe4bbd962ac7c4957158f68014bc00d7989cc03c7'}),
 functionPins:Object.freeze({
  'pg_stat_statements(boolean)':'fb2651cd376eb5fed04ea34fb2e87696d08238f15715ee43ebab39f7728f752d',
  'pg_stat_statements_info()':'d75928aebfdc65a1e765226dc00c0be144cff21e250eaa29e6a5a657757a957e',
  'pg_stat_statements_reset(oid, oid, bigint, boolean)':'f9ae85b0c81a556b4367ffc25ff5250a4be78b574d05d4ba30de96dba2c9e0f9',
 }),
});
export const PG17_STATISTICS_PROFILES=Object.freeze({[PG17_STATISTICS_PROFILE.id]:PG17_STATISTICS_PROFILE,[PG17_STATISTICS_SUPABASE_PROFILE.id]:PG17_STATISTICS_SUPABASE_PROFILE});
