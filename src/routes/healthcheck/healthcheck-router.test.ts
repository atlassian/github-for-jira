/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import express, { Application } from "express";
import { HealthcheckRouter } from "routes/healthcheck/healthcheck-router";
import { EncryptionClient } from "utils/encryption-client";
import { envVars } from "config/env";

describe("Healthcheck Router", () => {
	let app: Application;

	beforeEach(async () => {
		app = express();
		app.use(HealthcheckRouter);
		EncryptionClient.encrypt = jest.fn(()=> Promise.resolve("encrypted:xxx"));
		EncryptionClient.decrypt = jest.fn(()=> Promise.resolve("xxx"));
	});

	it("should GET /healthcheck", async () => {
		await supertest(app)
			.get(`/healthcheck`)
			.expect(200);
	});

	it("should GET /deepcheck", async () => {
		await supertest(app)
			.get(`/deepcheck`)
			.expect(200);
	});

	describe("Cryptor checking during healthcheck", ()=>{

		it("On WebServer: should NOT hit cryptor on healthcheck", async ()=>{
			envVars.MICROS_GROUP = "WebServer";
			await supertest(app)
				.get(`/healthcheck`)
				.expect(200);
			expect(EncryptionClient.encrypt).not.toBeCalled();
			expect(EncryptionClient.decrypt).not.toBeCalled();
		});

		it("On Worker: should hit cryptor to do a simple encrypt/decrypt on healthcheck", async ()=>{
			envVars.MICROS_GROUP = "Worker";
			await supertest(app)
				.get(`/healthcheck`)
				.expect(200);
			expect(EncryptionClient.encrypt).toBeCalled();
			expect(EncryptionClient.decrypt).toBeCalled();
		});

		it("should hit cryptor to do a simple encrypt and decrypt on deepcheck", async ()=>{
			envVars.MICROS_GROUP = "WebServer";
			await supertest(app)
				.get(`/deepcheck`)
				.expect(200);
			expect(EncryptionClient.encrypt).toBeCalled();
			expect(EncryptionClient.decrypt).toBeCalled();
		});

	});

});
