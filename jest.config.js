/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^encore\\.dev/config$': '<rootDir>/node_modules/encore.dev/dist/config/mod.js',
    '^encore\\.dev/api$': '<rootDir>/node_modules/encore.dev/dist/api/mod.js'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(encore.dev)/)'
  ],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
}; 