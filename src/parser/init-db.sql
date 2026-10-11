\getenv ukma_data_password UKMA_DATA_DB_PASSWORD
SELECT format('CREATE ROLE ukma_data LOGIN PASSWORD %L', :'ukma_data_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ukma_data')\gexec

SELECT 'CREATE DATABASE ukma_data OWNER ukma_data'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ukma_data')\gexec
