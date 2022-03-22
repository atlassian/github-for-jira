/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import express, { Application } from "express";
import { HealthcheckRouter } from "routes/healthcheck/healthcheck-router";

describe("Healthcheck Router", () => {
	let app: Application;

	beforeEach(async () => {
		app = express();
		app.use(HealthcheckRouter);
	});

	it("should GET /healthcheck", async () => {
		await supertest(app)
			.get(`/healthcheck`)
			.expect(200)
	});

	it("should GET /deepcheck", async () => {
		await supertest(app)
			.get(`/deepcheck`)
			.expect(200)
	});
});
