---
trigger: manual
---

1. SPEC-CLARITY & AMBIGUITY HANDLING RULES (UPGRADED)

(These extend your original rule set and do NOT overwrite existing rules.)

1.1. Ambiguity Detection Standard (Based on ISO 29148 + NASA SEH)

Rule
The agent must automatically detect ambiguity based on:

Ambiguous Input Indicators

Lack of concrete nouns (e.g., “do it,” "fix this")

Missing constraints (technology, environment, scale, security requirement)

Multiple valid interpretations

Vague verbs ("optimize", "improve", "rewrite", "build an API")

Missing actors (client? backend? microservice?)

Underspecified integration targets (e.g., "connect this service" without architecture)

Insufficient context (< 15 words or no domain-specific vocabulary)

If any indicator is true → trigger clarification mode.

Reason
Matches ISO & NASA guideline: “Requirements must be complete, unambiguous, and testable.”

1.2. Clarification Loop (Extended Version)

Rule
When ambiguity is detected, the agent must ask 3–5 clarifying questions, following this structure:

Scope question
“Which service, component, or subsystem does this apply to?”

Constraint question
“Are there any technology, framework, or security constraints?”

Integration question
“What is the target system this needs to connect or communicate with?”

Output format question
“What output format do you expect (code, spec, rules, diagram)?”

Assumption confirmation
“Should I assume microservices + BFF architecture unless specified otherwise?”

Reason
Clarification Step aligns with NASA’s “define before designing” principle.

1.3. Default Assumption Protocol (Only When Forced)

Rule
If user explicitly says:

“Do it now”

“Just answer”

“No need for more questions”

Then:

The agent must:

Clearly state assumptions at top of output.

Use conservative defaults:

Language: TypeScript for frontend / Java for backend

Architecture: React → BFF → Spring Boot → Microservices

Security: OIDC + JWT + JWKS

Environment: Containerized (Docker)

Example header:

[Assumptions Applied]
- Using Spring Boot 3 + Authorization Server for JWT issuing.
- Microservices validate tokens via JWKS.
- BFF uses Next.js 14 with server actions.
- WebRTC signaling runs through signaling-service.


Reason
Prevents hallucinated context and enforces deterministic behavior.

1.4. CO-STAR Alignment Framework (Expanded)

Rule
Agent must mentally run the CO-STAR decision model for every ambiguous prompt:

Context: What system environment is implied? (React + BFF + microservices?)

Objective: What is the exact deliverable?

Style: Architecture spec / code / rule / incident workflow?

Audience: DevOps? Backend? Frontend? Architect?

Response: Format? Markdown? Code? RFC-style?

If any dimension is missing → trigger clarification loop.

1.5. Disallowed Behaviors Under Spec-Clarity Compliance

The agent must NOT:

❌ Invent architecture not mentioned
❌ Make up libraries or technologies
❌ Jump directly into coding without constraints
❌ Produce production-ready code based on vague prompts
❌ Assume authentication mechanisms without explicit info
❌ Create APIs without knowing input/output models
❌ Change user’s existing rules

Reason
Ensures no accidental deviation from system design or misalignment with AS + BFF architecture.

1.6. Integration-Specific Ambiguity Handling (Microservices + JWT + WebRTC)

Rule
If prompt overlaps with any of these areas:

JWT / JWKS parsing

BFF token flow

WebRTC signaling

Service token (client_credentials)

Media Server integration

Incident root-cause analysis

→ Agent must ask for one extra precision question, for example:

For JWT:
“Is this for user token, service token, or WebRTC signaling token?”

For microservices:
“Should the communication use mTLS or internal service token?”

For WebRTC:
“Which signaling flow are you referring to: offer/answer, ICE, or DTLS?”

Ensures correct technical interpretation.

1.7. Safety Expansion for Spec Clarity

Rule
When ambiguity creates a potential for unsafe or incorrect system behavior, the agent must:

Stop and request clarification.

Warn the user about potential architectural risks (e.g., exposing tokens, bypassing BFF).

Suggest the minimal safe option while waiting for user input.

Example:

“The request is ambiguous and may lead to insecure token usage.
Please clarify whether this is for user JWT or internal service token.”

1.8. Incident-Ready Response Formatting

Rule
When responding to ambiguous technical architecture, output must be structured so it can be logged or inserted into an incident-management system:

Structure:

Summary

Ambiguity Detected

Clarifying Questions Needed

Current Assumptions (if any)

Blocked Until User Clarifies

Reason
Supports automated incident agents reading the spec.