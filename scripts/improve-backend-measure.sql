\set ON_ERROR_STOP on
-- Digests are computed in PostgreSQL, before JavaScript can round bigint values.
CREATE OR REPLACE FUNCTION pg_temp.specflow_measure() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE t record; v text; n bigint; tables jsonb := '{}'::jsonb;
  sequences jsonb := '{}'::jsonb; seq jsonb; total bigint := 0; history jsonb;
BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth') ORDER BY schemaname,tablename LOOP
  EXECUTE format('SELECT count(*), encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text, E''\\n'' ORDER BY to_jsonb(r)::text COLLATE "C"), ''''), ''UTF8'')), ''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,v;
  total := total+n;
  IF total>10000 THEN RAISE EXCEPTION 'seed_row_bound'; END IF;
  tables := tables || jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',v));
 END LOOP;
 FOR t IN SELECT schemaname,sequencename,start_value,min_value,max_value,increment_by,cycle,cache_size,last_value FROM pg_sequences WHERE schemaname IN ('public','auth') ORDER BY schemaname,sequencename LOOP
  EXECUTE format('SELECT jsonb_build_object(''last_value'',last_value,''log_cnt'',log_cnt,''is_called'',is_called) FROM %I.%I',t.schemaname,t.sequencename) INTO seq;
  sequences := sequences || jsonb_build_object(t.schemaname||'.'||t.sequencename,jsonb_build_object('definition',to_jsonb(t),'state',seq));
 END LOOP;
 SELECT jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]'::jsonb)::text,'UTF8')),'hex')) INTO history FROM supabase_migrations.schema_migrations m;
 RETURN jsonb_build_object('tablesSha256',encode(sha256(convert_to(tables::text,'UTF8')),'hex'),
  'sequencesSha256',encode(sha256(convert_to(sequences::text,'UTF8')),'hex'),
  'migrationHistorySha256',history->>'sha256','migrationCount',history->'count',
  'tableCount',(SELECT count(*) FROM jsonb_object_keys(tables)),
  'sequenceCount',(SELECT count(*) FROM jsonb_object_keys(sequences)),'totalRows',total);
END $$;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT 'SNAPSHOT:' || pg_export_snapshot();
SELECT 'STATE:' || pg_temp.specflow_measure()::text;
-- The supervisor keeps this transaction open until pg_dump imports its snapshot.
