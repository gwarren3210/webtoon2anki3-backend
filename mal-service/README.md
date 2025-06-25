# MAL Service

This service provides integration with the MyAnimeList (MAL) API to fetch and store missing anime/manga series metadata in the local database. It is called automatically when a series is not found in the database, and inserts all relevant MAL metadata for future lookups.

## Features
- Fetches all available metadata for anime/manga series from MAL using only the title as input.
- Handles ambiguous or missing results with clear status codes and messages.
- Stores all MAL metadata in the `mal_series` table, using a system-generated UUID as the primary key.
- Logs all actions using Encore's logging system.

## Endpoint
- **POST** `/mal-service/add-series`
  - **Input:** `{ title: string, type: "anime" | "manga" }`
  - **Output:** `{ status: "inserted" | "ambiguous" | "not_found" | "skipped", message: string, malId?: number, uuid?: string }`

## Directory Structure
- `malService.ts` - Main endpoint and logic
- `types.ts` - TypeScript interfaces for MAL data
- `migrations/` - Database migration files
- `encore.service.ts` - Service registration

## Usage
This service is intended to be called by other backend services when a series is missing from the local database. It ensures the database is always up-to-date with the latest MAL metadata. 