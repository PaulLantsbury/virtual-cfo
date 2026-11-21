-- OFFLINE additive withdrawal proposal; no grants, roles, deletion or activation.
-- Correction of same-base content remains unsupported by immutable UNIQUE base.
BEGIN;
CREATE TABLE finance_customer_sidecar_v1.withdrawals(
 base_snapshot_id uuid PRIMARY KEY REFERENCES finance_review_supplement_v1.snapshots(snapshot_id),
 version_id text NOT NULL UNIQUE REFERENCES finance_customer_sidecar_v1.versions(version_id),
 withdrawn_by uuid NOT NULL,
 withdrawn_at timestamptz NOT NULL CHECK(isfinite(withdrawn_at)),
 reason_code text NOT NULL CHECK(reason_code IN('source-correction','scope-error','owner-withdrawal'))
);
CREATE FUNCTION finance_customer_sidecar_v1.guard_withdrawal() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_allowed boolean; matched boolean;
BEGIN
 SELECT c.relowner=r.oid OR r.rolsuper INTO owner_allowed FROM pg_catalog.pg_class c CROSS JOIN pg_catalog.pg_roles r WHERE c.oid=TG_RELID AND r.rolname=current_user;
 IF NOT coalesce(owner_allowed,false) THEN RAISE EXCEPTION 'Owner-reviewed withdrawal only'; END IF;
 SELECT EXISTS(SELECT 1 FROM finance_customer_sidecar_v1.selections s
 JOIN finance_customer_sidecar_v1.versions v ON v.version_id=s.version_id AND v.base_snapshot_id=s.base_snapshot_id
 JOIN public.store_memberships m ON m.store_id=v.store_id AND m.user_id=NEW.withdrawn_by
 WHERE s.base_snapshot_id=NEW.base_snapshot_id AND s.version_id=NEW.version_id
 AND NEW.withdrawn_at>=s.selected_at AND NEW.withdrawn_at<=statement_timestamp()) INTO matched;
 IF NOT coalesce(matched,false) THEN RAISE EXCEPTION 'Exact selected tuple, member reviewer and bounded withdrawal time required'; END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER withdrawal_insert BEFORE INSERT ON finance_customer_sidecar_v1.withdrawals FOR EACH ROW EXECUTE FUNCTION finance_customer_sidecar_v1.guard_withdrawal();
CREATE TRIGGER withdrawal_change BEFORE UPDATE OR DELETE ON finance_customer_sidecar_v1.withdrawals FOR EACH ROW EXECUTE FUNCTION finance_customer_sidecar_v1.deny_change();
CREATE TRIGGER withdrawal_truncate BEFORE TRUNCATE ON finance_customer_sidecar_v1.withdrawals FOR EACH STATEMENT EXECUTE FUNCTION finance_customer_sidecar_v1.deny_change();
ALTER TABLE finance_customer_sidecar_v1.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_read ON finance_customer_sidecar_v1.withdrawals FOR SELECT USING(
 EXISTS(SELECT 1 FROM public.store_memberships m JOIN finance_customer_sidecar_v1.versions v ON v.store_id=m.store_id
 WHERE v.version_id=withdrawals.version_id AND v.base_snapshot_id=withdrawals.base_snapshot_id
 AND m.user_id=NULLIF(current_setting('night_scout.profit_user_id',true),'')::uuid));
REVOKE ALL ON finance_customer_sidecar_v1.withdrawals FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_customer_sidecar_v1.guard_withdrawal() FROM PUBLIC;
-- Trusted active reader must exclude withdrawals by exact base+version in the
-- same repeatable-read transaction; schema alone does not install that reader.
COMMIT;
