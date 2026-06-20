import type { Config } from 'jest';

const config: Config = {
  // Folosim ts-jest pentru transpilare TypeScript
  preset: 'ts-jest',

  // Mediu Node (nu browser) — agenții rulează server-side
  testEnvironment: 'node',

  // Rădăcina testelor
  roots: ['<rootDir>/__tests__'],

  // Pattern pentru fișierele de test
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],

  // Mapare module — echivalent cu paths din tsconfig (@/* → ./*)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Configurare ts-jest: folosește tsconfig dedicat pentru Jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },

  // Ignoră node_modules și .next
  transformIgnorePatterns: ['/node_modules/', '/.next/'],

  // Coverage
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
  ],

  // Afișaj verbose
  verbose: true,
};

export default config;
