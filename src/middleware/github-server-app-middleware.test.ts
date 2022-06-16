/* eslint-disable @typescript-eslint/no-explicit-any */
import Mock = jest.Mock;
import { githubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { getLogger } from "config/logger";

// jest.mock("middleware/github-server-app-middleware");
// const mockGithubServerAppMiddleware = (githubServerAppMiddleware as any) as jest.Mock<typeof githubServerAppMiddleware>;

describe("github-server-app-middleware", () => {

	let req;
	let res;
	let next: Mock;

	beforeEach(() => {
		next = jest.fn();
		res = {
			locals: {
				jiraHost: "https://testatlassian.net"
			},
			status: jest.fn(),
			json: jest.fn()
		};
	});

	it.only("should call next() when no gitHupAppId is provided",  async() => {
		req = {
			log: getLogger("request"),
			params: {
				id: undefined
			}
		};

		await githubServerAppMiddleware(req, res, next);
		expect(next).toBeCalledTimes(1);
	});

	it.only("should throw an error if an id is provided but no GitHub server app is found", async () => {
		req = {
			log: getLogger("request"),
			params: {
				id: 3
			}
		};

		await githubServerAppMiddleware(req, res, next);
		expect(next).toBeCalledTimes(1);
	});

	it("should throw an error if an id is provided and a GitHub server app is found but the installation id doesn't match",  () => {

	});

	it("should call next() when GH app is found and installation id matches",  () => {

	});
});
