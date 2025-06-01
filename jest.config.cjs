/** @type {import('ts-jest').JestConfigTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/services'], // Assuming tests are in the services directory
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
    "**/services/*/test/**/*.test.ts",
    '**\\services\\*\\test\\*.test.ts'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true }],
  },
   // Optional: if you have specific module paths to resolve
  moduleNameMapper: {
    '^~encore/(.*)$': '<rootDir>/encore.gen/$1',
  },
  // Add this to explicitly treat .ts and .tsx files as ESM
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
}; 