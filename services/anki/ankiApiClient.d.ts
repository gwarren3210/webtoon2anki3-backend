import { TranslatedWordInfo } from '../types';
/**
 * Sends TranslatedWordInfo to the Anki builder microservice and receives the .apkg file.
 *
 * @param translatedWordInfos - An array of TranslatedWordInfo objects.
 * @returns A Promise that resolves with the byte content of the .apkg file.
 * @throws Error if the API call fails.
 */
export declare function buildAndDownloadAnkiPackage(translatedWordInfos: TranslatedWordInfo[]): Promise<ArrayBuffer>;
