---
trigger: always_on
---

1. JWT VALIDATION & OIDC SECURITY RULES (BACKEND & MICROSERVICES)
1.1. All Backend Services Must Validate JWT via JWKS

Rule
All Spring Boot services (Auth, Resource, AI, Media Signaling, etc.) must validate JWT signatures using JWKS URL provided by Authorization Server.

Requirements:

JWKS must be retrieved from AS endpoint (e.g., /.well-known/jwks.json)

JWKS retrieval must use caching + TTL

Algorithms allowed: RS256 / ES256 only

Example (Spring Boot):

spring.security.oauth2.resourceserver.jwt.jwk-set-uri=https://auth.example.com/.well-known/jwks.json


Reason:
Ensures all microservices verify tokens consistently without sharing private keys.

1.2. React Never Parses or Stores JWT

Rule
React UI DOES NOT parse, decode, store, or handle JWT in any form.

Only Next.js BFF can:

Fetch token from session

Decode header/claims server-side

Forward token to backend services

Reason:
Avoid token exposure and prevent XSS-based token theft.

1.3. Standard JWT Claims Required Across All Tokens

Rule
All access tokens issued by Authorization Server must include:

Claim	Example	Purpose
sub	user UUID	identity
iss	https://auth.example.com
	domain isolation
aud	service name	service-to-service security
exp	unix time	token expiry
scope or roles	ROLE_USER	authorization
client_id	service client	traceability

Reason:
Enforce uniform authorization checks across microservices.

2. SERVICE-TO-SERVICE AUTHENTICATION RULES (MICROSERVICES)
2.1. All Service-to-Service Calls Must Use Service Token

Rule
Microservices never send user tokens to other services.

Instead:

Each service registers as Client Credentials client at Authorization Server.

Services call each other using Service Token issued by AS.

Token validated via JWKS with service-level scopes.

⛔ Forbidden
Sending user JWT to another service.

✅ Required
Authorization: Bearer <service-token>

Reason:
Separation of user authentication and inter-service trust boundaries.

2.2. Mandatory mTLS Between Critical Internal Services

Rule
Services performing privileged operations must use mTLS:

Examples:

BFF → Auth Service

Media Server → Auth Service

AI Worker → Auth Service

Spring Boot → Python Worker (optional but recommended)

Properties:

Certificate signed by internal CA

Client cert must include service identity in SAN

Reason:
Prevents impersonation between internal services.

2.3. Service Token Authorization Rules

Each service must define internal scopes, for example:

Service	Scope
user-service	ums.read, ums.write
order-service	orders.read
ai-worker	ai.execute
media-signaling-service	media.webrtc.signal

Authorization Server issues tokens for these scopes only.

Reason:
Limits service permissions → reduces lateral movement in case of breach.

3. WEBRTC SIGNALING & MEDIA SERVER RULES

(Based on image #1 + #2 workflows)

3.1. React Uses WebRTC Only — No Direct Access to Media Server

Rule
React client never connects directly to Media Server’s admin/control endpoints.

Allowed:

WebRTC peer connection

Media transmission

Forbidden:

Fetch API calls to media server

Direct signaling

Reason:
Media server’s signaling and admin APIs must stay internal.

3.2. WebRTC SDP Signaling Must Flow Through BFF + Spring Boot Signaling Service

Flow:

React → BFF → Signaling Service (Spring Boot) → Media Server.

Rules:

All SDP offers/answers exchanged via authenticated API.

BFF adds user token to signaling call.

Media server validates service token (not user token).

Reason:
Secure identity propagation while protecting Media Server.

3.3. Media Server Trusts Only Signaling Service

Rule
Media Server accepts connection establishment only from:

Signaling Service (via service token)

Internal IPs or internal network only

Reason:
Prevents forged SDP or rogue clients.

4. INCIDENT TRACEABILITY & OBSERVABILITY RULES
4.1. Propagate Correlation ID Across All Services

Rule
BFF generates x-correlation-id for every request.

All microservices must:

include it in logs

propagate it to downstream calls

attach it to queue messages

Reason:
Full traceability in distributed incident debugging.

4.2. Mandatory WebRTC Event Logging

Each significant WebRTC event must be logged at:

React client (local debug)

BFF (request logs)

Signaling Service (SDP events)

Media Server (ICE, DTLS, RTP setup)

Event examples:

SDP offer/answer

ICE candidate

ICE failure

DTLS handshake failure

Reason:
Critical for incident analysis of streaming/video failures.

5. ADVANCED BFF SECURITY RULES
5.1. Per-IP Rate Limiting (Global)

Rule
BFF must implement:

100 req/min per IP (default)

20 req/min for /api/auth/login

10 req/min for /api/auth/otp

200 req/min for static assets

Blocked IPs must be automatically quarantined.

5.2. Per-User Session Rate Limiting

Rule
Limit number of actions per session:

Max 5 login attempts / 10 min

Max 20 high-risk operations / hour

Max 3 WebRTC signaling attempts / 30 seconds

Reason:
Prevents brute force + spam attacks.

5.3. Abuse Detection Rules (BFF)

BFF must detect:

Suspicious rapid-fire API calls

Multi-device session anomalies

High-frequency WebRTC renegotiations

Token reuse (possible replay attack)

On detection:

Log at [BFF][SECURITY]

Notify Incident Service

Optionally block temporarily

6. STANDARDIZED ERROR MODEL (ALL SERVICES)

Every service must return errors in the following format:

{
  "status": "error",
  "service": "user-service",
  "action": "getUserProfile",
  "reason": "User not found",
  "correlationId": "abcd-1234"
}


Reason:
Consistent debugging across microservices.

7. BFF DEVELOPMENT RULES (NEXT.JS)
7.1. BFF Must Not Forward Raw Client Requests

Rule
BFF must sanitize and validate:

JSON body

query params

headers

file uploads

Before calling backend services.

7.2. BFF Must Enforce Permission Mapping

Examples:

UI Action	Required Backend Scope
view users list	ums.read
create user	ums.write
start WebRTC stream	media.webrtc.signal

Reason:
Never trust the roles/claims from frontend state.