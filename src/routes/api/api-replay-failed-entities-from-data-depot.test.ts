
import express, {  Application, NextFunction, Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import { ApiRouter } from "./api-router";
import supertest from "supertest";

describe("api-replay-failed-entities-from-data-depot", () => {

	let app: Application;

	const createApp = () => {
		const app = express();
		app.use((req: Request, _: Response, next: NextFunction) => {
			req.log = getLogger("test");
			next();
		});
		app.use("/api", ApiRouter);
		return app;
	};

	it("should return 400 if slauth header is missing", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.then((res) => {
				expect(res.status).toBe(401);
			});
	});

	it("should return message if input is empty", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send([])
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Replay entities are empty.");
			});
	});


});