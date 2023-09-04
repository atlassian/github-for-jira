import { getFrontendApp } from "~/src/app";
import supertest, { Test } from "supertest";
import { runDbMigration, DBMigrationType, validateScriptLocally } from "./db-migration-utils";
import { sequelize } from "models/sequelize";
import { when } from "jest-when";

jest.mock("./db-migration-utils", ()=> ({
	...jest.requireActual("./db-migration-utils"),
	runDbMigration: jest.fn(),
	validateScriptLocally: jest.fn()
}));
jest.mock("models/sequelize", ()=>({
	...jest.requireActual("models/sequelize")
}));

const DB_MIGRATE_DOWN_URL = "/api/db-migration/down";
const MIGRATION_SCRIPT_FIRST = "20220101000000-first-script.js";
const MIGRATION_SCRIPT_LAST = "20220101000001-second-script.js";

describe("DB migration down", ()=>{
	let frontendApp;
	beforeEach(async ()=>{
		frontendApp = getFrontendApp();
	});
	describe("Param validation", ()=>{
		it("should fail when targetScript is missing in body", async ()=>{
			await triggerDBDown().expect(400);
		});
		it("should fail when the targetScript is a random script", async ()=>{
			when(jest.mocked(validateScriptLocally))
				.calledWith("some-random-script.js")
				.mockRejectedValue({ statusCode: 400 });
			await triggerDBDown("some-random-script.js").expect(400);
		});
		it("should fail when the targetScript is not the last script in db/migration folder", async ()=>{
			when(jest.mocked(validateScriptLocally))
				.calledWith(MIGRATION_SCRIPT_FIRST)
				.mockRejectedValue({ statusCode: 400 });
			await triggerDBDown(MIGRATION_SCRIPT_FIRST).expect(400);
		});
	});
	describe("DB mgiration down", ()=> {
		beforeEach(()=>{
			jest.mocked(validateScriptLocally).mockClear();
			jest.mocked(runDbMigration).mockClear();
		});
		it("should successfully migration db down from latest script", async () => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			sequelize.query = jest.fn(async () => [{
				name: MIGRATION_SCRIPT_LAST
			}]);
			when(runDbMigration)
				.calledWith(MIGRATION_SCRIPT_LAST, DBMigrationType.DOWN)
				.mockResolvedValue({
					isSuccess: true,
					stdout: "success",
					stderr: ""
				});
			await triggerDBDown(MIGRATION_SCRIPT_LAST).expect(200);
		});
		it("should fail migration db down if target script is not latest in db", async () => {
			jest.mocked(runDbMigration).mockRejectedValue("Shouldn't call this");
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			sequelize.query = jest.fn(async () => [{
				name: MIGRATION_SCRIPT_FIRST
			}]);
			await triggerDBDown(MIGRATION_SCRIPT_LAST).expect(400);
			expect(runDbMigration).not.toBeCalled();
		});
	});
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
