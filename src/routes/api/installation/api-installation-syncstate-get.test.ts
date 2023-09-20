import { ApiInstallationSyncstateGet } from "./api-installation-syncstate-get";
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";


jest.mock("~/src/jira/client/jira-client");

describe("ApiInstallationDelete", ()=>{
	describe("GHES support", ()=>{
		const GHES_GITHUB_INSTALLATION_ID = 123;
		const GHES_GITHUB_APP_ID = 456;
		beforeEach(async ()=>{
			const sub = await Subscription.install({
				installationId: GHES_GITHUB_INSTALLATION_ID,
				host: jiraHost,
				gitHubAppId: GHES_GITHUB_APP_ID,
				hashedClientKey: "key"
			});
			await RepoSyncState.createForSubscription(sub, {
				repoId: 123,
				repoName: "test",
				repoOwner: "test-owner",
				repoFullName: "test-full-name",
				repoUrl: gheUrl
			});
		});
		it("should use gitHubAppId correctly", async ()=>{

			const res = getRes();
			await ApiInstallationSyncstateGet(getReq({
				params: {
					jiraHost,
					installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
					gitHubAppId: GHES_GITHUB_APP_ID.toString()
				},
				query: {
					limit: 100,
					offset: 0
				},
				body: {
					jiraHost
				}
			}), res);
			expect(res.json).toBeCalledWith(expect.objectContaining({
				gitHubInstallationId: GHES_GITHUB_INSTALLATION_ID,
				jiraHost,
				repositories: [expect.objectContaining({
					repoId: 123,
					repoName: "test"
				})]
			}));
		});
	});
	const getReq = (opts: any = {}): any => {
		return {
			log: getLogger("test"),
			params: {
				...opts.params
			},
			query: {
				...opts.query
			},
			body: {
				...opts.body
			},
			get: jest.fn()
		};
	};
	const getRes = (opts: any = {}): any => {
		const ret = {
			status: jest.fn(),
			sendStatus: jest.fn(),
			send: jest.fn(),
			json: jest.fn(),
			locals: {
				...opts
			}
		};
		ret.status.mockReturnValue(ret);
		return ret;
	};
});

