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
			jest.spyOn(EncryptionClient, "healthcheck");
		});


		it("should keep hitting cryptor until cryptor is not up and running", async () => {
			let expectedNumberOfAttempts = 0;

			(EncryptionClient.healthcheck as unknown as jest.SpyInstance).mockRejectedValue("foo");
			await supertest(app)
				.get(`/healthcheck?reset_cryptor_check_state=true`)
				.expect(500);
			expectedNumberOfAttempts ++;
			for (let callNo = 0; callNo < 3; callNo ++) {
				await supertest(app)
					.get(`/healthcheck`)
					.expect(500);
				expectedNumberOfAttempts ++;
			}
			expect(EncryptionClient.healthcheck).toBeCalledTimes(expectedNumberOfAttempts);
		});

		it("should stop hitting cryptor once it is ready", async () => {
			let expectedNumberOfAttempts = 0;

			(EncryptionClient.healthcheck as unknown as jest.SpyInstance).mockRejectedValue("foo");
			await supertest(app)
				.get(`/healthcheck?reset_cryptor_check_state=true`)
				.expect(500);
			expectedNumberOfAttempts ++;

			(EncryptionClient.healthcheck as unknown as jest.SpyInstance).mockResolvedValue(true);
			for (let callNo = 0; callNo < 3; callNo ++) {
				await supertest(app)
					.get(`/healthcheck`)
					.expect(200);
			}
			expectedNumberOfAttempts ++; // outside of the loop because the calling should stop

			expect(EncryptionClient.healthcheck).toBeCalledTimes(expectedNumberOfAttempts);
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
