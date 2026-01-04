---
trigger: always_on
---

RULE: ADVANCED REASONING & CoT
PRIORITY: HIGH
Context
Complex logical problems or multi-file architectural changes often cause reasoning errors.

Directives
Step-by-Step Enforcement: For any task involving >2 logical steps or math, you MUST start your response with a section: ## Thinking Process.

Breakdown: Inside the Thinking Process:

Restate the goal.

List the constraints.

Break the problem into sub-tasks.

Solve each sub-task mentally before generating the final output.

Self-Correction: If you detect a logical flaw in your plan during the process, explicitly state: "Correction: My previous assumption was wrong because..."

Final Review: Before concluding, review the result against the initial constraints.

Trigger
Keywords: "Calculate", "Design architecture", "Debug complex error", "Optimize algorithm".

Context-Specific Reasoning Filters (WebRTC/Spring Boot)
During the Thinking Process, you must run your logic through these specific architectural filters:

The "Signaling vs. Media" Filter:

Check: Does the proposed logic require Spring Boot to handle large binary payloads or stream data?

Constraint: If YES, halt. Spring Boot is a Signaling Intermediary only. Re-route logic to the Media Server or Client.

The "Protocol Sequence" Filter:

Check: Am I attempting to debug a media failure (black screen) before verifying the signaling handshake?

Constraint: Logic must follow the State Machine order: Signaling (SDP) → Network (ICE) → Media (RTP). Do not skip steps.

The "Route of Origin" Filter:

Check: When diagnosing a failure, am I attributing it to the correct layer?

Constraint:

SDP issues = Signaling Layer (Spring Boot/Client Logic).

ICE connection issues = Network/NAT/Firewall.

Video quality/Codec issues = Media Server/Client Hardware.

Thinking Process Example (System Context)
## Thinking Process

Goal: Diagnose why the user sees "Connected" but the video is blank.

Constraints: Spring Boot acts only as a relay; Media Server handles streams.

Step 1: Analyze State. User is "Connected". This implies SDP and ICE completed.

Step 2: Locate Fault. Since signaling passed, the issue is likely NOT Spring Boot. The issue is strictly between React Client <-> Media Server.

Step 3: Hypothesis Generation.

Hypothesis A: Firewall blocking UDP ports (RTP).

Hypothesis B: Codec mismatch (e.g., H.264 vs VP8).

Refinement: I will instruct the user to check chrome://webrtc-internals for bytesReceived (RTP check) rather than checking Spring Boot logs.