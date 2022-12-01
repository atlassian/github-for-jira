import { when } from "jest-when";
import { ApiInstallationDelete } from "./api-installation-delete";
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";


jest.mock("~/src/jira/client/jira-client");

describe("ApiInstallationDelete", ()=>{
	describe("GHES support", ()=>{
		const GHES_GITHUB_INSTALLATION_ID = 123;
		const GHES_GITHUB_APP_ID = 456;
		let mockJiraClient;
		beforeEach(async ()=>{
			await Subscription.install({
				installationId: GHES_GITHUB_INSTALLATION_ID,
				host: jiraHost,
				gitHubAppId: GHES_GITHUB_APP_ID,
				clientKey: "key"
			});
			mockJiraClient = {
				devinfo: {
					installation: {
						delete: jest.fn()
					}
				}
			};
		});
		it("should get subcription with gitHubAppid in param", async ()=>{
			when(jest.mocked(getJiraClient))
				.calledWith(jiraHost, GHES_GITHUB_INSTALLATION_ID, GHES_GITHUB_APP_ID, expect.anything())
				.mockResolvedValue(mockJiraClient);

			const res = getRes();
			await ApiInstallationDelete(getReq({
				params: {
					jiraHost,
					installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
					gitHubAppId: GHES_GITHUB_APP_ID.toString()
				},
				body: {
					jiraHost
				}
			}), res);
			expect(res.status).toBeCalledWith(200);
			expect(mockJiraClient.devinfo.installation.delete).toBeCalledWith(GHES_GITHUB_INSTALLATION_ID.toString());
		});
		it("should get subcription with gitHubAppid in query string", async ()=>{
			when(jest.mocked(getJiraClient))
				.calledWith(jiraHost, GHES_GITHUB_INSTALLATION_ID, GHES_GITHUB_APP_ID, expect.anything())
				.mockResolvedValue(mockJiraClient);

			const res = getRes();
			await ApiInstallationDelete(getReq({
				params: {
					jiraHost,
					installationId: GHES_GITHUB_INSTALLATION_ID.toString()
				},
				query: {
					gitHubAppId: GHES_GITHUB_APP_ID.toString()
				},
				body: {
					jiraHost
				}
			}), res);
			expect(res.status).toBeCalledWith(200);
			expect(mockJiraClient.devinfo.installation.delete).toBeCalledWith(GHES_GITHUB_INSTALLATION_ID.toString());
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

