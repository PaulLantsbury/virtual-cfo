-- PROPOSAL ONLY. Apply on staging after Paul approves this one-store membership.
-- Trusted administrator must first resolve/verify Paul's existing staging account
-- and SET night_scout.approved_member_id to that UUID in this session.
-- No account/contact information is embedded in this public proposal.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
DECLARE member_id uuid := nullif(current_setting('night_scout.approved_member_id',true),'')::uuid;
BEGIN
 IF member_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=member_id) THEN
  RAISE EXCEPTION 'A verified existing staging account must be supplied';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London') OR to_regprocedure('public.shopify_connection_status(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Expected staging connection status setup is required';
 END IF;
 INSERT INTO public.store_memberships(user_id,store_id) VALUES(member_id,'56d92f8a-746e-4b4f-b408-81fc98c4aa17') ON CONFLICT DO NOTHING;
END $$;
-- Deliberately no review_authorizations change and no figure verification.
COMMIT;
