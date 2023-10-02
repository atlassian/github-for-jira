import { getTargetScript, validateScriptLocally, runDbMigration, DBMigrationType } from "./db-migration-utils";
import fs from "fs";
import { Request } from "express";
import { exec } from "child_process";

jest.mock("fs", () => ({ promises: { readdir: jest.fn() } }));
jest.mock("child_process");

const MIGRATION_SCRIPT_FIRST = "20220101000000-first-script.js";
const MIGRATION_SCRIPT_LAST = "20220101000001-second-script.js";

const DB_MIGRATION_CLI_UP = "./node_modules/.bin/sequelize db:migrate --env test";
const DB_MIGRATION_CLI_DOWN = (targetScript: string) => `./node_modules/.bin/sequelize db:migrate:undo:all --to ${targetScript} --env test`;

describe("DB migration utils", () => {
	describe("getTargetScript", () => {
		it("should return correct target script", () => {
			const script = getTargetScript({
				body: {
					targetScript: "some-script.js"
				}
			} as Request);
			expect(script).toBe("some-script.js");
		});
	});
	it("should 400 error when script is missing", () => {
		expect(() => {
			getTargetScript({
				body: {}
			} as Request);
		}).toThrowError(expect.objectContaining({
			statusCode: 400
		}));
	});
	describe("validateScriptLocally", () => {
		beforeEach(() => {
			jest.mocked(fs.promises.readdir as (arg0: string) => Promise<string[]>)
				.mockImplementation(async (path) => {
					if ((path).includes("db/migrations")) {
						return [MIGRATION_SCRIPT_FIRST, MIGRATION_SCRIPT_LAST];
					} else {
						throw new Error("shouldn't come to this line");
					}
				});
		});
		it("should pass test when it is last script is local db folder", async () => {
			await expect(validateScriptLocally(MIGRATION_SCRIPT_LAST))
				.resolves.not.toThrow();
		});
		it("should throw error when it is not last script is db folder", async () => {
			let err: Error | null = null;
			try {
				await validateScriptLocally(MIGRATION_SCRIPT_FIRST);
			} catch (e: unknown) {err = e  as Error;}
			expect(err).toEqual(expect.objectContaining({
				statusCode: 400
			}));
		});
	});
	describe("runDbMigration", () => {
		beforeEach(() => {
			jest.mocked(exec).mockImplementation((_path, _opts, cb: any) => {
				cb(undefined, "success", "");
				return { stdout: "success", stderr: "" } as any;
			});
		});
		it("should migrate db up and success", async () => {
			await runDbMigration(MIGRATION_SCRIPT_LAST, DBMigrationType.UP);
			expect(exec).toBeCalledWith(DB_MIGRATION_CLI_UP, expect.anything(), expect.anything());
		});
		it("should migrate db down", async () => {
			await runDbMigration(MIGRATION_SCRIPT_LAST, DBMigrationType.DOWN);
			expect(exec).toBeCalledWith(DB_MIGRATION_CLI_DOWN(MIGRATION_SCRIPT_LAST), expect.anything(), expect.anything());
		});
	});
});
