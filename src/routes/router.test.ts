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

	it("should render error page on error happen inside the routes", async () => {
		await supertest(app)
			.get("/github/callback")
			.set("content-type", "application/json")
			.expect((resp) => {
				expect(resp.text).toEqual(expect.stringContaining("Something went wrong."));
				expect(resp.text).toEqual(expect.stringContaining("No state was found"));
			});
	});
});
