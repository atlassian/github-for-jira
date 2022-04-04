/* eslint-disable @typescript-eslint/no-explicit-any */
import { envVars }  from "config/env";
import { getJiraAppUrl, getJiraMarketplaceUrl, jiraIssueKeyParser } from "./jira-utils";

describe("Jira Utils", () => {
	describe("getJiraAppUrl", () => {
		let instanceName: string;
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
		it("should return the correct default URL", () => {
			expect(getJiraMarketplaceUrl(jiraHost)).toEqual(`${jiraHost}/jira/marketplace/discover/app/com.github.integration.production`);
			expect(getJiraMarketplaceUrl("https://foo.com")).toEqual(`https://foo.com/jira/marketplace/discover/app/com.github.integration.production`);
		});

		it("should return empty string if missing jiraHost", () => {
			expect(getJiraMarketplaceUrl("")).toEqual("");
			expect(getJiraMarketplaceUrl(undefined as any)).toEqual("");
		});
	});

	describe("jiraIssueKeyParser", () => {
		describe("issue keys - branches", () => {
			it("extracts a single issue key from a branch - all uppercase", () => {
				expect(jiraIssueKeyParser("JRA-123")).toEqual(["JRA-123"]);
				expect(jiraIssueKeyParser("JRA-456-some-extra-text")).toEqual(["JRA-456"]);
				expect(jiraIssueKeyParser("some-extra-text-JRA-789")).toEqual(["JRA-789"]);
			});

			it("extracts a single issue key from a branch - all lowercase", () => {
				expect(jiraIssueKeyParser("jra-123")).toEqual(["JRA-123"]);
				expect(jiraIssueKeyParser("jra-456-some-extra-text")).toEqual(["JRA-456"]);
				expect(jiraIssueKeyParser("some-extra-text-jra-789")).toEqual(["JRA-789"]);
			});

			it("extracts a single issue key from a branch - uppercase and lowercase", () => {
				expect(jiraIssueKeyParser("jRa-123")).toEqual(["JRA-123"]);
				expect(jiraIssueKeyParser("Jra-456-some-extra-text")).toEqual(["JRA-456"]);
				expect(jiraIssueKeyParser("some-extra-text-jrA-789")).toEqual(["JRA-789"]);
			});

			it("extracts multiple issue keys from a branch", () => {
				expect(jiraIssueKeyParser("JRA-123-Jra-456")).toEqual(["JRA-123", "JRA-456"]);
				expect(jiraIssueKeyParser("jRa-123-JRA-456-my-branch")).toEqual(["JRA-123", "JRA-456"]);
				expect(jiraIssueKeyParser("my-branch-JrA-123-JRa-456")).toEqual(["JRA-123", "JRA-456"]);
				expect(jiraIssueKeyParser("JrA-123-my-branch-jra-456")).toEqual(["JRA-123", "JRA-456"]);
			});

			it("extracts issue keys embedded in branch", () => {
				expect(jiraIssueKeyParser("feature/JRA-123-my-feature")).toEqual(["JRA-123"]);
				expect(jiraIssueKeyParser("feature/JRA-123-and-JRA-456")).toEqual(["JRA-123", "JRA-456"]);
			});

			it("extracts alphanumeric issue key from a branch", () => {
				expect(jiraIssueKeyParser("feature/J3-123-my-feature")).toEqual(["J3-123"]);
			});

			it("should not extract issue key when key leads with a number", () => {
				expect(jiraIssueKeyParser("feature/45-123-my-feature")).toEqual([]);
			});

			it("should not extract issue key with single char project key", () => {
				expect(jiraIssueKeyParser("F-67-my-feature")).toEqual([]);
			});
		});

		describe("issue keys - commits and pull requests (title and body)", () => {
			it("extracts a single issue key from a commit message/pull request", () => {
				expect(jiraIssueKeyParser("JrA-123")).toEqual(["JRA-123"]);
				expect(jiraIssueKeyParser("JRa-456 some extra text")).toEqual(["JRA-456"]);
				expect(jiraIssueKeyParser("some extra text jRA-789")).toEqual(["JRA-789"]);
			});

			it("extracts multiple issue keys from a commit message/pull request", () => {
				expect(jiraIssueKeyParser("JRa-123 and JrA-456")).toEqual(["JRA-123", "JRA-456"]);
				expect(jiraIssueKeyParser("JRA-123 jRA-456 did some stuff")).toEqual(["JRA-123", "JRA-456"]);
				expect(jiraIssueKeyParser("did some stuff here too for jrA-123 jra-456")).toEqual(["JRA-123", "JRA-456"]);
				expect(jiraIssueKeyParser("JRA-123 changes that applied to JRA-456")).toEqual(["JRA-123", "JRA-456"]);
			});

			it("extracts issue keys prefixed with a hash from a commit message/pull request", () => {
				expect(jiraIssueKeyParser("#JRA-123 #Jra-456")).toEqual(["JRA-123", "JRA-456"]);
			});

			it("extracts issue keys from brackets and parentheses from a commit message/pull request", () => {
				expect(jiraIssueKeyParser("Making a commit with [JrA-123] and (jra-456)")).toEqual(["JRA-123", "JRA-456"]);
				expect(jiraIssueKeyParser("[TEST-123] Test commit.")).toEqual(["TEST-123"]);
			});

			it("extracts alphanumeric issue key from a commit message/pull request", () => {
				expect(jiraIssueKeyParser("made some changes to j2-123")).toEqual(["J2-123"]);
			});

			it("should not extract issue key when key leads with a number", () => {
				expect(jiraIssueKeyParser("my feature 22-123")).toEqual([]);
			});
		});

		it("should handle incorrect types", () => {
			expect(jiraIssueKeyParser(2 as any)).toEqual([]);
			expect(jiraIssueKeyParser("" as any)).toEqual([]);
			expect(jiraIssueKeyParser([] as any)).toEqual([]);
			expect(jiraIssueKeyParser({} as any)).toEqual([]);
			expect(jiraIssueKeyParser(null as any)).toEqual([]);
			expect(jiraIssueKeyParser(undefined as any)).toEqual([]);
		});
	});
});
