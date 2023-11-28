import { GithubRemoveSession } from "~/src/routes/github/create-branch/github-remove-session";

describe("GitHub Remove Session", () => {

	let req, res;
	beforeEach(async () => {

		req = {
			session: {
				githubToken: "abc-token"
			}
		};

		res = {
			sendStatus: jest.fn(),
			send: jest.fn(),
			locals: {
				gitHubAppConfig: {}
			}
		};
	});

	it.each(["gitHubAppConfig"])("Should 401 when missing required fields", (attribute) => {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete res.locals[attribute];
		GithubRemoveSession(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	it("Should remove githubToken from session", () => {
		GithubRemoveSession(req, res);
		expect(req.session.githubToken).toBeUndefined();
	});

});