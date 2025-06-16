import { processDialogue } from "../services/gemini-wrapper/geminiService";
import type { WordResponse } from "../services/gemini-wrapper/geminiService";
import { api } from "encore.dev/api";

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
        console.error("Error creating word list:", error);
        throw error;
    }
};

// Define request/response types
interface CreateWordListRequest {
    dialogue: string;
}

// Create the public API endpoint
export const createWordListEndpoint = api(
    { 
        method: "POST",
        expose: true,
        path: "/create-word-list"
    },
    async (req: CreateWordListRequest): Promise<WordResponse> => {
        return await createWordList(req.dialogue);
    }
);
