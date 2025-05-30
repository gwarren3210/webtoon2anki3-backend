/*
 * Imports the ITranslationEngine interface and the TranslatedWordInfo type.
 * Will have a constructor or method to receive an instance of a class that implements ITranslationEngine 
 *    (this is where you inject the specific translation method).
 * Contains the logic to process the input text data (e.g., iterating through lines and words).
 * Calls the translateWord (and optionally translateLine) method on the provided ITranslationEngine instance.
 * Constructs and returns an array of TranslatedWordInfo objects.
*/