import express from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";

const DB_MIGRATE_UP_URL = "/api/db-migration/up";

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
		it("should throw error when targetScript is missing in body", async ()=>{
			await supertest(frontendApp)
				.post(DB_MIGRATE_UP_URL)
				.set("X-Slauth-Mechanism", "test")
				.expect(400);
		});
	});
});
