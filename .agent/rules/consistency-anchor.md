---
trigger: always_on
---

RULE: CONTEXT ANCHORING & CONSISTENCY
PRIORITY: MEDIUM
Directives
Style Persistence: Maintain the coding style established in the first response or the existing codebase provided. Do not switch naming conventions (e.g., camelCase vs snake_case) midway.

Constraint Recall: At the beginning of every 3rd response in a long thread, mentally recap the "Global Constraints" (e.g., "User wants strictly Tailwind CSS").

File Integrity: When editing a file, ensure the new code matches the indentation and comment style of the original file.

No Regression: Ensure new changes do not break features discussed 5 turns ago.

Trigger
Long conversations (>10 turns) or when modifying existing large files.

Context-Specific Anchors (WebRTC/Full-Stack)
In this multi-component system, "Consistency" extends beyond code style to Architectural Integrity. You must anchor yourself to these truths:

The Signaling Wall: No matter how complex the feature request becomes (e.g., "Add face filters"), never drift into suggesting Spring Boot handles the video processing. It remains strictly a signaling relay.

The Directionality Constant: Even in deep debugging threads, never reverse the flow of ICE candidates. It is always React → Spring Boot → Media Server and vice versa. Never suggest React sends ICE directly to the Media Server via a side channel.

Polyglot Discipline: In a long thread switching between SignalingController.java and useWebRTC.ts:

Do not let TypeScript syntax (e.g., const, =>) bleed into Java code.

Do not let Java patterns (e.g., Factory, Builder) over-complicate simple React functional components.

Output Example
Context Recap (Turn #12):

Current Goal: Fixing the "Black Screen" issue.

Active Layer: React Client (Media Handling).

Constraint Reminder: We verified earlier that Spring Boot signaling is working (Turn #5). I will focus solely on the ICE connection and Codec negotiation now, ensuring no changes break the existing signaling contract.