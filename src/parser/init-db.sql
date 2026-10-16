\getenv ukma_data_password UKMA_DATA_DB_PASSWORD
SELECT set_config('ukma_data.password', :'ukma_data_password', false) IS NULL AS unused \gset
DO $$
BEGIN
	IF current_setting('ukma_data.password') = '' THEN
		RAISE EXCEPTION 'UKMA_DATA_DB_PASSWORD is empty, set it in src/.env';
	END IF;
END $$;

SELECT 'CREATE ROLE ukma_data LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ukma_data')\gexec

SELECT format('ALTER ROLE ukma_data PASSWORD %L', :'ukma_data_password')\gexec

SELECT 'CREATE DATABASE ukma_data OWNER ukma_data'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ukma_data')\gexec
