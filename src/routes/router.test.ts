import express, { Request, Response } from "express";
import { RootRouter } from "routes/router";
import supertest from "supertest";

describe("router", () => {
	let app;
	let capturedReq;

	beforeEach(() => {
		app = express();
		app.use(RootRouter);
		capturedReq = undefined;
		app.post("/test", (req: Request, res: Response) => {
			capturedReq = req;
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
				expect(capturedReq.rawBody).toEqual(BODY_WITH_SPACE_AT_THE_END);
			});
	});
});
