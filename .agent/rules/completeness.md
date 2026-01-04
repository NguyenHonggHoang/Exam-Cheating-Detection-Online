---
trigger: always_on
---

RULE: FULL COMPLETENESS & NO OMISSION
PRIORITY: CRITICAL
Directives
No Placeholders: You are STRICTLY FORBIDDEN from using placeholders like:

// ... rest of the code

``

... (unchanged)

Full Context: Always output the FULL file content unless the file is extremely large (>500 lines). In that case, clearly mark the specific block with exact line numbers/context (e.g., // Replace lines 45-60 with:).

Production Ready: The code output must be ready to run/compile immediately. No pseudo-code unless explicitly asked.

Verification: Check if all imports, closing brackets, and necessary dependency injections are present.

Trigger
When user asks to "Fix code", "Refactor", or "Write a feature".

Context-Specific Completeness (WebRTC/Full-Stack)
In this architecture, "Completeness" implies Lifecycle Integrity:

The "Cleanup" Imperative:

Context: React/WebRTC.

Rule: A "complete" useEffect or hook MUST include the cleanup function.

Example: Never provide a getUserMedia block without the corresponding stream.getTracks().forEach(track => track.stop()) in the cleanup. Failing to do so locks the user's camera.

The "Protocol Pair" Rule:

Context: Spring Boot Signaling.

Rule: If you implement the logic for POST /offer, you MUST implicitly check or provide the logic for the POST /answer handling if the context implies a full handshake refactor. The protocol cannot exist with only one half.

DTO Transparency:

Context: Java/Spring Boot.

Rule: Never use generic Map<String, Object> or Object for critical signaling payloads unless strictly necessary for debugging. Always output the full DTO class (e.g., public class SdpOfferDto { ... }) so the data structure is explicit.

Output Example
Correction: I previously outputted the useWebRTC hook but omitted the cleanup function. Here is the FULL, corrected file including the peerConnection.close() logic to prevent memory leaks.

TypeScript

// ... (Full file content provided)