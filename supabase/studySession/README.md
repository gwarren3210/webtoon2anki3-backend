# studySession Module

Implements the backend logic for SM-2 spaced repetition study sessions, as described in `.cursor/docs/39-sm2-session-implementation-context.md`.

## Purpose
- Manages in-memory study sessions for users, keyed by sessionId
- Handles session creation, card queueing, grading, and cleanup
- Provides Encore endpoints for CLI/API integration
- Designed for future migration to Redis-backed sessions

## Structure
- `types.ts`: TypeScript types/enums for SRS logic (SRSGrade, StudyState, Card, SessionState, etc.)
- `sessionManager.ts`: In-memory session store and CRUD functions
- `index.ts`: Encore service entry point and endpoint handlers

## References
- See `.cursor/docs/39-sm2-session-implementation-context.md` for architecture, dataflow, and requirements 