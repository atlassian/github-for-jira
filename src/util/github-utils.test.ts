/* eslint-disable @typescript-eslint/no-explicit-any */
import { isUserAdminOfOrganization } from "./github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";

describe("GitHub Utils", () => {
	describe("isUserAdminOfOrganization", () => {
		let githubUserClient: GitHubUserClient;
		beforeEach(() => {
			githubUserClient = new GitHubUserClient("token", gitHubCloudConfig);
		});

		it("should return true if user is admin of a given organization", async () => {
			githubNock
				.get("/user/memberships/orgs/test-org")
				.reply(200, { role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				"test-org",
				"test-user",
				"Organization"
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
				"Organization"
			)).toBe(false);
		});

		it("should return true if repo is owned by a given user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				"test-user",
				"test-user",
				"User"
			)).toBe(true);
		});

		it("should return false if repo is owned by another user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				"different-user",
				"test-user",
				"User"
			)).toBe(false);
		});
	});
});
