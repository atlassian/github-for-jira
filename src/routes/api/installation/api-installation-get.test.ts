import { ApiInstallationGet } from "./api-installation-get";
import { Subscription } from "models/subscription";
import { createAppClient } from "~/src/util/get-github-client-config";
import { when } from "jest-when";
import { getLogger } from "config/logger";

jest.mock("~/src/util/get-github-client-config");

describe("ApiInstallationGet", () => {
	describe("GHES support", () => {
		const GHES_GITHUB_APP_ID = 123;
		const GHES_GITHUB_INSTALLATION_ID = 456;
		beforeEach(async () => {
			await Subscription.install({
				installationId: GHES_GITHUB_INSTALLATION_ID,
				host: jiraHost,
				gitHubAppId: GHES_GITHUB_APP_ID,
				hashedClientKey: "key"
			});
		});
		it("should find correct github app with id", async () => {

			when(jest.mocked(createAppClient))
				.calledWith(expect.anything(), jiraHost, GHES_GITHUB_APP_ID, expect.anything())
				.mockResolvedValue({ getInstallation: jest.fn() } as any);
			const res = getRes();

			await ApiInstallationGet(getReq({
				params: {
					installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
					gitHubAppId: GHES_GITHUB_APP_ID.toString()
				}
			}), res);

			expect(createAppClient)
				.toBeCalledWith(expect.anything(), undefined, GHES_GITHUB_APP_ID, { trigger: "api_installation_get" });
		});
	});
	const getReq = (opts: any = {}): any => {
		return {
			log: getLogger("test"),
			params: {
				...opts.params
			},
			get: jest.fn()
		};
	};
	const getRes = (opts: any = {}): any => {
		const ret = {
			status: jest.fn(),
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
