# Validation Service

This service provides file validation logic and an Encore.ts API endpoint for validating uploaded image files (type and size). It is used to ensure only supported image formats and sizes are accepted before further processing or storage.

- Exports: `validateImageFile` (logic)
- Supported types: PNG, JPG, JPEG, WEBP
- Max size: 10MB
- Error handling: Returns clear error messages for invalid files and unexpected errors.

## Testing

- All validation logic is covered by colocated unit tests in `fileValidationService.test.ts`.
- Tests are run and must pass before any changes are considered complete. 