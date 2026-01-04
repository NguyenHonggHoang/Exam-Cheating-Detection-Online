---
trigger: always_on
---

RULE: RELATIVE PATHS & FILE CONTEXT
PRIORITY: CRITICAL
Context
The Agent often loses track of where the current active file is located relative to the root, causing broken imports, or confuses distinct project roots (Frontend vs. Backend).

Directives
Relative Awareness: Always identify the full path of the file you are editing (e.g., src/features/auth/login.tsx vs src/main/java/com/app/controller/SignalController.java).

Import Validation:

When importing a module, verify if the path exists.

Prefer Absolute Imports (aliases like @/utils) if tsconfig.json or jsconfig.json is present.

If using relative imports, double-check the ../ depth.

Cross-Reference:

If the user asks to "connect A to B", read BOTH files first to understand their public interfaces (exports) before writing the glue code.

Do not assume a function name exists in another file without verifying.

Anti-Hallucination for Imports
❌ NEVER import from 'utils' if the folder is actually named utilities.

❌ NEVER invent named exports that are not in the source file.

Context-Specific Path Isolation (Project Architecture)
Because this is a full-stack project (React + Spring Boot + Python), you must strictly segregate file contexts:

Language Boundary Enforcement:

You cannot "import" a Java class into a React file.

Correct Action: Create a TypeScript interface that mirrors the structure of the Java DTO (Data Transfer Object).

Context: React Client vs Spring Boot Intermediary.

Directory Structure Awareness:

React/NextJS: Expect paths starting with src/app, src/components, or src/hooks.

Spring Boot: Expect paths starting with src/main/java/com/... or src/main/resources (for properties).

Python AI: Expect scripts/ or ai_module/.

API Contract alignment:

When "connecting" a React component to a Spring Boot Controller, do not look for a file import. Instead, verify the URL Path (e.g., verify React calls POST /webrtc/offer matches Spring Boot's @PostMapping("/webrtc/offer")).

Output Example
Context Check:

Current File: src/components/VideoRoom.tsx (React)

Target Reference: SignalController.java (Spring Boot)

Action: I cannot import the controller directly. I will implement a fetch('/webrtc/offer') call in the React file that matches the endpoint defined in SignalController.