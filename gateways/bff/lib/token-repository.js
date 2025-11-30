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
        INSERT INTO refresh_tokens (user_id, encrypted_token, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET encrypted_token = $2, updated_at = NOW()
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
      const query = 'SELECT encrypted_token FROM refresh_tokens WHERE user_id = $1';
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        console.log(`[TokenRepository] No refresh token found for user ${userId}`);
        return null;
      }

      const encryptedToken = result.rows[0].encrypted_token;
      try {
        return TokenRepository.decrypt(encryptedToken);
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

  async cleanup() {
    if (pool) {
      await pool.end();
      pool = null;
      console.log('[TokenRepository] PostgreSQL connection pool closed');
    }
  }
};