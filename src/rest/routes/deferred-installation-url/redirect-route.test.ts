import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import {
	SubscriptionDeferredInstallPayload
} from "../../../services/subscription-deferred-install-service";

interface ResponseHeaders {
	[key: string]: string,
}

const VALID_REQUEST_ID = "customized-uuid-customized-uuid";
const validData: SubscriptionDeferredInstallPayload = {
	gitHubInstallationId: 1234,
	jiraHost: "https://customJirahost.com",
	installationIdPk: 12312,
	orgName: "custom-orgName"
};
jest.mock("services/subscription-deferred-install-service",
	() => ({
		extractSubscriptionDeferredInstallPayload: (id: string) => {
			// Mocking the redis values
			if (id === VALID_REQUEST_ID) {
				return Promise.resolve(validData);
			} else {
				throw new Error("Empty request ID");
			}
		}
	})
);

describe("rest deferred installation redirect route check", () => {
	const testSharedSecret = "test-secret";
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
	});

	describe("cloud", () => {
		it("throws 500 when random requestId is passed", async () => {
			const resp = await supertest(app)
				.get(`/rest/deferred-installation/request/random-uuid`);

			expect(resp.status).toEqual(500);
		});

		it("should return valid redirect URL when valid request is passed", async () => {
			const resp = await supertest(app)
				.get(`/rest/deferred-installation/request/${VALID_REQUEST_ID}`);

			expect(resp.status).toEqual(302);
			expect((resp.headers as ResponseHeaders).location)
				.toBe("https://customJirahost.com/plugins/servlet/ac/com.github.integration.test-atlassian-instance/spa-deferred-page?ac.gitHubInstallationId=1234&ac.gitHubOrgName=custom-orgName");
		});
	});
});
