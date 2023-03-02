import { ApiInstallationSyncPost } from "./api-installation-sync-post";
import { getLogger } from "config/logger";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { Subscription } from "models/subscription";

jest.mock("~/src/sync/sync-utils");

describe("ApiInstallationSyncPost", ()=>{
	describe("GHES support", ()=>{
		const GHES_GITHUB_INSTALLATION_ID = 123;
		const GHES_GITHUB_APP_ID = 456;
		beforeEach(async ()=>{
			await Subscription.install({
				installationId: GHES_GITHUB_INSTALLATION_ID,
				host: jiraHost,
				gitHubAppId: GHES_GITHUB_APP_ID,
				hashedClientKey: "key"
			});
		});
		it("should get subcription with gitHubAppid", async ()=>{
			const res = getRes();
			await ApiInstallationSyncPost(getReq({
				params: {
					installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
					gitHubAppId: GHES_GITHUB_APP_ID.toString()
				},
				body: {
					jiraHost
				}
			}), res);
			expect(res.status).toBeCalledWith(202);
			expect(findOrStartSync).toBeCalledWith(expect.objectContaining({
				gitHubInstallationId: GHES_GITHUB_INSTALLATION_ID,
				gitHubAppId: GHES_GITHUB_APP_ID
			}), expect.anything(), false, undefined);
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
