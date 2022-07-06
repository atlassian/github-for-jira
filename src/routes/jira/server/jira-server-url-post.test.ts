// import { JiraServerUrlPost } from "routes/jira/server/jira-server-url-post";
//
// describe("Jira Server Url Suite", () => {
// 	it("should return error message when invalid url is sent in request", async () => {
// 		const mockRequest = (): any => ({
// 			body: {
// 				installationId: 2,
// 				gheServerURL: "thisisntaurl"
// 			}
// 		});
//
// 		const mockResponse = (): any => ({
// 			locals: {
// 				jiraHost
// 			},
// 			render: jest.fn().mockReturnValue({}),
// 			status: () => ({
// 				send: jest.fn().mockReturnValue({ success: false, error: "Invalid URL", message: "The entered URL is not valid." })
// 			}),
// 			send: jest.fn().mockReturnValue({})
// 		});
//
// 		await JiraServerUrlPost(mockRequest(), mockResponse());
// 		expect(mockResponse().status().send()).toEqual({ success: false, error: "Invalid URL", message: "That URL doesn't look right. Please check and try again." });
// 	});
// });
// import { JiraServerUrlPost } from "routes/jira/server/jira-server-url-post";
import { Installation } from "models/installation";
import express, { Express, NextFunction, Request, Response } from "express";
import { RootRouter } from "../../router";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { encodeSymmetric } from "atlassian-jwt";

describe("Jira Server Url Suite", () => {
	let app: Express;
	let installation: Installation;
	let jwt: string;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "client-key"
		});
		app = express();
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = { installation };
			req.log = getLogger("test");
			req.session = { jiraHost };
			next();
		});
		app.use(RootRouter);

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: jiraHost
		}, installation.sharedSecret);
	});

	it("should return error message when invalid url is sent in request", async () => {
		return supertest(app)
			.post("/jira/server-url")
			.send({
				installationId: installation.id,
				jiraHost,
				jwt,
				gheServerURL: "notaurl"
			})
			.expect(200)
			.then((res) => {
				expect(res.body).toEqual({ success: true, error: "Invalid URL", message: "That URL doesn't look right. Please check and try again." });
			});
	});
});
