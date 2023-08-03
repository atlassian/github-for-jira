/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import express, { Application } from "express";
import { HealthcheckRouter } from "routes/healthcheck/healthcheck-router";
import { EncryptionClient } from "utils/encryption-client";

describe("Healthcheck Router", () => {
	let app: Application;

	beforeEach(async () => {
		app = express();
		app.use(HealthcheckRouter);
	});

	it("should GET /healthcheck", async () => {
		await supertest(app)
			.get(`/healthcheck`)
			.expect(200);
	});

	it("should POST /healthcheck/:uuid", async () => {
		await supertest(app)
			.post	(`/healthcheck/blah`)
			.expect(200);
	});

	it("should GET /deepcheck", async () => {
		await supertest(app)
			.get(`/deepcheck`)
			.expect(200);
	});

	describe("Cryptor checking during healthcheck", () => {
		beforeEach(() => {
			jest.spyOn(EncryptionClient, "encrypt");
			jest.spyOn(EncryptionClient, "decrypt");
		});

		it("should hit cryptor to do a simple encrypt/decrypt on healthcheck", async () => {
			await supertest(app)
				.get(`/healthcheck`)
				.expect(200);
			expect(EncryptionClient.encrypt).toBeCalled();
			expect(EncryptionClient.decrypt).toBeCalled();
		});

		it("should hit cryptor to do a simple encrypt and decrypt on deepcheck", async () => {
			await supertest(app)
				.get(`/deepcheck`)
				.expect(200);
			expect(EncryptionClient.encrypt).toBeCalled();
			expect(EncryptionClient.decrypt).toBeCalled();
		});
	});
});
