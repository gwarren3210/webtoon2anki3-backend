import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
import { PapagoTranslateEngine } from '../services/translation/papagoTranslateEngine';

/**
 * Translates text from one language to another using the Papago translation engine.
 * @param request - The raw HTTP request containing text to translate and language settings
 * @param response - The HTTP response object
 * @returns JSON response with translated text
 * 
 * The endpoint expects a POST request with a JSON body containing:
 * - text: The text to translate
 * - sourceLang: Source language code (default: 'ko')
 * - targetLang: Target language code (default: 'en')
 * 
 * Example request body:
 * {
 *   "text": "안녕하세요",
 *   "sourceLang": "ko",
 *   "targetLang": "en"
 * }
 * 
 * The response will be a JSON object containing the translated text.
 */

export const translateEndpoint = api.raw(
  { expose: true, method: "POST", path: "/translate" },
  async (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text, sourceLang = 'ko', targetLang = 'en' } = JSON.parse(body);
        const translationEngine = new PapagoTranslateEngine(sourceLang, targetLang);
        const translatedText = await translationEngine.translateDeck(text);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(translatedText));
      } catch (error) {
        res.writeHead(500);
        res.end(`Translation failed: ${(error as Error).message}`);
      }
    });
  }
); 