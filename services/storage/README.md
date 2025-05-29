# Storage Service

This service provides temporary file storage for uploaded files. It allows saving, reading, and deleting files in a temporary directory (`tmp/`).

- Location: `backend/services/storage`
- Exports: `saveTempFile`, `readTempFile`, `deleteTempFile`, `ensureTempDir`
- Error handling: All functions throw clear errors for failed file operations.
- All logic is covered by colocated unit tests in `tempStorageService.test.ts`. 