---
trigger: model_decision
description: webRTC test
---

Here is the new rule regarding WebRTC Testing Strategy, specifically tailored to your architecture and context.

RULE: WEBRTC TESTING STRATEGY & MOCKING
PRIORITY: HIGH
TRIGGER: Requests to "Write tests", "Debug logic", "QA", or "CI/CD setup".
Core Philosophy: "Mock the Transport, Verify the State"
Since real-time media (camera/mic) cannot be easily tested in standard CI/CD environments, you must decouple State Logic from Media Transport.

Testing Layers by Component
Zone 1: React Client (State & Hooks)

Unit Tests (Jest/Vitest):

NEVER attempt to call real navigator.mediaDevices.getUserMedia. It will fail in CI.

MUST mock RTCPeerConnection and its event handlers (onicecandidate, ontrack).

Focus: Verify the State Machine transitions defined in [Section 4.1].

Test Case Example: "When PROCESS_OFFER happens, does the state move to CREATE_ANSWER?"

Integration Tests (Playwright/Cypress):

Use browser flags: --use-fake-device-for-media-stream and --use-fake-ui-for-media-stream.

Verify that the video element exists and has readyState === 4 (HAVE_ENOUGH_DATA).

Zone 2: Spring Boot Intermediary (Signaling)

Controller Tests (@WebMvcTest):

Verify that POST /offer correctly receives JSON and relays it to the mocked Media Server service.

Constraint: Do not test RTP throughput here. Spring Boot does not touch media.

WebSocket Tests:

Test the Session Management: Does a disconnect event clear the clientSessionId map?

Zone 3: Media Server & AI (Python)

Logic Tests:

Do not test with live streams.

Input: A static .mp4 or .wav file.

Output: Verify the processed tensor or file matches expected dimensions/content.

Mandatory Mocking Templates
When generating test code, you must provide these standard mocks to prevent environment crashes:

React Mock (Setup)
JavaScript

// Global Mock for RTCPeerConnection
global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
  createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
  setLocalDescription: jest.fn().mockResolvedValue(),
  setRemoteDescription: jest.fn().mockResolvedValue(),
  addTrack: jest.fn(),
  close: jest.fn(),
  onicecandidate: null, // User fills this
}));
Anti-Patterns (What to Reject)
❌ Testing Video Quality in Unit Tests: Do not write assertions checking for pixel clarity or audio sync in Jest/JUnit. This is a manual or specialized E2E task.

❌ Testing Spring Boot Media Latency: Reject requests to measure "video latency" inside Spring Boot tests. It implies a misunderstanding of [Rule 6] (Spring Boot is signaling only).

❌ Hardcoded IP Addresses: Never use real IP addresses in test SDPs. Use 127.0.0.1 or 0.0.0.0.

Output Verification
Before outputting test code, ask:

"Does this test require a physical camera?" -> If YES, rewrite it to use a Mock or Fake UI flag.

"Am I testing the Signaling Flow or the Media Flow?" -> Ensure the tools match (JUnit for Signaling, Browser/Python for Media).