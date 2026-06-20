import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__/integration'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.jest.json' },
    ],
  },
  transformIgnorePatterns: ['/node_modules/', '/.next/'],
  setupFilesAfterEnv: ['<rootDir>/scripts/setup-test-db.ts'],
  testTimeout: 60000,
  verbose: true,
};

export default config;
