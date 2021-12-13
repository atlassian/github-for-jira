/* eslint-disable @typescript-eslint/no-explicit-any */
import envVars from "../../../src/config/env";
import { getJiraAppUrl, getJiraMarketplaceUrl } from "../../../src/util/get-url";

describe("Get URL Utils", () => {
	describe("getJiraAppUrl", () => {
		let instanceName:string;
		beforeEach(() => instanceName = envVars.INSTANCE_NAME);
		afterEach(() => envVars.INSTANCE_NAME = instanceName);

		it("should return the correct default URL", () => {
			expect(getJiraAppUrl(jiraHost)).toEqual(`${jiraHost}/plugins/servlet/ac/com.github.integration.test-atlassian-instance/github-post-install-page`);
			expect(getJiraAppUrl("https://foo.com")).toEqual(`https://foo.com/plugins/servlet/ac/com.github.integration.test-atlassian-instance/github-post-install-page`);
		});

		it("should return the correct URL for different INSTANCE_NAME", () => {
			envVars.INSTANCE_NAME = "foo";
			expect(getJiraAppUrl(jiraHost)).toEqual(`${jiraHost}/plugins/servlet/ac/com.github.integration.foo/github-post-install-page`);
		});

		it("should return empty string if missing jiraHost", () => {
			expect(getJiraAppUrl("")).toEqual("");
			expect(getJiraAppUrl(undefined as any)).toEqual("");
		});
	});

	describe("getJiraMarketplaceUrl", () => {
		it("should return the correct default URL", ()=> {
			expect(getJiraMarketplaceUrl(jiraHost)).toEqual(`${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.production`)
			expect(getJiraMarketplaceUrl("https://foo.com")).toEqual(`https://foo.com/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.production`)
		});

		it("should return empty string if missing jiraHost", () => {
			expect(getJiraMarketplaceUrl("")).toEqual("");
			expect(getJiraMarketplaceUrl(undefined as any)).toEqual("");
		});
	});
});
