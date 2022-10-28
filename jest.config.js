const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig.json");

// Sets timezone to be UTC so all tests pass no matter the dev's location
process.env.TZ = 'UTC';

module.exports = {
	"testEnvironment": "node",
	"testTimeout": 10000,
	"setupFilesAfterEnv": [
		"<rootDir>/test/setup/setup.ts"
	],
	"snapshotResolver": "<rootDir>/test/snapshots/snapshot-resolver.ts",
	"transform": {
		"^.+\\.tsx?$": "ts-jest"
	},
	"moduleFileExtensions": [
		"ts",
		"tsx",
		"js",
		"jsx",
		"json",
		"node"
	],
	"testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
	"coverageDirectory": "coverage",
	"collectCoverageFrom": [
		"src/**/*.{ts,tsx}",
		"!src/**/*.d.ts"
	],
	"maxConcurrency": 1,
	"maxWorkers": 1,
	moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' } ),
};
