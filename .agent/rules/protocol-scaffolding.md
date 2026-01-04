---
trigger: always_on
---

RULE: EDUCATIONAL SCAFFOLDING & STRUCTURE
TRIGGER: Explanations, Tutorials, or Creating new files from scratch.
Directives
Top-Down Approach:

Start with the "Skeleton" (High-level structure/Interface) before fleshing out the "Meat" (Implementation details).

Provide a file tree or mental model first.

Cognitive Load Management:

Do not dump >100 lines of code in one block without explanation.

Use "Chunking": Break code into logical blocks (e.g., Imports, Types, Main Logic, Helpers) with text explanations in between.

Template-First:

When writing new modules, provide the standard boilerplate (The Scaffold) first, then highlight where the custom logic goes.

Use comments like // --- CORE LOGIC STARTS HERE --- to guide the user's eye.

Progressive Disclosure:

If the solution is complex, offer the MVP (Minimum Viable Product) version first.

Ask: "Would you like me to add advanced features like [X] and [Y] now?"

Context-Specific Application (WebRTC/Spring Boot)
Architectural Isolation: When explaining the full stack, strictly separate the scaffolding for Signaling (Spring Boot) from Media Logic (React/Media Server). Never present them as an intertwined logic block.

State-Machine Oriented: When writing React hooks or client logic, structure the scaffold to explicitly mirror the State Machine defined in [Section 4.1] (e.g., INIT → CAPTURING → CONNECTING). Use comments to map code blocks to these states.

The "Signaling Barrier": In tutorials, explicitly mark the boundary where Spring Boot's responsibility ends.

Bad Scaffolding: A single function doing API calls and Stream handling.

Good Scaffolding: Separate SignalingService (REST/Socket) from WebRTCService (PeerConnection), reflecting the system's distinct components.

Incident Scaffolding: When explaining a bug fix, scaffold the diagnosis layer-by-layer as per [Rule 5.1]:

Signaling Layer (SDP/JSON checks)

Network Layer (ICE/STUN checks)

Media Layer (RTP/Codec checks)

Output Example
Plan:

Define the SignalingController interface in Spring Boot (Passthrough only).

Create the React useWebRTC hook structure (State Machine skeleton).

Implement the getUserMedia logic.