-- READ ONLY: no credentials, provider IDs, customer payloads or action keys returned.
-- Run only in the verified Night Scout Staging operator SQL editor/read-only session.
-- Durable timestamps correlate records; they do not prove the host scheduler triggered.
WITH fixed AS (
 SELECT 'bioalckltvkhlczusdvl'::text project_ref,
 '56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid store_id,
 'pocketlaunchpad1.myshopify.com'::text domain,
 'shopify-staging-20261029'::text programme_key,now() observed_at
), expected_actions(write_date,action_key,payload_digest) AS (VALUES
 ('2026-10-29'::date,'ns-faf0659df65fcf7479bde5049b5c27d1e2b3b0e5','b4909a7b1fce2729cd80fb83071966d31fc1520f3cf49b49f00401f0ad65e35d'),
 ('2026-10-30'::date,'ns-8bf9dabd791cf0933b79da4a1d902d36fb54ff5f','d123683cba49e303e5b6ac080ab69aab38c9a5657e708095d5d51810f2ab2b10'),
 ('2026-10-31'::date,'ns-0936cb6379f71f0a2bf1b0d535ac41e15273fbd3','f0ca1bdf5cfa23920424ed82f53c9529b3114946df89ee842afa90e74f59d6ec'),
 ('2026-11-01'::date,'ns-52a5ee984a0e0b749293854ac0ca55bb41b2de49','47e22ec206c08f31d02c6c6bf9dcb1ed085631c3d0ad21f28d2286dd7347ba1a'),
 ('2026-11-02'::date,'ns-6e211f14c3d2e9e079cf7280b38c327b7623605a','b1d172c045562179969d0e3ec9075f6f1c15009c0f4978f43691b1b0045a4bfe'),
 ('2026-11-03'::date,'ns-4fa327574e63431315f8a8be4dd7e76fd4bcc010','f9e217b07f939261fb354f517e38582bdb37c4d3b956f456463d326854447da4'),
 ('2026-11-04'::date,'ns-7ea97c8b8969492667cd0478a07f52527e698d59','962bfc8de1c466bda6a48d307b04c67c3f8d9bfe977a30e528f6846f4a36ad76')
), identity AS (
 SELECT EXISTS(SELECT 1 FROM public.stores s,fixed f WHERE s.id=f.store_id
  AND s.shopify_domain=f.domain AND s.shopify_store_id='95601983836'
  AND s.currency_code='GBP' AND s.timezone='Europe/London') store_ok,
 EXISTS(SELECT 1 FROM staging_test_programme.programmes p,fixed f
  WHERE p.programme_key=f.programme_key AND p.provider='shopify' AND p.target=f.domain
  AND p.project_ref=f.project_ref AND p.action_cap=7
  AND p.starts_at='2026-10-29T00:00:00Z'::timestamptz
  AND p.ends_at='2026-11-05T00:00:00Z'::timestamptz) programme_ok
), action_rows AS (
 SELECT a.*,e.write_date expected_write_date,row_number() OVER(ORDER BY a.created_at,a.action_key)::integer action_ordinal,
 ((a.created_at AT TIME ZONE 'Europe/London')::date+1) expected_night,
 count(*) OVER(PARTITION BY a.source_id) duplicate_source_count
 FROM staging_test_programme.actions a CROSS JOIN fixed f
 LEFT JOIN expected_actions e ON e.action_key=a.action_key AND e.payload_digest=a.payload_digest
 WHERE a.programme_key=f.programme_key
), evidence AS (
 SELECT a.action_ordinal,a.state writer_state,
 (a.created_at AT TIME ZONE 'Europe/London')::date::text write_local_date,
 a.expected_night::text expected_nightly_local_date,
 (a.expected_night+TIME '02:00') AT TIME ZONE 'Europe/London' expected_at,
 a.source_id IS NOT NULL AND a.source_id ~ '^gid://shopify/Order/[1-9][0-9]*$'
  AND a.duplicate_source_count=1 AND a.confirmed_at>=a.submitted_at AND a.submitted_at>=a.created_at
  AND a.confirmed_at<=(SELECT observed_at FROM fixed)
  AND a.confirmed_at<(a.expected_night+TIME '02:00') AT TIME ZONE 'Europe/London'
  AND a.expected_write_date=(a.created_at AT TIME ZONE 'Europe/London')::date
  AND a.created_at>='2026-10-29T00:00:00Z' AND a.created_at<'2026-11-05T00:00:00Z'
  AND (a.created_at AT TIME ZONE 'Europe/London')::time>=TIME '18:00'
  AND (a.created_at AT TIME ZONE 'Europe/London')::time<TIME '18:15' AS writer_identity_ok,
 n.claim_count,n.claim_completed,n.claim_timed,n.scope_ok,n.attempt_count,n.attempt_finished,
 n.attempt_result,n.date_from,n.date_to,n.attempt_started,
 (SELECT count(*)::integer FROM public.orders o,fixed f WHERE o.store_id=f.store_id
   AND o.shopify_order_id IN (a.source_id,split_part(a.source_id,'/',5))) merchant_order_count,
 b.candidate_count,b.source_match_count,b.test_match_count,b.exclusion_count,b.mapped_event_count,
 b.context_ok,b.recheck_required
 FROM action_rows a
 LEFT JOIN LATERAL (
  SELECT count(*)::integer claim_count,bool_and(c.state='completed') claim_completed,
   bool_and(c.date_to=a.expected_night-1 AND c.date_from=a.expected_night-31) scope_ok,
   bool_and(c.timezone='Europe/London'
    AND c.scheduled_at=(a.expected_night+TIME '02:00') AT TIME ZONE 'Europe/London'
    AND c.started_at>=c.scheduled_at AND c.started_at<c.scheduled_at+interval '15 minutes'
    AND c.finished_at<=f.observed_at) claim_timed,
   (SELECT count(*)::integer FROM ingest_v1.sync_attempts t WHERE t.store_id=(SELECT store_id FROM fixed)
     AND t.date_from=min(c.date_from) AND t.date_to=min(c.date_to)
     AND t.started_at>=min(c.started_at) AND t.finished_at<=max(c.finished_at)
     AND t.state='completed' AND t.result_code IN ('recorded_requires_review','changed_requires_review','replay')) attempt_count,
   (SELECT min(t.started_at) FROM ingest_v1.sync_attempts t WHERE t.store_id=(SELECT store_id FROM fixed)
     AND t.date_from=min(c.date_from) AND t.date_to=min(c.date_to)
     AND t.started_at>=min(c.started_at) AND t.finished_at<=max(c.finished_at)
     AND t.state='completed' AND t.result_code IN ('recorded_requires_review','changed_requires_review','replay')) attempt_started,
   (SELECT max(t.finished_at) FROM ingest_v1.sync_attempts t WHERE t.store_id=(SELECT store_id FROM fixed)
     AND t.date_from=min(c.date_from) AND t.date_to=min(c.date_to)
     AND t.started_at>=min(c.started_at) AND t.finished_at<=max(c.finished_at)
     AND t.state='completed' AND t.result_code IN ('recorded_requires_review','changed_requires_review','replay')) attempt_finished,
   (SELECT min(t.result_code) FROM ingest_v1.sync_attempts t WHERE t.store_id=(SELECT store_id FROM fixed)
     AND t.date_from=min(c.date_from) AND t.date_to=min(c.date_to)
     AND t.started_at>=min(c.started_at) AND t.finished_at<=max(c.finished_at)
     AND t.state='completed' AND t.result_code IN ('recorded_requires_review','changed_requires_review','replay')) attempt_result,
   min(c.date_from) date_from,min(c.date_to) date_to
  FROM ingest_v1.nightly_claims c,fixed f
  WHERE c.store_id=f.store_id AND c.local_date=a.expected_night
 ) n ON true
 LEFT JOIN LATERAL (
  SELECT count(*)::integer candidate_count,
   max((SELECT count(*)::integer FROM jsonb_array_elements(x.payload->'source'->'orders') o WHERE o->>'id'=a.source_id)) source_match_count,
   max((SELECT count(*)::integer FROM jsonb_array_elements(x.payload->'source'->'orders') o WHERE o->>'id'=a.source_id AND o->'test'='true'::jsonb)) test_match_count,
   max((SELECT count(*)::integer FROM jsonb_array_elements(x.payload->'mapped'->'excluded') e WHERE e->>'id'=a.source_id AND e->>'reason'='TEST_ORDER')) exclusion_count,
   max((SELECT count(*)::integer FROM jsonb_array_elements(x.payload->'mapped'->'events') e WHERE e->>'orderId'=a.source_id)) mapped_event_count,
   bool_and(x.mapping_state='mapped_for_review' AND NOT x.coverage_certified
    AND x.payload->'source'->'settings'->>'domain'=f.domain
    AND x.payload->'source'->'settings'->>'shopId'='gid://shopify/Shop/95601983836'
    AND x.payload->'source'->'settings'->>'currency'='GBP'
    AND x.payload->'source'->'settings'->>'timezone'='Europe/London'
    AND x.payload->'source'->'scope'->>'storeId'=f.store_id::text
    AND x.payload->'source'->'scope'->>'shopId'='gid://shopify/Shop/95601983836'
    AND x.payload->'source'->'scope'->>'from'=x.date_from::text
    AND x.payload->'source'->'scope'->>'to'=x.date_to::text) context_ok,
   bool_or(COALESCE(h.needs_recheck,false)) recheck_required
  FROM ingest_v1.batches x CROSS JOIN fixed f
  LEFT JOIN ingest_v1.heads h ON h.batch_id=x.id AND h.store_id=x.store_id
   AND h.date_from=x.date_from AND h.date_to=x.date_to
  WHERE x.store_id=f.store_id AND x.date_from=n.date_from AND x.date_to=n.date_to
   AND x.created_at>=n.attempt_started AND x.created_at<=n.attempt_finished
 ) b ON true
), projected AS (
 SELECT action_ordinal,write_local_date,expected_nightly_local_date,
 CASE
  WHEN NOT COALESCE(writer_identity_ok,false) AND writer_state='confirmed' THEN 'blocked_writer_identity'
  WHEN writer_state<>'confirmed' THEN 'writer_not_confirmed'
  WHEN merchant_order_count<>0 THEN 'blocked_merchant_finance_inclusion'
  WHEN expected_at>(SELECT observed_at FROM fixed) THEN 'not_yet_due'
  WHEN claim_count=0 AND expected_at+interval '15 minutes'>(SELECT observed_at FROM fixed) THEN 'nightly_window_open'
  WHEN claim_count=0 THEN 'nightly_missing'
  WHEN claim_count<>1 OR NOT COALESCE(claim_completed,false) OR NOT COALESCE(claim_timed,false) THEN 'blocked_nightly_record'
  WHEN NOT COALESCE(scope_ok,false) THEN 'blocked_nightly_scope'
  WHEN attempt_count<>1 THEN 'blocked_attempt_linkage'
  WHEN candidate_count<>1 THEN 'candidate_linkage_unavailable'
  WHEN NOT COALESCE(context_ok,false) THEN 'blocked_candidate_context'
  WHEN source_match_count<>1 OR test_match_count<>1 OR exclusion_count<>1 OR mapped_event_count<>0 THEN 'blocked_test_exclusion'
  ELSE 'stored_test_exclusion_confirmed'
 END state,
 COALESCE(recheck_required,false) candidate_recheck_required
 FROM evidence
)
SELECT jsonb_build_object(
 'event','shopify_test_ingestion_verification','projectRef',f.project_ref,
 'programmeKey',f.programme_key,'observedAt',f.observed_at,
 'state',CASE WHEN NOT i.store_ok OR NOT i.programme_ok THEN 'blocked_target'
   WHEN (SELECT count(*) FROM action_rows)>7 THEN 'blocked_action_cap'
   WHEN NOT EXISTS(SELECT 1 FROM action_rows) THEN 'awaiting_writer_actions'
   ELSE 'action_evidence_reported' END,
 'actions',CASE WHEN i.store_ok AND i.programme_ok AND (SELECT count(*) FROM action_rows)<=7
   THEN COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY action_ordinal) FROM projected p),'[]'::jsonb)
   ELSE '[]'::jsonb END,
 'hostReceiptCorrelation','not_assessed',
 'linkageBasis','unique period and timestamp correlation; no durable attempt-to-batch foreign key',
 'financialVerification','not_assessed','writeAttempted',false,'providerCalled',false
) result FROM fixed f CROSS JOIN identity i;
