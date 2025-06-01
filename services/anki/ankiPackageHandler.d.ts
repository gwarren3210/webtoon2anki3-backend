import { TranslatedWordInfo } from '../types';
/**
 * Handles the process of building and retrieving an Anki package.
 *
 * @param translatedWordInfos - An array of TranslatedWordInfo objects.
 * @returns A Promise that resolves with the byte content of the .apkg file.
 * @throws Error if the process fails at any step.
 */
export declare function handleAnkiPackageCreation(translatedWordInfos: TranslatedWordInfo[]): Promise<ArrayBuffer>;
