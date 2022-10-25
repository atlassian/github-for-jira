import express from "express";
import { RootRouter } from "routes/router";
import { Request, Response } from "express";
import supertest from "supertest";

describe("router", () => {
	let app;
	let capturedRes;

	beforeEach(() => {
		app = express();
		app.use(RootRouter);
		capturedRes = undefined;
		app.post("/test", (_: Request, res: Response) => {
			capturedRes = res;
			res.sendStatus(202);
		});
	});

	it("should inject rawBody into json POST requests", async () => {
		const BODY_WITH_SPACE_AT_THE_END = `{"hello": "world"} `;
		await supertest(app)
			.post("/test")
			.set("content-type", "application/json")
			.send(BODY_WITH_SPACE_AT_THE_END)
			.expect(() => {
				expect(capturedRes.locals.rawBody).toEqual(BODY_WITH_SPACE_AT_THE_END);
			});
	});
});
