import { JiraServerUrlPost } from "routes/jira/server/jira-server-url-post";
// import express, { Express, Request, Response } from "express";
// import { getLogger } from "config/logger";
// import { JiraServerUrlRouter } from "./jira-server-url-router";


let resSet;
let resStatus;
let resJson;

// function setUpExpressMocks () {
// 	resJson = jest.fn();
// 	resStatus = jest.fn();
// 	resSet = jest.fn();
// 	res = {
// 		set: resSet,
// 		status: resStatus,
// 		json: resJson,
// 	};
// 	resJson.mockImplementation(() => res);
// 	resStatus.mockImplementation(() => res);
// 	resSet.mockImplementation(() => res);
// }
describe("Jira Server Url Suite", () => {
	// let app: Express;
	// beforeEach(async () => {
	// 	app = express();
	// 	app.use((req: Request, res: Response) => {
	// 		req.log = getLogger("test");
	// 		req.session = { jiraHost };
	// 		req.body = {
	// 			installationId: 2
	// 		}
	// 	});
	// 	app.use(JiraServerUrlRouter);
	//
	// });

	// beforeAll(setUpExpressMocks);

	const mockRequest = (): any => ({
		query: { xdm_e: jiraHost },
		csrfToken: jest.fn().mockReturnValue({}),
		log: {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		},
		body: {
			gheServerURL: "http://mytestgheurl.com"
		}
	});

	const mockResponse = (): any => ({
		resJson: jest.fn(),
		resStatus: jest.fn(),
		resSet: jest.fn(),
		res: {
			set: resSet,
			status: resStatus,
			json: resJson
		}
		// resJson.mockImplementation(() => res),
		// resStatus.mockImplementation(() => res),
		// resSet.mockImplementation(() => res),
	});

	it("should return error message when invalid url is sent in request", async () => {
		const response = mockResponse();
		jiraNock
			.post(`/app/installations/15`)
			.reply(200, "hi");

		await JiraServerUrlPost(mockRequest(), response);
		const data = response.render.mock.calls[0][1];
		console.log("daata", data);
	});

});
