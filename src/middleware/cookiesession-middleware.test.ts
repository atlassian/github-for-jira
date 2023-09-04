import supertest from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { cookieSessionMiddleware } from "./cookiesession-middleware";

describe("Cookie session middleware", () => {

	const createApp = () => {
		const app = express();
		app.use(cookieParser());
		app.use(cookieSessionMiddleware);
		return app;
	};

	it("should have session cookie with correct options", async () => {

		const app = createApp();
		app.get("/test/cookie-session", (req, res) => {
			//Bellow line is needed because
			//1. cookie-sessions lib create none-secure cookie,
			//2. and cookies lib refuse to set-cookie header if connection is not secure
			//In production, the connection will always be encrypted
			req.connection.encrypted = true;
			req.session["test-cookie-key"] = "test-cookie-value";
			res.send("ok");
		});

		const response = await supertest(app)
			.get(`/test/cookie-session`);
		expect(response.status).toBe(200);
		const cookies = response.headers["set-cookie"];
		expect(cookies).toEqual(expect.arrayContaining([
			expect.stringMatching(/session=.+samesite=none.+secure;.+httponly/),
			expect.stringMatching(/session.sig=.+samesite=none.+secure;.+httponly/)
		]));
	});

});
