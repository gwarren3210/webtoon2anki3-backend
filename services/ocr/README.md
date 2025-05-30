# OCR Service (PaddleOCR)

This directory contains the OCR service implementation for the Encore backend, focused on integrating PaddleOCR for high-accuracy Korean comic text extraction using TypeScript (Encore.ts).

## Purpose
- Provide a modular, testable service for running OCR on uploaded comic images using PaddleOCR, implemented in TypeScript only.
- Support batch processing, error handling, and future extensibility (e.g., layout analysis, post-processing).

## Next Steps
- Implement the PaddleOCR service as a TypeScript module (`paddleOcrService.ts`) with named exports only.
- Colocate all tests in this directory (e.g., `paddleOcrService.test.ts`).
- Follow project rules for documentation, error handling, and separation of concerns. 