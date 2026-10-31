-- LOCAL PROPOSAL ONLY. Requires finance_v1 and ingest_v1 candidate schema.
-- Invalidates coverage; never publishes or recertifies figures.
BEGIN;
CREATE FUNCTION ingest_v1.invalidate_verified_store(p_store_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=false
 WHERE store_id=p_store_id AND sales_and_refunds_complete;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_verified_store(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION ingest_v1.invalidate_source_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE old_store uuid; new_store uuid;
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN old_store:=OLD.store_id; END IF;
 IF TG_OP<>'DELETE' THEN new_store:=NEW.store_id; END IF;
 IF old_store IS NOT NULL THEN
  PERFORM ingest_v1.invalidate_verified_store(old_store);
  UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=old_store AND NOT needs_recheck;
 END IF;
 IF new_store IS NOT NULL AND new_store IS DISTINCT FROM old_store THEN
  PERFORM ingest_v1.invalidate_verified_store(new_store);
  UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=new_store AND NOT needs_recheck;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_source_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ingest_source_coverage AFTER INSERT OR UPDATE OR DELETE ON ingest_v1.source_versions
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();
CREATE TRIGGER ingest_order_coverage AFTER INSERT OR UPDATE OR DELETE ON public.orders
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();
CREATE TRIGGER ingest_refund_coverage AFTER INSERT OR UPDATE OR DELETE ON public.refunds
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();

CREATE FUNCTION ingest_v1.invalidate_head_review()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM ingest_v1.invalidate_verified_store(OLD.store_id); RETURN OLD;
 END IF;
 IF NEW.needs_recheck THEN PERFORM ingest_v1.invalidate_verified_store(NEW.store_id); END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_head_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ingest_head_coverage AFTER INSERT OR UPDATE OR DELETE ON ingest_v1.heads
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_head_review();

CREATE FUNCTION ingest_v1.invalidate_store_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM ingest_v1.invalidate_verified_store(NEW.id);
 UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=NEW.id AND NOT needs_recheck;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_store_settings() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ingest_settings_coverage AFTER UPDATE ON public.stores
 FOR EACH ROW WHEN (
 OLD.currency_code IS DISTINCT FROM NEW.currency_code OR OLD.timezone IS DISTINCT FROM NEW.timezone
 OR OLD.shopify_domain IS DISTINCT FROM NEW.shopify_domain OR OLD.shopify_store_id IS DISTINCT FROM NEW.shopify_store_id)
 EXECUTE FUNCTION ingest_v1.invalidate_store_settings();
COMMIT;
