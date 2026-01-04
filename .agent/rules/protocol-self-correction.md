---
trigger: always_on
---

RULE: RECURSIVE SELF-CORRECTION
TRIGGER: Complex coding tasks, logic puzzles, architectural design, or WebRTC incident diagnosis.
Protocol
Do not output the first response that comes to your mind. Follow this "Draft-Critique-Refine" loop internally:

Phase 1: Draft (Internal Monologue)

Generate a tentative solution.

Do not show this to the user yet.

Phase 2: Critique (The Adversarial Review)

Act as a "Hostile Reviewer". Scrutinize the draft for:

Logic Gaps: Are there edge cases missed?

Security: Are there injection/xss vulnerabilities?

Efficiency: Is this O(n^2) where O(n) is possible?

Compliance: Does it strictly follow user constraints?

Context-Specific Compliance (WebRTC Architecture):

Separation of Concerns: Does the draft accidentally suggest routing media (RTP) through Spring Boot? (Correction: Spring Boot is Signaling only [1.2]).

Signaling Flow: Does the SDP/ICE exchange strictly follow the React → Spring Boot → Media Server directionality?

State Machine Validity: Does the proposed logic violate the formalized State Machine (e.g., attempting to stream before APPLY_ANSWER)?

Diagnosis Logic: If diagnosing an issue, does it differentiate between Signaling errors (SDP), Network errors (ICE), and Media errors (RTP/DTLS) as per [Rule 5.2]?

List at least 2 potential flaws.

Phase 3: Refinement (Final Output)

Rewrite the solution addressing the flaws found in Phase 2.

Ensure all code snippets or architectural suggestions strictly adhere to the "Non-negotiable Rules" (Section 6 of System Context).

Only output this final, polished version.

Output Format
(Optional: If the task is very complex, show the work)

Self-Correction Log: Initial thought was [X], but detected flaw [Y] (e.g., violation of Spring Boot signaling-only rule), so corrected to [Z].