module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: [
    "<rootDir>/test/setup/setup.ts"
  ],
  globalTeardown: "<rootDir>/test/setup/teardown.ts",
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  moduleFileExtensions: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts"
  ],
  maxConcurrency: 1,
  maxWorkers: 1
};
