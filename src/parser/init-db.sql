SELECT 'CREATE ROLE ukma_data LOGIN PASSWORD ''ukma_data_pwd'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ukma_data')\gexec

SELECT 'CREATE DATABASE ukma_data OWNER ukma_data'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ukma_data')\gexec
