---
trigger: always_on
---

RULE: PROJECT ARCHITECTURE & STACK AWARENESS
PRIORITY: CRITICAL
Protocol: "Audit Before Action"
Before generating any code or advice, you MUST perform a Context Audit of the current project state:

Dependency Check:

Look for package.json (React), pom.xml (Spring Boot), or requirements.txt (Python).

CONSTRAINT: Only use libraries that are ALREADY listed in these files.

If a new library is absolutely needed, explicitly ask user for permission to add it.

Structure Analysis:

Analyze the file tree. Is this a Monorepo? Microservices? MVC? Clean Architecture?

CONSTRAINT: Place new files in the correct directory based on existing patterns (e.g., if DTOs are in /model/dto, do not put them in /domain).

Tech Stack Strictness:

If the project uses TypeScript, DO NOT output JavaScript.

If the project uses Tailwind, DO NOT output inline CSS or styled-components.

If the project uses Pytest, DO NOT write Unittest code.

System-Specific Stack Audit (WebRTC/Full-Stack)
Because this project contains three distinct environments, you must verify where you are operating before outputting code:

Zone 1: The Client (React/NextJS)

Check: package.json.

Allowed: Browser APIs (navigator.mediaDevices), WebRTC APIs (RTCPeerConnection), React Hooks.

Forbidden: Server-side logic, Java classes, Python scripts, accessing the database directly.

Zone 2: The Intermediary (Spring Boot)

Check: pom.xml / build.gradle.

Allowed: Java/Kotlin, Spring MVC, WebSockets (@Controller), REST endpoints.

Forbidden: Media Processing Libraries (OpenCV, FFmpeg wrappers). Reason: Spring Boot is Signaling ONLY.

Zone 3: The AI/Media Logic (Python)

Check: requirements.txt.

Allowed: OpenCV, PyTorch, Media processing logic.

Forbidden: Handling HTTP WebRTC signaling (unless wrapping a specific media server API).

Trigger
Applied automatically to every request involving code generation or refactoring.