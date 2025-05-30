import { PapagoTranslateEngine } from "../papagoTranslateEngine";
import { ITranslationEngine } from "../translationEngine";
import { describe, it, expect, beforeAll } from '@jest/globals';

describe("PapagoTranslateEngine Integration Tests", () => {
  let papagoTranslateEngine: ITranslationEngine;

  const sourceLang = "ko";
  const targetLang = "en";

  // Initialize the engine before running tests
  beforeAll(() => {
    papagoTranslateEngine = new PapagoTranslateEngine(sourceLang, targetLang);
  });

  it("should translate a simple Korean word correctly", async () => {
    const koreanWord = "고양이"; // cat
    const expectedEnglish = "cat"; // Papago might return slightly different casing/phrasing

    const translatedWord = await papagoTranslateEngine.translateWord(koreanWord);

    // Use toContain or a similar flexible matcher if exact match is too brittle
    expect(translatedWord.toLowerCase()).toContain(expectedEnglish);
  });

  it("should translate another simple Korean word correctly", async () => {
    const koreanWord = "안녕하세요"; // Hello
    const expectedEnglish = "hello";

    const translatedWord = await papagoTranslateEngine.translateWord(koreanWord);

    expect(translatedWord.toLowerCase()).toContain(expectedEnglish);
  });

  it("should translate a simple Korean line correctly", async () => {
    const koreanLine = "저는 학생입니다."; // I am a student.
    const expectedEnglish = "i am a student.";

    const translatedLine = await papagoTranslateEngine.translateLine(koreanLine);

    expect(translatedLine.toLowerCase()).toContain(expectedEnglish);
  });

  // Add more tests with different words/phrases as needed
}); 