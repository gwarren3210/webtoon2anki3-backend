/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
   preset: 'ts-jest',
   testEnvironment: 'node',
   testMatch: ["**/services/ocr-api/test/**/*.test.ts"],
 };