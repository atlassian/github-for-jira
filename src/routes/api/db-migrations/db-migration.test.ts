import express from "express";
import { getFrontendApp } from "~/src/app";
import supertest, { Test } from "supertest";
import { startDBMigration, DBMigrationType, validateScriptLocally } from "./db-migration-utils";
import { sequelize } from "models/sequelize";
import { when } from "jest-when";

jest.mock("./db-migration-utils", ()=> ({
	...jest.requireActual("./db-migration-utils"),
	startDBMigration: jest.fn(),
	validateScriptLocally: jest.fn()
}));
jest.mock("models/sequelize", ()=>({
	...jest.requireActual("models/sequelize")
}));

const DB_MIGRATE_UP_URL = "/api/db-migration/up";
const DB_MIGRATE_DOWN_URL = "/api/db-migration/down";
const MIGRATION_SCRIPT_FIRST = "20220101000000-first-script.js";
const MIGRATION_SCRIPT_LAST = "20220101000001-second-script.js";

describe("DB migration", ()=>{
	let frontendApp;
	beforeEach(async ()=>{
		frontendApp = express();
		frontendApp.use(getFrontendApp({
			getSignedJsonWebToken: () => "",
			getInstallationAccessToken: async () => ""
		}));
	});
	describe("Param validation", ()=>{
		it("should fail when targetScript is missing in body", async ()=>{
			await triggerDBUp().expect(400);
		});
		it("should fail when the targetScript is a random script", async ()=>{
			when(jest.mocked(validateScriptLocally))
				.calledWith("some-random-script.js")
				.mockRejectedValue({ statusCode: 400 });
			await triggerDBUp("some-random-script.js").expect(400);
		});
		it("should fail when the targetScript is not the last script in db/migration folder", async ()=>{
			when(jest.mocked(validateScriptLocally))
				.calledWith(MIGRATION_SCRIPT_FIRST)
				.mockRejectedValue({ statusCode: 400 });
			await triggerDBUp(MIGRATION_SCRIPT_FIRST).expect(400);
		});
	});
	describe("DB mgiration up", ()=> {
		beforeEach(()=>{
			jest.mocked(validateScriptLocally).mockClear();
			jest.mocked(startDBMigration).mockClear();
		});
		it("should successfully migration db up to latest script", async ()=> {
			when(startDBMigration)
				.calledWith(MIGRATION_SCRIPT_LAST, DBMigrationType.UP)
				.mockResolvedValue({
					isSuccess: true,
					stdout: "success",
					stderr: ""
				});
			sequelize.query = jest.fn(async () => []);
			await triggerDBUp(MIGRATION_SCRIPT_LAST).expect(200);
		});
		it("should failed migration db up if target script is already in db", async () => {
			jest.mocked(startDBMigration).mockRejectedValue("Shouldn't call this");
			sequelize.query = jest.fn(async () => [MIGRATION_SCRIPT_LAST]);
			await triggerDBUp(MIGRATION_SCRIPT_LAST).expect(400);
			expect(startDBMigration).not.toBeCalled();
		});
	});
	describe("DB mgiration down", ()=> {
		beforeEach(()=>{
			jest.mocked(validateScriptLocally).mockClear();
			jest.mocked(startDBMigration).mockClear();
		});
		it("should successfully migration db down from latest script", async () => {
			sequelize.query = jest.fn(async () => [{
				name: MIGRATION_SCRIPT_LAST
			}]);
			when(startDBMigration)
				.calledWith(MIGRATION_SCRIPT_LAST, DBMigrationType.DOWN)
				.mockResolvedValue({
					isSuccess: true,
					stdout: "success",
					stderr: ""
				});
			await triggerDBDown(MIGRATION_SCRIPT_LAST).expect(200);
		});
		it("should fail migration db down if target script is not latest in db", async () => {
			jest.mocked(startDBMigration).mockRejectedValue("Shouldn't call this");
			sequelize.query = jest.fn(async () => [{
				name: MIGRATION_SCRIPT_FIRST
			}]);
			await triggerDBDown(MIGRATION_SCRIPT_LAST).expect(400);
			expect(startDBMigration).not.toBeCalled();
		});
	});
	const triggerDBUp = (targetScript?: string): Test => {
		return supertest(frontendApp)
			.post(DB_MIGRATE_UP_URL)
			.set("X-Slauth-Mechanism", "test")
			.set("content-type", "application/json")
			.send({
				targetScript
			});
	};
	const triggerDBDown = (targetScript?: string): Test => {
		return supertest(frontendApp)
			.post(DB_MIGRATE_DOWN_URL)
			.set("X-Slauth-Mechanism", "test")
			.set("content-type", "application/json")
			.send({
				targetScript
			});
	};
});
