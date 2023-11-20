/* eslint-disable @typescript-eslint/no-explicit-any */
import { isUserAdminOfOrganization } from "./github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { InstallationId } from "~/src/github/client/installation-id";
import { getLogger } from "config/logger";

jest.mock("config/feature-flags");

describe("GitHub Utils", () => {
	describe("isUserAdminOfOrganization", () => {
		let githubUserClient: GitHubUserClient;
		let gitHubInstallationClient: GitHubInstallationClient;
		beforeEach(async () => {
			githubUserClient = new GitHubUserClient("token", gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"));
			gitHubInstallationClient = new GitHubInstallationClient(new InstallationId("https://api.github.com", 1, 111), gitHubCloudConfig, jiraHost, { trigger: "test" }, getLogger("test"), undefined);
		});

		it("should return true if user is admin of a given organization", async () => {
			githubNock
				.get("/user/memberships/orgs/test-org")
				.reply(200, { role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				gitHubInstallationClient,
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
				gitHubInstallationClient,
				"test-org",
				"test-user",
				"Organization",
				getLogger("test")
			)).toBe(false);
		});

		it("should return true if repo is owned by a given user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				gitHubInstallationClient,
				"test-user",
				"test-user",
				"User",
				getLogger("test")
			)).toBe(true);
		});

		it("should return false if repo is owned by another user", async () => {
			expect(await isUserAdminOfOrganization(
				githubUserClient,
				gitHubInstallationClient,
				"different-user",
				"test-user",
				"User",
				getLogger("test")
			)).toBe(false);
		});

		it("should call app client to check permission, fail at non admin role", async () => {

			githubNock.post("/app/installations/111/access_tokens").reply(200, { token: "token", expires_at: new Date().getTime() });

			githubNock
				.get("/orgs/test-org/memberships/test-user")
				.reply(200, { state: "active", role: "non-admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				gitHubInstallationClient,
				"test-org",
				"test-user",
				"Org",
				getLogger("test")
			)).toBe(false);
		});

		it("should call app client to check permission, fail at non-active state", async () => {

			githubNock.post("/app/installations/111/access_tokens").reply(200, { token: "token", expires_at: new Date().getTime() });

			githubNock
				.get("/orgs/test-org/memberships/test-user")
				.reply(200, { state: "inactive", role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				gitHubInstallationClient,
				"test-org",
				"test-user",
				"Org",
				getLogger("test")
			)).toBe(false);
		});

		it("should call app client to check permission, success when active and admin", async () => {

			githubNock.post("/app/installations/111/access_tokens").reply(200, { token: "token", expires_at: new Date().getTime() });

			githubNock
				.get("/orgs/test-org/memberships/test-user")
				.reply(200, { state: "active", role: "admin" });

			expect(await isUserAdminOfOrganization(
				githubUserClient,
				gitHubInstallationClient,
				"test-org",
				"test-user",
				"Org",
				getLogger("test")
			)).toBe(true);
		});
	});
});
