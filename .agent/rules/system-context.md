---
trigger: always_on
---

PROJECT ARCHITECTURE & CONTEXT RULES

PRIORITY: CRITICAL

COMPONENT: FULL-STACK (ReactJS - NextJS BFF - Spring Boot - Python AI)

1. System Components
1.1 ReactJS Client

Hosts WebRTC peer connection logic.

Captures video/audio stream from the user’s camera and microphone.

Generates WebRTC SDP offer.

Sends SDP offer to the Spring Boot intermediary over HTTPS (REST or WebSocket).

Handles ICE candidate generation and transmits ICE candidates to Spring Boot for relaying.

Applies SDP answer received from Spring Boot/Media Server.

Sends and receives WebRTC media packets directly with Media Server once negotiation is complete.

1.2 Spring Boot WebRTC Signaling Intermediary

Acts only as the signaling bridge between ReactJS Client and Media Server.

Does not process, decode, or store media.

Receives:

SDP Offer from React client.

ICE candidates from React client.

Relays:

SDP Offer → Media Server.

SDP Answer from Media Server → React client.

ICE candidates bidirectionally (React <-> Media Server).

Performs no media routing; transport is P2P (client ↔ media server).

Logs signaling events for incident tracing.

1.3 Media Server (SFU/MCU or custom WebRTC engine)

Accepts SDP offers relayed via Spring Boot.

Generates SDP answers.

Handles ICE negotiation with both sides via Spring Boot.

Manages incoming/outgoing real-time video/audio streams.

Provides media-level processing (e.g., mixing, forwarding, encoding, recording).

2. Workflow Rules

These rules define the full operational behavior expected by an incident-handling AI/agent.

2.1 Initial WebRTC Session Setup

React Client captures media (getUserMedia).

React creates a RTCPeerConnection.

React creates SDP Offer.

React sends the SDP Offer to Spring Boot:

POST /webrtc/offer

Payload: { offer, clientSessionId }.

Spring Boot forwards the SDP Offer to Media Server using its signaling API.

2.2 Media Server Negotiation

Media Server receives SDP Offer.

Media Server generates SDP Answer.

Media Server returns SDP Answer to Spring Boot.

Spring Boot relays SDP Answer back to the React Client.

2.3 ICE Candidate Exchange

React gathers ICE candidates via onicecandidate.

Each ICE candidate is sent to Spring Boot.

Spring Boot forwards each candidate to the Media Server.

Media Server sends its ICE candidates back through Spring Boot to the React Client.

Rule for agents:

ICE candidate flow must be strictly directional and consistent:

React → Spring Boot → Media Server

Media Server → Spring Boot → React

2.4 Direct Media Transmission

Once SDP + ICE negotiation is complete:

RTP media flows directly between React Client and Media Server.

Spring Boot exits the media path entirely.

Any media-level failure is between client and media server, not Spring Boot.

3. Incident Monitoring & Agent Interpretation Rules

These rules allow an AI or agent to diagnose errors, determine fault locations, and propose resolutions.

3.1 Connection Errors

If SDP Offer not acknowledged → issue likely in Spring Boot or Media Server signaling.

If SDP Answer missing or invalid → issue likely in Media Server.

If ICE candidates stop arriving:

If from client → browser/network issue.

If from media server → media server ICE agent issue.

If ICE fails to connect:

Check STUN/TURN availability.

Check NAT type.

Check firewall blocking UDP.

3.2 Media Errors

If SDP negotiation succeeded but no video stream:

Check codec compatibility.

Check bandwidth constraints.

Check if Media Server accepted incoming track.

3.3 Spring Boot Rules

Spring Boot must:

Never modify SDP (except if configured for SDP munging).

Never delay ICE relay.

Always maintain request tracking (sessionId).

Always log signaling events for incident resolution.

Violations mean:

Potential misrouting of SDP.

Corrupted negotiation.

Slow startup times or missing ICE candidates.

3.4 Media Server Rules

Must return SDP Answer within expected timeout.

Must provide ICE candidates unless using ICE-lite.

Must support codecs advertised by React client.

Must respond to reconnect requests gracefully.

4. State Machine (Formalized)
4.1 React Client
INIT → CAPTURING → CREATE_OFFER → SEND_OFFER → WAIT_FOR_ANSWER → APPLY_ANSWER → GATHER_ICE → CONNECTING → CONNECTED → STREAMING

4.2 Spring Boot Intermediary
RECEIVE_OFFER → FORWARD_OFFER → WAIT_FOR_ANSWER → SEND_ANSWER → RELAY_ICE

4.3 Media Server
RECEIVE_OFFER → PROCESS_OFFER → CREATE_ANSWER → RETURN_ANSWER → EXCHANGE_ICE → ESTABLISH_CONNECTION

5. Incident Response Rules for AI/Agent
5.1 Debugging Sequence

Validate signaling path (SDP Offer reached Media Server?).

Validate SDP Answer integrity.

Validate ICE candidate round trip.

Validate DTLS handshake success.

Validate RTP flow.

5.2 Rule of Origin

If SDP fails → signaling issue.

If ICE fails → network issue.

If media fails → media server or client device issue.

5.3 Required Metadata for Diagnosis

Agents must check:

Timestamps of offer/answer exchange.

ICE candidate counts.

Browser logs.

Media server logs.

STUN/TURN behavior.

Network conditions.

6. Non-negotiable Rules (for agent consistency)

Spring Boot is ONLY a signaling relay.
It must never be considered part of the media pipeline.

Client <-> Media Server media path must be direct.
Any deviation is considered a misconfiguration.

SDP and ICE flows must preserve direction and order.

No component may alter codec lists unless configured.

An incident must always identify which layer failed:

Signaling

ICE

DTLS

RTP

Rules must remain forward-compatible with multi-room and multi-stream architectures.