/* eslint-disable @typescript-eslint/no-explicit-any */
import { isUserAdminOfOrganization } from "./github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { getLogger } from "config/logger";

describe("GitHub Utils", () => {
	describe("isUserAdminOfOrganization", () => {
		let githubUserClient: GitHubUserClient;
		beforeEach(() => {
			githubUserClient = new GitHubUserClient("token", gitHubCloudConfig, { trigger: "test" }, getLogger("test"));
		});

		it("should return true if user is admin of a given organization", async () => {
			githubNock
				.get("/user/memberships/orgs/test-org")
				.reply(200, { role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
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
				"test-org",
				"test-user",
				"Organization",
				getLogger("test")
			)).toBe(false);
		});

		it("should return true if repo is owned by a given user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				"test-user",
				"test-user",
				"User",
				getLogger("test")
			)).toBe(true);
		});

		it("should return false if repo is owned by another user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				"different-user",
				"test-user",
				"User",
				getLogger("test")
			)).toBe(false);
		});
	});
});
