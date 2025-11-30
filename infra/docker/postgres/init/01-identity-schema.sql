-- 01-identity-schema.sql
\connect identity_db

-- (Content from 01-oauth-schema.sql)
CREATE TABLE IF NOT EXISTS oauth2_registered_client
(
    id                            varchar(100)  NOT NULL PRIMARY KEY,
    client_id                     varchar(100)  NOT NULL UNIQUE,
    client_id_issued_at           timestamp,
    client_secret                 varchar(200),
    client_secret_expires_at      timestamp,
    client_name                   varchar(200)  NOT NULL,
    client_authentication_methods varchar(1000) NOT NULL,
    authorization_grant_types     varchar(1000) NOT NULL,
    redirect_uris                 varchar(1000),
    post_logout_redirect_uris     varchar(1000),
    scopes                        varchar(1000) NOT NULL,
    client_settings               varchar(2000) NOT NULL,
    token_settings                varchar(2000) NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth2_authorization
(
    id                            varchar(100)  NOT NULL PRIMARY KEY,
    registered_client_id          varchar(100)  NOT NULL,
    principal_name                varchar(200)  NOT NULL,
    authorization_grant_type      varchar(100)  NOT NULL,
    authorized_scopes             varchar(1000),
    attributes                    text,
    state                         varchar(500),
    authorization_code_value      text,
    authorization_code_issued_at  timestamp,
    authorization_code_expires_at timestamp,
    authorization_code_metadata   text,
    access_token_value            text,
    access_token_issued_at        timestamp,
    access_token_expires_at       timestamp,
    access_token_metadata         text,
    access_token_type             varchar(100),
    access_token_scopes           varchar(1000),
    oidc_id_token_value           text,
    oidc_id_token_issued_at       timestamp,
    oidc_id_token_expires_at      timestamp,
    oidc_id_token_metadata        text,
    refresh_token_value           text,
    refresh_token_issued_at       timestamp,
    refresh_token_expires_at      timestamp,
    refresh_token_metadata        text,
    user_code_value               text,
    user_code_issued_at           timestamp,
    user_code_expires_at          timestamp,
    user_code_metadata            text,
    device_code_value             text,
    device_code_issued_at         timestamp,
    device_code_expires_at        timestamp,
    device_code_metadata          text
);

CREATE TABLE IF NOT EXISTS oauth2_authorization_consent
(
    registered_client_id varchar(100)  NOT NULL,
    principal_name       varchar(200)  NOT NULL,
    authorities          varchar(1000) NOT NULL,
    PRIMARY KEY (registered_client_id, principal_name)
);

-- Users table (for authentication)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('ADMIN', 'PROCTOR', 'REVIEWER', 'CANDIDATE');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'CANDIDATE',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_users ON users;
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Roles table (for user-service many-to-many relationship)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(32) UNIQUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(role_name);

-- User-Roles join table (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Seed roles
INSERT INTO roles (id, role_name) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'ADMIN'),
  ('22222222-2222-2222-2222-222222222222', 'PROCTOR'),
  ('33333333-3333-3333-3333-333333333333', 'REVIEWER'),
  ('44444444-4444-4444-4444-444444444444', 'CANDIDATE')
ON CONFLICT (role_name) DO NOTHING;

-- Seed users with {noop} encoded passwords
-- Store admin user ID for later reference
DO $$
DECLARE
  admin_user_id UUID;
  reviewer_user_id UUID;
  proctor_user_id UUID;
  student_user_id UUID;
BEGIN
  -- Insert admin user
  INSERT INTO users (id, username, email, password_hash, role, enabled)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'admin', 'admin@example.com', '{noop}admin', 'ADMIN', TRUE)
  ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash
  RETURNING id INTO admin_user_id;
  
  -- Assign ADMIN role to admin user
  INSERT INTO user_roles (user_id, role_id)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', '11111111-1111-1111-1111-111111111111')
  ON CONFLICT DO NOTHING;

  -- Insert reviewer user
  INSERT INTO users (id, username, email, password_hash, role, enabled)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'reviewer', 'reviewer@example.com', '{noop}reviewer', 'REVIEWER', TRUE)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO reviewer_user_id;
  
  INSERT INTO user_roles (user_id, role_id)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', '33333333-3333-3333-3333-333333333333')
  ON CONFLICT DO NOTHING;

  -- Insert proctor user
  INSERT INTO users (id, username, email, password_hash, role, enabled)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'proctor', 'proctor@example.com', '{noop}proctor', 'PROCTOR', TRUE)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO proctor_user_id;
  
  INSERT INTO user_roles (user_id, role_id)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000003', '22222222-2222-2222-2222-222222222222')
  ON CONFLICT DO NOTHING;

  -- Insert student user
  INSERT INTO users (id, username, email, password_hash, role, enabled)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000004', 'student', 'student@example.com', '{noop}student', 'CANDIDATE', TRUE)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO student_user_id;
  
  INSERT INTO user_roles (user_id, role_id)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000004', '44444444-4444-4444-4444-444444444444')
  ON CONFLICT DO NOTHING;

  -- Insert user1 for testing
  INSERT INTO users (id, username, email, password_hash, role, enabled)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000005', 'user1', 'user1@example.com', '{noop}password', 'CANDIDATE', TRUE)
  ON CONFLICT (username) DO NOTHING;
  
  INSERT INTO user_roles (user_id, role_id)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-000000000005', '44444444-4444-4444-4444-444444444444')
  ON CONFLICT DO NOTHING;
END $$;

-- Seed Data for OAuth2 Clients
INSERT INTO oauth2_registered_client (
    id, 
    client_id, 
    client_id_issued_at, 
    client_secret, 
    client_name, 
    client_authentication_methods, 
    authorization_grant_types, 
    redirect_uris, 
    post_logout_redirect_uris, 
    scopes, 
    client_settings, 
    token_settings
) VALUES (
    'exam-bff-client-seed-id',
    'exam-bff-client',
    CURRENT_TIMESTAMP,
    '{noop}exam-bff-secret', -- exam-bff-secret
    'Exam BFF Client',
    'client_secret_basic',
    'refresh_token,authorization_code',
    'http://localhost:8080/api/auth/callback/exam-oidc',
    'http://localhost:5173/login',
    'openid,profile,exam.read,exam.write',
    '{"@class":"java.util.Collections$UnmodifiableMap","settings.client.require-proof-key":false,"settings.client.require-authorization-consent":true}',
    '{"@class":"java.util.Collections$UnmodifiableMap","settings.token.reuse-refresh-tokens":false,"settings.token.id-token-signature-algorithm":["org.springframework.security.oauth2.jose.jws.SignatureAlgorithm","RS256"],"settings.token.access-token-time-to-live":["java.time.Duration",900.000000000],"settings.token.access-token-format":{"@class":"org.springframework.security.oauth2.server.authorization.settings.OAuth2TokenFormat","value":"self-contained"},"settings.token.refresh-token-time-to-live":["java.time.Duration",43200.000000000],"settings.token.authorization-code-time-to-live":["java.time.Duration",300.000000000],"settings.token.device-code-time-to-live":["java.time.Duration",300.000000000]}'
) ON CONFLICT (client_id) DO NOTHING;

-- Register Session Service as Client
INSERT INTO oauth2_registered_client (
    id, 
    client_id, 
    client_id_issued_at, 
    client_secret, 
    client_name, 
    client_authentication_methods, 
    authorization_grant_types, 
    redirect_uris, 
    post_logout_redirect_uris, 
    scopes, 
    client_settings, 
    token_settings
) VALUES (
    'session-service-client-id',
    'session-service',
    CURRENT_TIMESTAMP,
    '{noop}session-secret', -- session-secret
    'Session Service',
    'client_secret_basic',
    'client_credentials',
    NULL,
    NULL,
    'internal.read,internal.write',
    '{"@class":"java.util.Collections$UnmodifiableMap","settings.client.require-proof-key":false,"settings.client.require-authorization-consent":false}',
    '{"@class":"java.util.Collections$UnmodifiableMap","settings.token.access-token-time-to-live":["java.time.Duration",3600.000000000],"settings.token.access-token-format":{"@class":"org.springframework.security.oauth2.server.authorization.settings.OAuth2TokenFormat","value":"self-contained"}}'
) ON CONFLICT (client_id) DO NOTHING;

-- Register User Service as Client (for potential future inter-service calls)
INSERT INTO oauth2_registered_client (
    id, 
    client_id, 
    client_id_issued_at, 
    client_secret, 
    client_name, 
    client_authentication_methods, 
    authorization_grant_types, 
    redirect_uris, 
    post_logout_redirect_uris, 
    scopes, 
    client_settings, 
    token_settings
) VALUES (
    'user-service-client-id',
    'user-service',
    CURRENT_TIMESTAMP,
    '{noop}user-secret', -- user-secret
    'User Service',
    'client_secret_basic',
    'client_credentials',
    NULL,
    NULL,
    'internal.read,internal.write',
    '{"@class":"java.util.Collections$UnmodifiableMap","settings.client.require-proof-key":false,"settings.client.require-authorization-consent":false}',
    '{"@class":"java.util.Collections$UnmodifiableMap","settings.token.access-token-time-to-live":["java.time.Duration",3600.000000000],"settings.token.access-token-format":{"@class":"org.springframework.security.oauth2.server.authorization.settings.OAuth2TokenFormat","value":"self-contained"}}'
) ON CONFLICT (client_id) DO NOTHING;
