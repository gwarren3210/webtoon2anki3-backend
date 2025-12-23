import { secret } from "encore.dev/config";
import axios from "axios";
import log from "encore.dev/log";
import { GoogleGenAI } from "@google/genai";
//import { writeFileSync } from "fs";
//import { join } from "path";

// Define the Gemini API key as a secret
const geminiApiKey = secret("GEMINI_API_KEY")();
// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
});
    
export interface Word {
    korean: string;
    english: string;
    importanceScore: number;
}

export interface WordResponse {
    words: Word[];
}

// Define the prompt template for word extraction
const WORD_EXTRACTION_PROMPT = `You are a Korean language expert. Given the following Korean dialogue, extract the 100 most relevant words in dictionary form and provide their English translations.

Guidelines for word selection:
1. Focus on words that are:
   - Important for understanding the context
   - Commonly used in Korean
   - Useful for language learners
   - Not too basic (e.g., avoid extremely common words like '이', '그', '저')
2. Include a mix of:
   - Nouns
   - Verbs (in dictionary form)
   - Adjectives (in dictionary form)
   - Important particles and conjunctions
3. Exclude:
   - Duplicate words
   - Extremely basic words
   - Onomatopoeia unless crucial to the context
   - Names unless they are important to the story

Return ONLY a JSON array of objects, where each object has:
- "korean": string, the Korean word in dictionary form
- "english": string, the English translation
- "importanceScore": number, how relevent the word is to the chapter, the story, and other factors. On a scale of least important 0-100 most important.

Example response format:
[
  { "korean": "헌터", "english": "hunter", "importanceScore": 60 },
  { "korean": "계급", "english": "rank/class", "importanceScore": 80 },
  { "korean": "협회", "english": "association", "importanceScore": 70 }
]

Dialogue:
`;

/**
 * Processes dialogue text to extract the most relevant 20-50 words in dictionary form with translations
 * @param dialogue The input dialogue text to process
 * @returns An array of words with their Korean and English forms
 * @example
 * // Input:
 * const request = {
 *   dialogue: "내 이름은 성진우. E급 헌터. 헌터협회 소속 중에서 제일 낮은 계급의 최약의 헌터."
 * };
 * 
 * // Output:
 * {
 *   words: [
 *     { "korean": "헌터", "english": "hunter" },
 *     { "korean": "계급", "english": "rank/class" },
 *     { "korean": "협회", "english": "association" },
 *     { "korean": "소속", "english": "affiliation" },
 *     { "korean": "최약", "english": "weakest" }
 *   ]
 * }
 */
/** 
 * curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Explain how AI works in a few words"
          }
        ]
      }
    ]
  }'
 */
export const processDialogue = async (dialogue: string): Promise<WordResponse> => {
    // Check API key before making request
    if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY secret is not set - run: encore secret set GEMINI_API_KEY --type dev");
    }

    // Check for empty dialogue
    if (!dialogue || dialogue.trim().length === 0) {
        throw new Error("Empty dialogue provided - nothing to process");
    }

    log.info(`Processing dialogue with ${dialogue.length} characters`);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [{
                    text: `${WORD_EXTRACTION_PROMPT}${dialogue}`
                }]
            }]
        });

        // Save the raw response for debugging
        //const responseDebugPath = join(__dirname, "../test-data", "gemini-response.txt");
        //writeFileSync(responseDebugPath, JSON.stringify(response.data, null, 2), "utf-8");

        if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error(`Invalid response format from Gemini API: ${JSON.stringify(response, null, 2)}`);
        }

        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text as string;
        
        // Clean up code block markers if present
        const cleanedText = text
            .replace(/^```json\s*/i, '') // Remove leading ```json (with optional whitespace)
            .replace(/^```\s*/i, '')     // Or just ```
            .replace(/```\s*$/i, '');    // Remove trailing ```
        
        // Save the extracted text for debugging
        //const textDebugPath = join(__dirname, "../test-data", "gemini-text.txt");
        //writeFileSync(textDebugPath, cleanedText, "utf-8");

        try {
            // Parse the cleaned response text as JSON
            const words = JSON.parse(cleanedText) as Word[];
            
            // Validate the parsed words
            if (!Array.isArray(words)) {
                throw new Error("Response is not an array");
            }

            words.forEach((word, index) => {
                if (!word.korean || !word.english) {
                    throw new Error(`Invalid word format at index ${index}`);
                }
            });

            return { words };
        } catch (parseError) {
            console.error("Error parsing JSON response:", parseError);
            console.error("Raw text:", cleanedText);
            throw new Error("Failed to parse Gemini API response as JSON");
        }
    } catch (error) {
        log.error("Error processing dialogue:", { error: error instanceof Error ? error.message : String(error) });
        
        if (axios.isAxiosError(error)) {
            const apiError = error.response?.data;
            log.error("Gemini API Error:", { apiError: JSON.stringify(apiError, null, 2) });
            
            // Check for common API errors
            if (error.response?.status === 400) {
                throw new Error(`Gemini API bad request: ${JSON.stringify(apiError?.error?.message || apiError)}`);
            }
            if (error.response?.status === 401 || error.response?.status === 403) {
                throw new Error("Gemini API authentication failed - check GEMINI_API_KEY");
            }
            if (error.response?.status === 429) {
                throw new Error("Gemini API rate limit exceeded");
            }
            
            throw new Error(`Gemini API error (${error.response?.status}): ${JSON.stringify(apiError?.error?.message || apiError)}`);
        }
        
        // Check if API key is missing
        if (!geminiApiKey) {
            throw new Error("GEMINI_API_KEY secret is not set");
        }
        
        throw new Error(`Failed to process dialogue: ${error instanceof Error ? error.message : String(error)}`);
    }
}; 