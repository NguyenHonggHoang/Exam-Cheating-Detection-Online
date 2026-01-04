---
trigger: always_on
---

RULE: META-PROMPTING & INTENT ANALYSIS
TRIGGER: Ambiguous inputs or high-level requests (e.g., "Build a login system", "Video isn't working").
Core Philosophy
"Understand what the user NEEDS, not just what they SAID."

Execution Steps
Before executing the task, run a Meta-Analysis:

Deconstruct the Prompt:

Identify the Core Goal.

Identify Implicit Constraints (e.g., if asking for React, imply functional components).

Identify Missing Information (Context).

Internal Re-Prompting:

Re-write the user's prompt for yourself to be explicit, detailed, and expert-level.

Example: User says "Fix this error." -> Internal Prompt: "Analyze the stack trace, identify the root cause in auth.ts, propose a fix that maintains backward compatibility, and explain why it happened."

Strategy Formulation:

Outline the steps you will take based on the Internal Prompt.

Explicitly state: "I interpret your request as [Detailed Definition]. Here is the plan..."

Constraint
If the user's prompt is too weak to Meta-Prompt safely, ask clarifying questions first.

Context-Specific Meta-Analysis (WebRTC Architecture)
When analyzing requests within this specific project context, apply these filters:

Disambiguate "The Server":

User: "The server isn't responding."

Meta-Analysis: Does they mean the Spring Boot Signaling Intermediary (HTTP 500 / WebSocket drop) or the Media Server (ICE failure / DTLS timeout)?

Action: Check context or ask: "Is this a signaling API failure or a media stream failure?"

Enforce Architectural Boundaries:

User: "Process the video stream in Spring Boot."

Meta-Analysis: This violates Rule 1.2 and Rule 6. The user likely means "Process the video in the Media Server" or "Handle the signaling for the stream in Spring Boot".

Internal Re-Prompt: "Explain that Spring Boot is signaling-only, then provide the code for the Media Server or the Client to handle the processing."

Map Symptoms to State Machine:

User: "I can't see the other peer."

Meta-Analysis: Map this to the State Machine.

Is the state stuck at WAIT_FOR_ANSWER? -> Signaling/Spring Boot issue.

Is the state stuck at CONNECTING? -> ICE/Network issue.

Is the state CONNECTED but black screen? -> Media/Codec issue.

Output Example
Interpretation: You asked to "fix the laggy stream." Based on the system context, I interpret this as a request to optimize the Media Server configuration or Client Bandwidth constraints, as Spring Boot (Signaling) does not touch the media stream.

Plan:

Check client-side constraints (bandwidth/resolution).

Verify Media Server encoding settings.

Ensure Spring Boot is not introducing latency in the initial signaling (though unlikely to cause stream lag).