// Client to interact with the Anki builder microservice.

import axios from 'axios';
import { TranslatedWordInfo } from '../types';
import log from 'encore.dev/log';

// NOTE: Replace with the actual URL of your deployed Anki builder microservice
// For local testing, you can use http://localhost:8080
const ANKI_BUILDER_SERVICE_URL = 'https://anki-builder-530177289872.us-central1.run.app';

interface AnkiConfig {
  front_fields: string[];
  back_fields: string[];
  create_duplicate: boolean;
}

/**
 * Sends TranslatedWordInfo to the Anki builder microservice and receives the .apkg file.
 *
 * @param translatedWordInfos - An array of TranslatedWordInfo objects.
 * @param config - Configuration for card generation.
 * @returns A Promise that resolves with the byte content of the .apkg file.
 * @throws Error if the API call fails.
 */
export async function buildAndDownloadAnkiPackage(
  translatedWordInfos: TranslatedWordInfo[],
  config?: AnkiConfig
): Promise<ArrayBuffer> {
   log.info('Starting Anki package build', {
     wordCount: translatedWordInfos.length,
     config
   });

   // Filter to only include essential fields for Anki cards
   const filteredWordInfos = translatedWordInfos.map(({ originalWord, originalLine, translatedWord, translatedLine }) => ({
     originalWord,
     originalLine,
     translatedWord,
     translatedLine
   }));

   // Prepare request body with config
   const requestBody = {
     translated_word_infos: filteredWordInfos,
     config,
   };

   try {
    log.info('Sending request to Anki builder service', {
      url: `${ANKI_BUILDER_SERVICE_URL}/build-package`,
      requestBodySize: JSON.stringify(requestBody).length
    });

    const response = await axios.post(
      `${ANKI_BUILDER_SERVICE_URL}/build-package`,
      requestBody,
      {
        responseType: 'arraybuffer', // Important for receiving binary data (.apkg)
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    log.info('Successfully received response from Anki builder service', {
      responseSize: response.data.byteLength
    });

    // Axios response.data is an ArrayBuffer for responseType 'arraybuffer'
    return response.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      log.error('Error calling Anki builder service', {
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data?.toString(),
        requestBody: requestBody
      });
    } else {
      log.error('Unexpected error calling Anki builder service', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    throw new Error('Failed to build and download Anki package.');
  }
}

// Example Usage (you would call this function from another part of your backend):
/*
async function exampleUsage() {
  const sampleData: TranslatedWordInfo[] = [
    {
      originalWord: "안녕하세요",
      originalLine: "안녕하세요",
      translatedWord: "Hello",
      translatedLine: "Hello"
    },
    {
      originalWord: "감사합니다",
      originalLine: "정말 감사합니다!",
      translatedWord: "Thank you",
      translatedLine: "Thank you very much!"
    }
  ];

  try {
    const apkgBytes = await buildAndDownloadAnkiPackage(sampleData);
    console.log(`Successfully received Anki package with ${apkgBytes.byteLength} bytes.`);
    // You would typically save this ArrayBuffer to a file or send it to the frontend

    // Example of saving to a file (requires Node.js 'fs' module)
    // import * as fs from 'fs';
    // fs.writeFileSync('./output_anki_package.apkg', Buffer.from(apkgBytes));
    // console.log('Anki package saved to output_anki_package.apkg');

  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

// Call the example usage (for testing purposes)
// exampleUsage();
*/ 