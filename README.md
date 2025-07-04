# Backend (Encore Services)

This directory contains the Encore-based TypeScript backend for Webtoon2Anki. All backend logic is organized into modular services, each with a single responsibility.

## Architecture

- **OCR Service:** Extracts text from webtoon images using OCR.
- **Text Grouper:** Groups OCR results into dialogue lines and speech bubbles.
- **Translation Service:** Translates extracted text to the target language.
- **Anki Service:** Generates Anki flashcard packages (`.apkg`).
- **Validation Service:** Validates uploaded files for type and size.
- **Storage Service:** Handles temporary file storage for uploads.
- **MAL Service:** (Optional) Integrates with MyAnimeList for metadata.

## Directory Structure

- `services/` — Main backend logic, organized by service
- `anki/`, `ocr-api/`, `text-grouper/`, `translation/`, `validation/`, `storage/`, `mal-service/` — Service subdirectories
- `test-data/` — Sample input/output for tests

## Developing Locally

1. Install [Encore](https://encore.dev/docs/ts/install) and Node.js.
2. Run the backend locally:
   ```bash
   encore run
   ```
   The local developer dashboard will be available at http://localhost:9400/

## Testing

Run all backend tests:
```bash
yarn test # or npm test
encore test
```

## Adding/Modifying Services
- Place new service code in its own subdirectory under `services/`.
- Follow project rules for separation of concerns and named exports.
- Document all functions longer than 3 lines with JSDoc comments.

## Deployment

Deploy to Encore's cloud or your own infrastructure as needed. See the main project README for details.

## Future Work

### Pipeline Service Refactoring

The current architecture separates image processing into multiple services (OCR, text grouping, translation, validation, storage). A future enhancement would be to consolidate these into a unified **Pipeline Service** that handles the complete flow from image upload to Anki deck generation.

**Benefits:**
- Reduced inter-service communication overhead
- Simplified error handling and rollback
- Better transaction management
- Improved performance through optimized data flow

**Proposed Structure:**

#### Directory
```
backend/services/pipeline/
```

#### Main Responsibilities
- Accept image uploads (file path or buffer)
- Validate image (type, size)
- Run OCR to extract text
- Group text into dialogue lines
- Translate dialogue to target language
- Generate Anki flashcards and `.apkg` package
- Handle errors and rollbacks at each stage
- Return the generated `.apkg` or error details

#### File Structure
```
pipeline/
  pipelineService.ts         # Main orchestration logic
  imageValidation.ts         # Image validation helpers
  ocrStage.ts                # OCR logic (can wrap existing OCR service)
  textGroupingStage.ts       # Text grouping logic
  translationStage.ts        # Translation logic
  ankiGenerationStage.ts     # Anki package generation
  types.ts                   # Pipeline-specific types/interfaces
  errors.ts                  # Custom error types for rollback/handling
  README.md                  # Service documentation
  pipeline.test.ts           # End-to-end and unit tests
```

#### Example: pipelineService.ts (Orchestration Only)
```ts
// Main orchestration function (no logic, just calls helpers)
export async function processImageToAnkiDeck(input: PipelineInput): Promise<PipelineResult> {
  const validated = await validateImage(input);
  const ocrResults = await runOcr(validated);
  const grouped = groupText(ocrResults);
  const translated = await translateText(grouped);
  const ankiPackage = await generateAnkiDeck(translated);
  return ankiPackage;
}
// Helper functions (each in their own file)
```

#### Pipeline Stages (Each as a Helper)
- **validateImage(input):** Checks file type/size, throws on error.
- **runOcr(validatedImage):** Calls OCR engine, returns text results.
- **groupText(ocrResults):** Groups text into dialogue lines.
- **translateText(groupedText):** Translates all lines to target language.
- **generateAnkiDeck(translatedText):** Creates `.apkg` file.

#### Error Handling
- Each stage throws a custom error on failure.
- The main pipeline function catches and logs errors, and can roll back temp files or partial results as needed.

#### Benefits
- **Single entrypoint** for the full image-to-Anki flow.
- **Easier to test** end-to-end and in isolation.
- **Centralized error handling** and rollback.
- **Extensible:** Add new stages (e.g., image enhancement, user feedback) as needed.
