import express from "express";
import { getFrontendApp } from "~/src/app";
import supertest, { Test } from "supertest";
import { sequelize } from "models/sequelize";
import { QueryTypes } from "sequelize";

const DB_MIGRATE_UP_URL = "/api/db-migration/up";
const DB_MIGRATE_DOWN_URL = "/api/db-migration/down";

const PREVIOUS_TEST_DB_MIGRATION_SCRIPT = "20220920114600-create-sample-tables.js";
const LASTEST_TEST_DB_MIGRATGION_SCRIPT = "20220920142800-mod-sample-tables.js";

const SEQUELISE_META_TO_REMOVE = [
	PREVIOUS_TEST_DB_MIGRATION_SCRIPT,
	LASTEST_TEST_DB_MIGRATGION_SCRIPT
];

describe("DB migration", ()=>{
	let frontendApp;
	beforeEach(async ()=>{
		frontendApp = express();
		frontendApp.use(getFrontendApp({
			getSignedJsonWebToken: () => "",
			getInstallationAccessToken: async () => ""
		}));
		await resetTestDB();
	});
	afterEach(async ()=> {
		await resetTestDB();
	});
	describe("Param validation", ()=>{
		it("should fail when targetScript is missing in body", async ()=>{
			await triggerDBUp().expect(400);
		});
		it("should fail when the targetScript is a random script", async ()=>{
			await triggerDBUp("some-random-script.js").expect(400);
		});
		it("should fail when the targetScript is not the last script in db/migration folder", async ()=>{
			await triggerDBUp(PREVIOUS_TEST_DB_MIGRATION_SCRIPT).expect(400);
		});
	});
	describe("DB mgiration up", ()=> {
		it("should successfully migration db up to latest script", async ()=> {
			await triggerDBUp(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(200);
		});
		it("should failed migration db up if target script is already in db", async () => {
			await triggerDBUp(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(200);
			await triggerDBUp(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(400);
		});
	});
	describe("DB mgiration down", ()=> {
		it("should successfully migration db down from latest script", async () => {
			await triggerDBUp(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(200);
			await triggerDBDown(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(200);
		});
		it("should fail migration db down if target script is not latest in db", async () => {
			await triggerDBUp(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(200);
			await triggerDBDown(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(200);
			await triggerDBDown(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(400);
		});
	});
	const resetTestDB = async () => {
		await sequelize.query('drop table if exists "UnitTestDBMigrationTable"', {
			type: QueryTypes.RAW
		});
		for (const script of SEQUELISE_META_TO_REMOVE) {
			await sequelize.query(`delete from "SequelizeMeta" where name = :name`, {
				replacements: {
					name: script
				},
				type: QueryTypes.RAW
			});
		}
	};
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
