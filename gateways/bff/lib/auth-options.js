import { TokenRepository } from "./token-repository";

async function refreshAccessToken(token) {
  try {
    const url = process.env.AUTH_SERVER_TOKEN_URL || "http://localhost:9000/oauth2/token";
    const storedTokenData = await TokenRepository.getRefreshToken(token.sub);

    if (!storedTokenData || !storedTokenData.token) {
      console.error("No refresh token found server-side for user", token.sub);
      throw new Error("NoRefreshToken");
    }

    const storedRefreshToken = storedTokenData.token;

    const basicAuth = Buffer.from(
      `${process.env.BFF_CLIENT_ID}:${process.env.BFF_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: storedRefreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Refresh token error response:", response.status, text.substring(0, 200));
      throw new Error("RefreshAccessTokenError");
    }

    const refreshedTokens = await response.json();

    if (refreshedTokens.refresh_token) {
      await TokenRepository.saveRefreshToken(token.sub, refreshedTokens.refresh_token);
    }

    // Update last activity when token is refreshed
    await TokenRepository.updateLastActivity(token.sub);

    // Sync sessionExpiresAt from database to ensure consistency
    const updatedTokenData = await TokenRepository.getRefreshToken(token.sub);
    const sessionExpiresAt = updatedTokenData?.sessionExpiresAt || token.sessionExpiresAt;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + ((refreshedTokens.expires_in || 300) * 1000),
      idToken: refreshedTokens.id_token || token.idToken,
      lastActivityAt: Date.now(),
      sessionExpiresAt: sessionExpiresAt // Sync from database
    };
  } catch (error) {
    console.error("RefreshAccessTokenError", error);
    await TokenRepository.deleteRefreshToken(token.sub);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    {
      id: "exam-oidc",
      name: "Exam Platform Identity",
      type: "oauth",
      wellKnown: undefined,
      authorization: {
        url: `${process.env.AUTH_SERVER_EXTERNAL_URL || "http://localhost:9000"}/oauth2/authorize`,
        params: {
          scope: "openid profile exam.read exam.write offline_access",
        }
      },
      token: {
        url: process.env.AUTH_SERVER_TOKEN_URL || "http://localhost:9000/oauth2/token",
      },
      userinfo: {
        url: process.env.AUTH_SERVER_USERINFO_URL || "http://localhost:9000/userinfo"
      },
      jwks_endpoint: `${process.env.AUTH_SERVER_URL || "http://localhost:9000"}/oauth2/jwks`,
      idToken: true,
      checks: ["pkce", "state"],
      clientId: process.env.BFF_CLIENT_ID,
      clientSecret: process.env.BFF_CLIENT_SECRET,
      client: {
        token_endpoint_auth_method: "client_secret_basic",
      },
      issuer: process.env.AUTH_SERVER_ISSUER || "http://localhost:9000",
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.preferred_username || profile.name,
          email: profile.email,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        console.log("[JWT Callback] Initial Sign In");

        const expiresInSeconds = account.expires_in || 300;
        const expiresAt = Date.now() + (expiresInSeconds * 1000);

        if (account.refresh_token) {
          await TokenRepository.saveRefreshToken(user.id, account.refresh_token);
        }

        // Extract roles from id_token
        let roles = [];
        if (account.id_token) {
          try {
            const payload = JSON.parse(Buffer.from(account.id_token.split('.')[1], 'base64').toString());
            roles = payload.authorities || payload.roles || [];
            console.log("[JWT Callback] Extracted roles from id_token:", roles);
          } catch (e) {
            console.error("[JWT Callback] Failed to parse id_token:", e);
          }
        }

        return {
          accessToken: account.access_token,
          accessTokenExpires: expiresAt,
          idToken: account.id_token,
          user,
          sub: user.id,
          roles: roles,
          lastActivityAt: Date.now(),
          sessionExpiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
        };
      }

      const now = Date.now();
      const BUFFER_TIME = 60 * 1000;

      // Check session timeout (idle timeout and absolute timeout)
      const sessionCheck = await TokenRepository.checkSessionTimeout(token.sub);
      if (!sessionCheck.valid) {
        console.log(`[JWT Callback] Session timeout: ${sessionCheck.reason}`);
        await TokenRepository.deleteRefreshToken(token.sub);
        return { ...token, error: sessionCheck.reason === 'IdleTimeout' ? 'IdleTimeout' : sessionCheck.reason === 'SessionExpired' ? 'SessionExpired' : 'SessionInvalidated' };
      }

      // Update last activity on every request
      await TokenRepository.updateLastActivity(token.sub);
      token.lastActivityAt = now;

      // Sync sessionExpiresAt from database to ensure JWT token has latest value
      const storedTokenData = await TokenRepository.getRefreshToken(token.sub);
      if (storedTokenData?.sessionExpiresAt) {
        token.sessionExpiresAt = storedTokenData.sessionExpiresAt;
      }

      // Check if access token needs refresh
      if (now < token.accessTokenExpires - BUFFER_TIME) {
        return token;
      }

      console.log("[JWT Callback] Token expired or expiring soon, refreshing...");

      // Reuse storedTokenData from above - no need to fetch again
      if (!storedTokenData || !storedTokenData.token) {
        console.log("[JWT Callback] No refresh token in database - Session Invalidated");

        return { ...token, error: "SessionInvalidated" };
      }

      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.user.id = token.sub;

      // Get roles from token (extracted from id_token during sign in)
      session.user.roles = token.roles || token.user?.roles || token.user?.authorities || [];

      console.log("[Session Callback] User:", token.sub, "Roles:", session.user.roles);

      if (token.error) {
        session.error = token.error;
      }

      return session;
    },
    async signOut({ token }) {
      if (token?.sub) {
        try {
          await TokenRepository.deleteRefreshToken(token.sub);
        } catch (error) {
          console.error(`[SignOut] Error revoking refresh token:`, error);
        }
      }
    },

    async redirect({ url, baseUrl }) {
      const authServerIssuer = process.env.AUTH_SERVER_ISSUER || "http://localhost:9000";
      const frontendUrl = process.env.REACT_CLIENT_URL || "http://localhost:5173";
      if (url.startsWith(authServerIssuer)) {
        return url;
      }
      if (url.startsWith("/")) {
        return new URL(url, baseUrl).toString();
      }

      if (url.startsWith(frontendUrl)) {
        return url;
      }

      return baseUrl;
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.BFF_SESSION_COOKIE || `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};