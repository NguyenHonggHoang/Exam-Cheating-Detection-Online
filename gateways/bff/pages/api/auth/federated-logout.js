import { getToken } from "next-auth/jwt";

export default async function federatedLogout(req, res) {
  const cookieName = process.env.BFF_SESSION_COOKIE || "next-auth.session-token";
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET,
    cookieName 
  });

  if (!token) {
    console.warn("[Federated Logout] No session found, redirecting to home");
    return res.status(200).json({ url: process.env.REACT_CLIENT_URL || "http://localhost:5173" });
  }

  if (!token.idToken) {
    console.warn("[Federated Logout] No ID Token found in session");
    return res.status(200).json({ url: process.env.REACT_CLIENT_URL || "http://localhost:5173" });
  }

  const authServerUrl = process.env.AUTH_SERVER_EXTERNAL_URL || "http://localhost:9000";
  const postLogoutRedirectUri = process.env.REACT_CLIENT_URL || "http://localhost:5173";
  
  const url = `${authServerUrl}/connect/logout?` +
    `id_token_hint=${token.idToken}&` +
    `post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;

  console.log("[Federated Logout] Generated OIDC Logout URL");

  return res.status(200).json({ url });
}