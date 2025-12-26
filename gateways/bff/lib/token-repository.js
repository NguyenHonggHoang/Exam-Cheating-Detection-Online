import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

// PostgreSQL connection pool
let pool = null;

const initializePool = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.BFF_DB_HOST || 'localhost',
      port: parseInt(process.env.BFF_DB_PORT || '5432'),
      database: process.env.BFF_DB_NAME || 'bff_db',
      user: process.env.BFF_DB_USER || 'postgres',
      password: process.env.BFF_DB_PASSWORD || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });

    console.log('[TokenRepository] PostgreSQL connection pool initialized');
  }
  return pool;
};

const ENCRYPTION_KEY = process.env.BFF_ENCRYPTION_KEY
  ? Buffer.from(process.env.BFF_ENCRYPTION_KEY, 'hex')
  : randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

if (!process.env.BFF_ENCRYPTION_KEY) {
  console.warn('[TokenRepository] WARNING: BFF_ENCRYPTION_KEY not set, using random key (tokens will not persist across restarts)');
}

export const TokenRepository = {
  encrypt: (text) => {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  },

  decrypt: (text) => {
    const [ivHex, authTagHex, encryptedText] = text.split(':');
    const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },

  async saveRefreshToken(userId, refreshToken) {
    try {
      const db = initializePool();
      const encryptedToken = TokenRepository.encrypt(refreshToken);

      const query = `
        INSERT INTO refresh_tokens (user_id, encrypted_token, updated_at, last_activity_at, session_expires_at, created_at)
        VALUES ($1::varchar, $2::text, NOW(), NOW(), NOW() + INTERVAL '24 hours', COALESCE((SELECT created_at FROM refresh_tokens WHERE user_id = $1::varchar), NOW()))
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          encrypted_token = $2::text, 
          updated_at = NOW(),
          last_activity_at = NOW(),
          session_expires_at = COALESCE(EXCLUDED.session_expires_at, (SELECT created_at FROM refresh_tokens WHERE user_id = $1::varchar) + INTERVAL '24 hours')
      `;

      await db.query(query, [userId, encryptedToken]);
      console.log(`[TokenRepository] Securely stored refresh token in database for user ${userId}`);
    } catch (error) {
      console.error('[TokenRepository] Error saving refresh token:', error);
      throw error;
    }
  },

  async getRefreshToken(userId) {
    try {
      const db = initializePool();
      const query = 'SELECT encrypted_token, last_activity_at, session_expires_at FROM refresh_tokens WHERE user_id = $1';
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        console.log(`[TokenRepository] No refresh token found for user ${userId}`);
        return null;
      }

      const row = result.rows[0];
      const encryptedToken = row.encrypted_token;
      try {
        const refreshToken = TokenRepository.decrypt(encryptedToken);
        return {
          token: refreshToken,
          lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at).getTime() : null,
          sessionExpiresAt: row.session_expires_at ? new Date(row.session_expires_at).getTime() : null
        };
      } catch (decryptError) {
        console.error(`[TokenRepository] Failed to decrypt token for user ${userId}, deleting corrupted token`);
        await TokenRepository.deleteRefreshToken(userId);
        return null;
      }
    } catch (error) {
      console.error('[TokenRepository] Error getting refresh token:', error);
      return null;
    }
  },

  async deleteRefreshToken(userId) {
    try {
      const db = initializePool();
      const query = 'DELETE FROM refresh_tokens WHERE user_id = $1';
      await db.query(query, [userId]);
      console.log(`[TokenRepository] Revoked refresh token in database for user ${userId}`);
    } catch (error) {
      console.error('[TokenRepository] Error deleting refresh token:', error);
      throw error;
    }
  },

  async updateLastActivity(userId) {
    try {
      const db = initializePool();
      const query = `
        UPDATE refresh_tokens 
        SET last_activity_at = NOW() 
        WHERE user_id = $1
      `;
      await db.query(query, [userId]);
    } catch (error) {
      console.error('[TokenRepository] Error updating last activity:', error);
      // Don't throw - this is not critical
    }
  },

  async checkSessionTimeout(userId) {
    try {
      const db = initializePool();
      const query = `
        SELECT last_activity_at, session_expires_at 
        FROM refresh_tokens 
        WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        return { valid: false, reason: 'NoSession' };
      }

      const row = result.rows[0];
      const now = Date.now();
      
      // Check absolute session timeout (24 hours)
      if (row.session_expires_at) {
        const sessionExpiresAt = new Date(row.session_expires_at).getTime();
        if (now > sessionExpiresAt) {
          return { valid: false, reason: 'SessionExpired' };
        }
      }

      // Check idle timeout (30 minutes)
      if (row.last_activity_at) {
        const lastActivityAt = new Date(row.last_activity_at).getTime();
        const idleTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
        const idleTime = now - lastActivityAt;
        
        if (idleTime > idleTimeout) {
          return { valid: false, reason: 'IdleTimeout' };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('[TokenRepository] Error checking session timeout:', error);
      return { valid: false, reason: 'Error' };
    }
  },

  async cleanup() {
    if (pool) {
      await pool.end();
      pool = null;
      console.log('[TokenRepository] PostgreSQL connection pool closed');
    }
  }
};