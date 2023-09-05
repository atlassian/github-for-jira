/* eslint-disable @typescript-eslint/no-explicit-any */
import { isUserAdminOfOrganization } from "./github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { keyLocator } from "~/src/github/client/key-locator";
import { getLogger } from "config/logger";
import { BooleanFlags, booleanFlag } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("config/feature-flags");

describe("GitHub Utils", () => {
	describe("isUserAdminOfOrganization", () => {
		let githubUserClient: GitHubUserClient;
		let gitHubAppClient: GitHubAppClient;
		beforeEach(async () => {
			githubUserClient = new GitHubUserClient("token", gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
			gitHubAppClient = new GitHubAppClient(gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"), "111", await keyLocator(undefined, jiraHost));
		});

		it("should return true if user is admin of a given organization", async () => {
			githubNock
				.get("/user/memberships/orgs/test-org")
				.reply(200, { role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				jiraHost,
				gitHubAppClient,
				"test-org",
				"test-user",
				"Organization",
				getLogger("test")
			)).toBe(true);
		});

		it("should return false if user is not an admin of a given organization", async () => {
			githubNock
				.get("/user/memberships/orgs/test-org")
				.reply(200, { role: "member" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				jiraHost,
				gitHubAppClient,
				"test-org",
				"test-user",
				"Organization",
				getLogger("test")
			)).toBe(false);
		});

		it("should return true if repo is owned by a given user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				jiraHost,
				gitHubAppClient,
				"test-user",
				"test-user",
				"User",
				getLogger("test")
			)).toBe(true);
		});

		it("should return false if repo is owned by another user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				jiraHost,
				gitHubAppClient,
				"different-user",
				"test-user",
				"User",
				getLogger("test")
			)).toBe(false);
		});

		it("should call app client to check permission, fail at non admin role", async () => {

			when(booleanFlag).calledWith(BooleanFlags.USE_APP_CLIENT_CHECK_PERMISSION, expect.anything()).mockResolvedValue(true);

			githubNock
				.get("/orgs/test-org/memberships/test-user")
				.reply(200, { state: "active", role: "non-admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				jiraHost,
				gitHubAppClient,
				"test-org",
				"test-user",
				"Org",
				getLogger("test")
			)).toBe(false);
		});

		it("should call app client to check permission, fail at non-active state", async () => {

			when(booleanFlag).calledWith(BooleanFlags.USE_APP_CLIENT_CHECK_PERMISSION, expect.anything()).mockResolvedValue(true);

			githubNock
				.get("/orgs/test-org/memberships/test-user")
				.reply(200, { state: "inactive", role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				jiraHost,
				gitHubAppClient,
				"test-org",
				"test-user",
				"Org",
				getLogger("test")
			)).toBe(false);
		});

		it("should call app client to check permission, success when active and admin", async () => {

			when(booleanFlag).calledWith(BooleanFlags.USE_APP_CLIENT_CHECK_PERMISSION, expect.anything()).mockResolvedValue(true);

			githubNock
				.get("/orgs/test-org/memberships/test-user")
				.reply(200, { state: "active", role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				jiraHost,
				gitHubAppClient,
				"test-org",
				"test-user",
				"Org",
				getLogger("test")
			)).toBe(true);
		});
	});
});
