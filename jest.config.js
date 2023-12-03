const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig.json");

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
	"modulePathIgnorePatterns": ["<rootDir>/spa"],
	"testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
	"collectCoverage": true,
	"coverageDirectory": "coverage",
	"coverageThreshold": {
		"global": {
			"branches": 70,
			"functions": 85,
			"lines": 85,
			"statements": 85,
		}
	},
	"collectCoverageFrom": [
		"src/**/*.{ts,tsx}",
		"!src/**/*.d.ts",
		"!src/util/workers-health-monitor.ts"
	],
	"maxConcurrency": 1,
	"maxWorkers": 1,
	moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' } ),
};
