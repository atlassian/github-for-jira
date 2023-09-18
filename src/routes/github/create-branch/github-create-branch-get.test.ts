import { Application } from "express";
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { generateSignedSessionCookieHeader, parseCookiesAndSession } from "test/utils/cookies";
import { Subscription } from "models/subscription";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";
import { generateBranchName } from "routes/github/create-branch/github-create-branch-get";
import reposFixture from "fixtures/api/graphql/repositories.json";
import _ from "lodash";
import { RepoSyncState } from "models/reposyncstate";
import { encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Installation } from "models/installation";

const REPOS_FIXTURE_EXPANDED = _.cloneDeep(reposFixture);
REPOS_FIXTURE_EXPANDED.data.viewer.repositories.edges = [];
for (let i = 0; i < 100; i++) {
	REPOS_FIXTURE_EXPANDED.data.viewer.repositories.edges.push({
		node: {
			id: 1000 + i,
			name: `SampleRepo${i}`,
			full_name: `user1/SampleRepo${i}`,
			owner: {
				login: "user1"
			},
			html_url: `https://github.com/user1/SampleRepo${i}`,
			updated_at: new Date(i * 1000).toISOString()
		}
	});
}
REPOS_FIXTURE_EXPANDED.data.viewer.repositories.totalCount = REPOS_FIXTURE_EXPANDED.data.viewer.repositories.edges.length;

describe("GitHub Create Branch Get", () => {
	let app: Application;
	beforeEach(() => {
		app = getFrontendApp();
	});
	describe("Testing the GET route", () => {
		let subscription: Subscription;
		let installation: Installation;
		beforeEach(async () => {
			const result = await new DatabaseStateCreator().create();
			installation = result.installation;
			subscription = result.subscription;
		});

		const generateJwt = async () => {
			return encodeSymmetric({
				qsh: "context-qsh",
				iss: installation.plainClientKey
			}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
		};

		it("returns 401 when no JWT was passed", async () => {
			const response = await supertest(app)
				.get("/github/create-branch")
				.query({
					jiraHost: installation.jiraHost
				});
			expect(response.status).toBe(401);
		});

		describe("happy path supertest", () => {
			beforeEach(async () => {
				githubNock
					.post(`/app/installations/${subscription.gitHubInstallationId}/access_tokens`)
					.reply(200);

				githubNock
					.post("/graphql", { query: GetRepositoriesQuery, variables: { per_page: 100, order_by: "UPDATED_AT" } })
					.reply(200, REPOS_FIXTURE_EXPANDED);
			});

			it("render create branch when JWT token is passed and populates jiraHost in session", async () => {
				const response = await supertest(app)
					.get("/github/create-branch")
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.query({
						jwt: await generateJwt(),
						issueKey: "TEST-123"
					});

				const { session } = parseCookiesAndSession(response);
				expect(response.status).toBe(200);
				expect(session.jiraHost).toStrictEqual(installation.jiraHost);
				expect(response.text).toContain("<div class=\"gitHubCreateBranch__header\">Create GitHub Branch</div>");
			});

			it("should limit the number of repos to 20", async () => {
				await Promise.all(REPOS_FIXTURE_EXPANDED.data.viewer.repositories.edges.map(async (edge) =>
					RepoSyncState.create({
						subscriptionId: subscription.id,
						repoId: edge.node.id,
						repoName: edge.node.name,
						repoOwner: edge.node.owner.login,
						repoFullName: edge.node.full_name,
						repoUrl: edge.node.html_url
					})
				));
				const response = await supertest(app)
					.get("/github/create-branch")
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost
						}))
					.query({
						issueKey: "TEST-123"
					});

				expect(response.status).toBe(200);
				expect(response.text.split("SampleRepo")).toHaveLength(21); // not 20 because this is how .spit() works
			});

			it("should exclude repos that are not connected", async () => {
				const response = await supertest(app)
					.get("/github/create-branch").set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost
						}))
					.query({
						issueKey: "TEST-123"
					});

				expect(response.status).toBe(200);
				expect(response.text).not.toContain("hidden default-repos");
				expect(response.text).not.toContain("SampleRepo");
			});
		});
	});

	describe("GenerateBranchName", () => {
		it("should return just the issue key when no issuesummary", () => {
			expect(generateBranchName("ISSUEKEY", "")).toEqual("ISSUEKEY");
		});
		it("should replace spaces with hyphens", async () => {
			expect(generateBranchName("ISSUEKEY", "issue summary with spaces")).toBe("ISSUEKEY-issue-summary-with-spaces");
		});
		it("should replace slashes with hyphens", async () => {
			expect(generateBranchName("ISSUEKEY", "issue/summary/with/slashes/yo")).toBe("ISSUEKEY-issue-summary-with-slashes-yo");
		});
		it("should replace special characters with hypen(exld exempt special chars)", () => {
			expect(generateBranchName("ISSUEKEY", "A!B#CAT")).toEqual("ISSUEKEY-A-B-CAT");
		});
		it("should not replace exempt special characters with hypen", () => {
			expect(generateBranchName("ISSUEKEY", "CAT-._88")).toEqual("ISSUEKEY-CAT-._88");
		});
		it("should replace leading special characters with nothing", () => {
			expect(generateBranchName("ISSUEKEY", "/test/")).toEqual("ISSUEKEY-test");
		});
		it("should replace repeating hypens to a single hyphen", async () => {
			expect(generateBranchName("ISSUEKEY", "issue//////summary------with$$$$$$////slashes//yo")).toBe("ISSUEKEY-issue-summary-with-slashes-yo");
		});

	});
});
