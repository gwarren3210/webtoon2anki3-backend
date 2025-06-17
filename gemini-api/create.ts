import { processDialogue } from "../services/gemini-wrapper/geminiService";
import type { WordResponse } from "../services/gemini-wrapper/geminiService";
import { api } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import log from "encore.dev/log";

/**
 * Creates a list of Korean words with translations and importance scores from dialogue text
 * @param dialogue The Korean dialogue text to process
 * @returns Promise that resolves to the processed words
 */
export const createWordList = async (dialogue: string): Promise<WordResponse> => {
    try {
        // Process the dialogue using the Gemini service
        const result = await processDialogue(dialogue);
        
        return result;
    } catch (error) {
        log.error("Error creating word list:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
};

// Define request/response types
interface CreateWordListRequest {
    dialogue: string;
}

/**
 * Creates a list of Korean words with translations and importance scores from dialogue text.
 * 
 * This endpoint processes Korean dialogue text to extract important words, their translations,
 * and importance scores using the Gemini AI service.
 * 
 * @param req - The request object containing:
 *   - dialogue: The Korean dialogue text to process
 * @returns Promise<WordResponse> containing:
 *   - words: Array of {
 *     word: string;          // The Korean word
 *     translation: string;   // English translation
 *     importance: number;    // Importance score (0-100)
 *   }
 * 
 * Example request body:
 * {
 *   "dialogue": "안녕하세요. 저는 학생입니다."
 * }
 * 
 * Example response:
 * {
 *   "words": [
 *     {
 *       "word": "안녕하세요",
 *       "translation": "hello",
 *       "importance": 0.8
 *     },
 *     {
 *       "word": "학생",
 *       "translation": "student",
 *       "importance": 0.6
 *     }
 *   ]
 * }
 */
export const createWordListEndpoint = api(
    { 
        method: "POST",
        expose: true,
        path: "/create-word-list"
    },
    async (req: CreateWordListRequest): Promise<WordResponse> => {
        try {
            log.info("Received word list creation request", {
                dialogueLength: req.dialogue.length
            });

            if (!req.dialogue) {
                throw APIError.invalidArgument("dialogue is required");
            }

            const result = await createWordList(req.dialogue);
            
            log.info("Successfully created word list", {
                wordCount: result.words.length
            });

            return result;
        } catch (error) {
            log.error("Error in createWordListEndpoint:", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });

            if (error instanceof APIError) {
                throw error;
            }

            // Convert unknown errors to internal server error
            throw APIError.internal(
                "Failed to process dialogue",
                new Error(error instanceof Error ? error.message : String(error))
            );
        }
    }
);
