// Handler for the Anki package creation process.
// This file orchestrates the call to the Anki builder microservice.

import { TranslatedWordInfo } from '../types';
import { buildAndDownloadAnkiPackage } from './ankiApiClient';

interface AnkiConfig {
  front_fields: string[];
  back_fields: string[];
  create_duplicate: boolean;
}

/**
 * Handles the process of building and retrieving an Anki package.
 *
 * @param translatedWordInfos - An array of TranslatedWordInfo objects.
 * @param config - Configuration for card generation.
 * @returns A Promise that resolves with the byte content of the .apkg file.
 * @throws Error if the process fails at any step.
 */
export async function handleAnkiPackageCreation(
  translatedWordInfos: TranslatedWordInfo[],
  config: AnkiConfig
): Promise<ArrayBuffer> {
  if (!translatedWordInfos || translatedWordInfos.length === 0) {
    console.warn('No TranslatedWordInfo provided to handleAnkiPackageCreation.');
    // Depending on requirements, you might return an empty ArrayBuffer, null, or throw an error
    return new ArrayBuffer(0);
  }

  try {
    console.log(`Attempting to build Anki package for ${translatedWordInfos.length} words...`);
    const apkgBytes = await buildAndDownloadAnkiPackage(translatedWordInfos, config);
    console.log(`Successfully built Anki package with ${apkgBytes.byteLength} bytes.`);
    return apkgBytes;

  } catch (error) {
    console.error('Error in handleAnkiPackageCreation:', error);
    throw new Error('Failed to handle Anki package creation process.');
  }
}

// Example Usage (this function would be called from your simple main backend app):
/*
async function triggerAnkiCreation(data: TranslatedWordInfo[]) {
  try {
    const ankiPackage = await handleAnkiPackageCreation(data);
    // Now you have the ankiPackage (ArrayBuffer) - you can save it, send it to frontend, etc.
    console.log('Received final Anki package data.');
    // Example: Save to a file (Node.js fs module)
    // import * as fs from 'fs';
    // fs.writeFileSync('./final_anki_package.apkg', Buffer.from(ankiPackage));
    // console.log('Anki package saved locally.');

  } catch (error) {
    console.error('Failed to trigger Anki creation process:', error);
  }
}

// To use from your main backend:
// import { handleAnkiPackageCreation } from './services/anki/ankiPackageHandler';
// const translatedData = [...]; // Your array of TranslatedWordInfo
// triggerAnkiCreation(translatedData);
*/ 