-- 00-create-databases.sql
-- Create the 3 distinct databases
CREATE DATABASE identity_db;
CREATE DATABASE session_db;
CREATE DATABASE bff_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE identity_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE session_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE bff_db TO postgres;
