import { processDialogue } from "./geminiService.js";
import { describe, expect, it, jest } from "@jest/globals";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// Mock the secret import
jest.mock("encore.dev/config", () => ({
  secret: (key: string) => {
    if (key === "GEMINI_API_KEY") {
      return process.env.GEMINI_KEY;
    }
    throw new Error(`Unknown secret key: ${key}`);
  },
}));

describe("Gemini Service", () => {
    const testDialoguePath = join(__dirname, "../test-data", "full-ocr.dialogue.txt");
    const outputPath = join(__dirname, "../test-data", "processed-words.json");

    it.only("should process dialogue and save words to JSON file", async () => {
        // Read the dialogue file
        const dialogue = readFileSync(testDialoguePath, "utf-8");
        
        // Process the dialogue
        const result = await processDialogue(dialogue);

        // Save the result to a JSON file
        writeFileSync(
         outputPath,
         JSON.stringify(result, null, 2),
         "utf-8" 
        );
        
        // Verify the response structure
        expect(result).toHaveProperty("words");
        expect(Array.isArray(result.words)).toBe(true);
        //expect(result.words.length).toBeGreaterThanOrEqual(20);
        //expect(result.words.length).toBeLessThanOrEqual(50);
        
        // Verify each word has both Korean and English
        result.words.forEach(word => {
            expect(word).toHaveProperty("korean");
            expect(word).toHaveProperty("english");
            expect(word).toHaveProperty("importanceScore");
            expect(typeof word.korean).toBe("string");
            expect(typeof word.english).toBe("string");
            expect(typeof word.importanceScore).toBe("number");
            expect(word.korean.length).toBeGreaterThan(0);
            expect(word.english.length).toBeGreaterThan(0);
            expect(word.importanceScore).toBeGreaterThanOrEqual(0);
            expect(word.importanceScore).toBeLessThanOrEqual(100);
        });

        // Verify the file was created
        expect(existsSync(outputPath)).toBe(true);

        // Read the file back and verify its contents
        const savedData = JSON.parse(readFileSync(outputPath, "utf-8"));
        expect(savedData).toEqual(result);
    }, 30000); // Increase timeout to 30 seconds

    /*it("should handle empty dialogue", async () => {
        await expect(processDialogue({ dialogue: "" })).rejects.toThrow();
    });

    it("should handle invalid dialogue", async () => {
        await expect(processDialogue({ dialogue: "!@#$%^&*()" })).rejects.toThrow();
    });*/

    it("should call gemini", async () => {
        const API_KEY = process.env.GEMINI_KEY;
        if (!API_KEY) {
            throw new Error("GEMINI_KEY environment variable is not set");
        }
        console.log("API KEY:", API_KEY);
        await callGeminiTextOnly('Tell me a short story about a brave knight.');
    }, 30*1000);
}); 

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Function to call Gemini API with a text-only prompt
async function callGeminiTextOnly(prompt: string) {
   try {
       const API_KEY = process.env.GEMINI_KEY;
       if (!API_KEY) {
           throw new Error("GEMINI_KEY environment variable is not set");
       }

       const response = await axios.post(
           `${BASE_URL}/gemini-2.0-flash:generateContent?key=${API_KEY}`,
           {
               contents: [
                   {
                       parts: [
                           {
                               text: prompt,
                           },
                       ],
                   },
               ],
           },
           {
               headers: {
                   'Content-Type': 'application/json',
               },
           }
       );

       console.log('Gemini Text-Only Response:');
       console.log(response.data.candidates[0].content.parts[0].text);
   } catch (error: any) {
       console.error('Error calling Gemini API (Text-Only):', error.response ? error.response.data : error.message);
   }
}
