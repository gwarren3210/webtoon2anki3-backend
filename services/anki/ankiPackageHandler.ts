// Handler for the Anki package creation process.
// This file orchestrates the call to the Anki builder microservice.

import { TranslatedWordInfo } from '../types';
import { buildAndDownloadAnkiPackage } from './ankiApiClient';
import log from 'encore.dev/log';

interface AnkiConfig {
  front_fields: string[];
  back_fields: string[];
  create_duplicate: boolean;
}

/**
 * Handles the creation of Anki packages from translated word information.
 * 
 * @param translatedWordInfos - Array of translated word information
 * @param config - Configuration for Anki card generation
 * @returns Promise resolving to the Anki package as ArrayBuffer
 */
export async function createAnkiPackage(
  translatedWordInfos: TranslatedWordInfo[],
  config: AnkiConfig
): Promise<ArrayBuffer> {
  log.info('Creating Anki package', {
    wordCount: translatedWordInfos.length,
    config
  });

  try {
    const ankiPackage = await buildAndDownloadAnkiPackage(translatedWordInfos, config);
    log.info('Successfully created Anki package', {
      packageSize: ankiPackage.byteLength
    });
    return ankiPackage;
  } catch (error) {
    log.error('Failed to create Anki package', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
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