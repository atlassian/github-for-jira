import fs from 'fs';
import path from 'path';
import express from "express";
import { getFrontendApp } from "~/src/app";
import supertest, { Test } from "supertest";
import { sequelize } from "models/sequelize";
import { QueryTypes } from "sequelize";

const DB_MIGRATE_UP_URL = "/api/db-migration/up";
//const DB_MIGRATE_DOWN_URL = "/api/db-migration/down";

const DB_MIGRATION_FOLDER = path.resolve(process.cwd(), "db/migrations");
const TEST_DB_MIGRATION_FOLDER = path.resolve(process.cwd(), "db/migrations-test");
const TEMP_DB_MIGRATION_FOLDER = path.resolve(process.cwd(), "db/migrations-temp");

const PREVIOUS_TEST_DB_MIGRATION_SCRIPT = "20220920114600-create-sample-tables.js";
const LASTEST_TEST_DB_MIGRATGION_SCRIPT = "20220920142800-mod-sample-tables.js";

const SEQUELISE_META_TO_REMOVE = [
	PREVIOUS_TEST_DB_MIGRATION_SCRIPT,
	LASTEST_TEST_DB_MIGRATGION_SCRIPT
];

describe("DB migration", ()=>{
	let frontendApp;
	beforeAll(async ()=>{
		fs.renameSync(DB_MIGRATION_FOLDER, TEMP_DB_MIGRATION_FOLDER);
		fs.renameSync(TEST_DB_MIGRATION_FOLDER, DB_MIGRATION_FOLDER);
	});
	beforeEach(async ()=>{
		frontendApp = express();
		frontendApp.use(getFrontendApp({
			getSignedJsonWebToken: () => "",
			getInstallationAccessToken: async () => ""
		}));
		await sequelize.query("drop table if exists TestDbMigrationTable1", {
			type: QueryTypes.RAW
		});
		for(const script of SEQUELISE_META_TO_REMOVE) {
			await sequelize.query(`delete from "SequelizeMeta" where name = :name`, {
				replacements: {
					name: script
				},
				type: QueryTypes.RAW
			});
		}
	});
	afterAll(async ()=>{
		fs.renameSync(DB_MIGRATION_FOLDER, TEST_DB_MIGRATION_FOLDER);
		fs.renameSync(TEMP_DB_MIGRATION_FOLDER, DB_MIGRATION_FOLDER);
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
		it.only("should successfully migration db up to latest scripts", async ()=> {
			await triggerDBUp(LASTEST_TEST_DB_MIGRATGION_SCRIPT).expect(200);
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
	}
});
