import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getRedisClient } from './redis';

const ENCRYPTION_KEY = process.env.BFF_ENCRYPTION_KEY
  ? Buffer.from(process.env.BFF_ENCRYPTION_KEY, 'hex')
  : randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

if (!process.env.BFF_ENCRYPTION_KEY) {
  console.warn('[TokenRepository] WARNING: BFF_ENCRYPTION_KEY not set, using random key (tokens will not persist across restarts)');
}

const ABSOLUTE_SESSION_TIMEOUT_SECONDS = 24 * 60 * 60; // 24 hours
const IDLE_TIMEOUT_MILLISECONDS = 30 * 60 * 1000; // 30 minutes

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
      const redis = getRedisClient();
      const encryptedToken = TokenRepository.encrypt(refreshToken);
      
      const now = Date.now();
      const sessionExpiresAt = now + (ABSOLUTE_SESSION_TIMEOUT_SECONDS * 1000);

      const sessionData = {
        encryptedToken,
        createdAt: now,
        lastActivityAt: now,
        sessionExpiresAt
      };

      // Store in Redis with 24 hours TTL (absolute timeout)
      await redis.set(userId, JSON.stringify(sessionData), 'EX', ABSOLUTE_SESSION_TIMEOUT_SECONDS);
      console.log(`[TokenRepository][Redis] Securely stored session and refresh token for user ${userId}`);
    } catch (error) {
      console.error('[TokenRepository][Redis] Error saving refresh token:', error);
      throw error;
    }
  },

  async getRefreshToken(userId) {
    try {
      const redis = getRedisClient();
      const data = await redis.get(userId);

      if (!data) {
        console.log(`[TokenRepository][Redis] No session found for user ${userId}`);
        return null;
      }

      const sessionData = JSON.parse(data);
      try {
        const refreshToken = TokenRepository.decrypt(sessionData.encryptedToken);
        return {
          token: refreshToken,
          lastActivityAt: sessionData.lastActivityAt,
          sessionExpiresAt: sessionData.sessionExpiresAt
        };
      } catch (decryptError) {
        console.error(`[TokenRepository][Redis] Failed to decrypt token for user ${userId}, deleting corrupted token`);
        await TokenRepository.deleteRefreshToken(userId);
        return null;
      }
    } catch (error) {
      console.error('[TokenRepository][Redis] Error getting refresh token:', error);
      return null;
    }
  },

  async deleteRefreshToken(userId) {
    try {
      const redis = getRedisClient();
      await redis.del(userId);
      console.log(`[TokenRepository][Redis] Revoked and deleted session for user ${userId}`);
    } catch (error) {
      console.error('[TokenRepository][Redis] Error deleting refresh token:', error);
      throw error;
    }
  },

  async updateLastActivity(userId) {
    try {
      const redis = getRedisClient();
      const data = await redis.get(userId);
      
      if (!data) return;

      const sessionData = JSON.parse(data);
      const now = Date.now();
      sessionData.lastActivityAt = now;

      // Calculate remaining TTL to preserve absolute 24h session expiration
      const remainingMs = sessionData.sessionExpiresAt - now;
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

      await redis.set(userId, JSON.stringify(sessionData), 'EX', remainingSeconds);
    } catch (error) {
      console.error('[TokenRepository][Redis] Error updating last activity:', error);
    }
  },

  async checkSessionTimeout(userId) {
    try {
      const redis = getRedisClient();
      const data = await redis.get(userId);

      if (!data) {
        return { valid: false, reason: 'NoSession' };
      }

      const sessionData = JSON.parse(data);
      const now = Date.now();
      
      // 1. Check absolute session timeout (24 hours)
      if (sessionData.sessionExpiresAt && now > sessionData.sessionExpiresAt) {
        await TokenRepository.deleteRefreshToken(userId);
        return { valid: false, reason: 'SessionExpired' };
      }

      // 2. Check idle timeout (30 minutes)
      if (sessionData.lastActivityAt) {
        const idleTime = now - sessionData.lastActivityAt;
        if (idleTime > IDLE_TIMEOUT_MILLISECONDS) {
          await TokenRepository.deleteRefreshToken(userId);
          return { valid: false, reason: 'IdleTimeout' };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('[TokenRepository][Redis] Error checking session timeout:', error);
      return { valid: false, reason: 'Error' };
    }
  },

  async cleanup() {
    // Keep interface for compatibility
    console.log('[TokenRepository][Redis] Cleanup completed');
  }
};