import { getLogger } from "config/logger";
import { GithubConfigurationAppInstallsGet } from "routes/github/configuration/github-configuration-app-installs-get";

describe("GitHub Branches Get", () => {

	let req, res;
	beforeEach(async () => {
		req = {
			log: getLogger("request")
		};

		res = {
			sendStatus: jest.fn(),
			redirect: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				gitHubAppConfig: {}
			}
		};
	});

	it("Should successfully redirect to GitHub path", async () => {
		githubNock
			.get(`/app`)
			.reply(200, {
				html_url: "https://github.com/apps/jira"
			});
		await GithubConfigurationAppInstallsGet(req, res);
		expect(res.redirect).toHaveBeenCalledWith("https://github.com/apps/jira/installations/new");
	});

	it.each(["githubToken", "gitHubAppConfig"])("Should throw an error when no %s found", async (attribute) => {
		delete res.locals[attribute];
		await GithubConfigurationAppInstallsGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

});


