import { TokenRepository } from "./token-repository";

async function refreshAccessToken(token) {
  try {
    const url = process.env.AUTH_SERVER_TOKEN_URL || "http://localhost:9000/oauth2/token";
    const storedRefreshToken = await TokenRepository.getRefreshToken(token.sub);

    if (!storedRefreshToken) {
      console.error("No refresh token found server-side for user", token.sub);
      throw new Error("NoRefreshToken");
    }

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

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + ((refreshedTokens.expires_in || 300) * 1000),
      idToken: refreshedTokens.id_token || token.idToken
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
        url: "http://localhost:9000/oauth2/authorize",
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
      jwks_endpoint: "http://localhost:9000/oauth2/jwks",
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

        return {
          accessToken: account.access_token,
          accessTokenExpires: expiresAt,
          idToken: account.id_token,
          user,
          sub: user.id
        };
      }

      const now = Date.now();
      const BUFFER_TIME = 60 * 1000;

      if (now < token.accessTokenExpires - BUFFER_TIME) {
        return token;
      }

      console.log("[JWT Callback] Token expired or expiring soon, refreshing...");

      const storedRefreshToken = await TokenRepository.getRefreshToken(token.sub);
      if (!storedRefreshToken) {
        console.log("[JWT Callback] No refresh token in database - Session Invalidated");

        return { ...token, error: "SessionInvalidated" };
      }

      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.user = token.user;
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      session.error = token.error;
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
      if (url.startsWith(authServerIssuer)) {
        return url;
      }
      if (url.includes('/login')) {
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