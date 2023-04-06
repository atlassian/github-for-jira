import { when } from "jest-when";
import { ApiInstallationDeletePollinator, STAGE_POLLINATOR_JIRA_HOST, PROD_POLLINATOR_JIRA_HOST } from "./api-installation-delete-pollinator";
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { RepoSyncState } from "~/src/models/reposyncstate";

jest.mock("~/src/jira/client/jira-client");
jest.mock("config/feature-flags");

describe("ApiInstallationDeletePollinator", ()=>{
	describe("GHES support", ()=>{
		const GHES_GITHUB_INSTALLATION_ID = 123;
		const GHES_GITHUB_APP_ID = 456;
		let mockJiraClient;

		const createSubscription = async (jiraHost: string) => {
			return await Subscription.install({
				installationId: GHES_GITHUB_INSTALLATION_ID,
				host: jiraHost,
				gitHubAppId: GHES_GITHUB_APP_ID,
				hashedClientKey: "key"
			});
		};

		const createRepoSyncState = async (subscriptionId: number, repoId: number) => {
			return await RepoSyncState.create({
				subscriptionId,
				repoId,
				repoName: "test-repo-name",
				repoOwner: "integrations",
				repoFullName: "test-repo-name",
				repoUrl: "test-repo-url"
			});
		};


		beforeEach(async ()=>{
			mockJiraClient = { devinfo: { installation: { delete: jest.fn() } } };
		});

		it("should throw error if jiraHost is not within pollinator site", async ()=>{
			const res = getRes();
			await ApiInstallationDeletePollinator(getReq({
				params: {
					jiraHost: "https://whatever.atlassian.net",
					installationId: 1,
					gitHubAppId: undefined
				},
				body: {
					jiraHost
				}
			}), res);
			expect(res.status).toBeCalledWith(400);
			expect(res.send).toBeCalledWith("Jira Host not a pollinator jira site");
		});

		it.each([STAGE_POLLINATOR_JIRA_HOST, PROD_POLLINATOR_JIRA_HOST])("should delete repoSyncStates from subcription", async (jiraSiteUrl: string)=>{

			when(jest.mocked(getJiraClient))
				.calledWith(jiraSiteUrl, GHES_GITHUB_INSTALLATION_ID, GHES_GITHUB_APP_ID, expect.anything())
				.mockResolvedValue(mockJiraClient);

			const sub = await createSubscription(jiraSiteUrl);
			await createRepoSyncState(sub.id, 1);
			expect((await RepoSyncState.findAllFromSubscription(sub)).length).toBe(1);

			const res = getRes();
			await ApiInstallationDeletePollinator(getReq({
				params: {
					jiraHost: jiraSiteUrl,
					installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
					gitHubAppId: GHES_GITHUB_APP_ID.toString()
				},
				body: {
					jiraHost
				}
			}), res);
			expect(res.status).toBeCalledWith(200);
			expect(mockJiraClient.devinfo.installation.delete).toBeCalledWith(GHES_GITHUB_INSTALLATION_ID.toString());
			expect((await RepoSyncState.findAllFromSubscription(sub)).length).toBe(0);

			await sub.reload();

			expect(sub).toEqual(expect.objectContaining({
				...sub,
				syncStatus: null,
				syncWarning: null,
				backfillSince: null,
				totalNumberOfRepos: null,
				numberOfSyncedRepos: null,
				repositoryCursor: null,
				repositoryStatus: null
			}));
		});
	});
	const getReq = (opts: any = {}): any => {
		return {
			log: getLogger("test"),
			params: {
				...opts.params
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

