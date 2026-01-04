---
trigger: always_on
---

RULE: CODE STYLE MIMICRY & CONSISTENCY
PRIORITY: HIGH
Core Directive: "Chameleon Mode"
You must adapt your coding style to match the existing codebase perfectly. Before writing code, read 1-2 related files in the same directory to learn the style.

Style Constraints to Observe:
Naming Conventions:

Variables: (camelCase vs snake_case?)

Components: (PascalCase vs kebab-case?)

Private methods: (Check for _underscore prefix).

Pattern Matching:

Error Handling: Do existing files use try/catch, Result types, or global error middleware? Follow that exact pattern.

Imports: Are imports absolute (@/components/Button) or relative (../../components/Button)? Use the existing convention.

Comments: Do not add excessive comments if the codebase is sparse. Do not add Docstrings unless the codebase uses them everywhere.

No "Best Practices" Override:

Even if you know a "better" way to write it, prioritize consistency with the current codebase unless explicitly asked to refactor.

Context-Specific Polyglot Adaptation
Because this project involves React (TS), Spring Boot (Java), and Python, you must switch "Style Modes" instantly based on the file type:

React/NextJS Mode:

Check: Are we using const arrow functions or function declarations?

Check: Are WebRTC objects (RTCPeerConnection) stored in useRef or state? Mimic the memory management pattern found in System Components 1.1.

Spring Boot Mode:

Check: Lombok (@Data) vs Manual Getters/Setters?

Check: Field Injection (@Autowired) vs Constructor Injection (Recommended)? Strictly follow the existing file's pattern.

Check: DTO naming (e.g., OfferRequest vs OfferDTO).

Python Mode:

Check: Type hinting presence?

Check: Docstring format (Google vs Sphinx).

Output Verification
"Does this code look like it was written by the same developer who wrote the rest of the project?" -> If No, rewrite it.