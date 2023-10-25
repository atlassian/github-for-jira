import express, { Application, NextFunction, Request, Response } from "express";
import { getLogger } from "config/logger";
import { noop } from "lodash";
import { RestErrorHandler } from "~/src/rest/middleware/error/index";
import supertest from "supertest";
import { RestApiError } from "config/errors";
import { GithubClientError } from "~/src/github/client/github-client-errors";
import { AxiosError } from "axios";

describe("Testing RestErrorHandler", () => {
	let app: Application;
	const createApp = () => {
		const app = express();
		app.use((req: Request, _: Response, next: NextFunction) => {
			req.log = getLogger("test");
			req.addLogFields = () => noop;
			next();
		});
		app.get("/testRestApiError", () => {
			throw new RestApiError(500, "UNKNOWN", "Throwing Rest API error");
		});
		app.get("/testGithubClientError", () => {
			throw new GithubClientError(
				"Throwing GitHub client error",
				{
					config: {},
					isAxiosError: true
				} as AxiosError);
		});
		app.get("/testOtherErrors", () => { throw new Error("Any random error message"); });
		app.use("", RestErrorHandler);
		return app;
	};
	const sendRequest = (url: string) => supertest(app).get(url).send();

	beforeEach(() => {
		app = createApp();
	});

	it("Testing Rest Api Error", async () => {
		const res = await sendRequest("/testRestApiError");
		const body = res.body as { errorCode: string, message: string };
		expect(body.errorCode).toEqual("UNKNOWN");
		expect(body.message).toEqual("Throwing Rest API error");
	});

	it("Testing Github Client Error", async () => {
		const res = await sendRequest("/testGithubClientError");
		const body = res.body as { errorCode: string, message: string };
		expect(body.errorCode).toEqual("UNKNOWN");
		expect(body.message).toEqual("Throwing GitHub client error");
	});

	it("Testing Other Errors", async () => {
		const res = await sendRequest("/testOtherErrors");
		const body = res.body as { errorCode: string, message: string };
		expect(body.errorCode).toEqual("UNKNOWN");
		expect(body.message).toEqual("Unknown Error");
	});


});
