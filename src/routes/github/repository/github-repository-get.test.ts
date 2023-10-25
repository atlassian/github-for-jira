import { Application } from "express";
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";
import { Subscription } from "~/src/models/subscription";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Installation } from "models/installation";
import { RepoSyncState } from "models/reposyncstate";

const randomString = "random-string";
describe("GitHub Repository Search", () => {
	let app: Application;
	beforeEach(() => {
		app = getFrontendApp();
	});

	const nockSearchRepos200 = (queryString: string, result) => {
		githubNock
			.get(`/search/repositories`)
			.query({
				q: queryString,
				order: "updated" })
			.reply(200, result);
	};

	const nockSearchRepos422 = (queryString: string) => {
		githubNock
			.get(`/search/repositories`)
			.query({
				q: queryString,
				order: "updated" })
			.reply(422, { message: "fatal error" });
	};

	describe("Testing the Repository Search route", () => {
		let subscription: Subscription;
		let installation: Installation;
		beforeEach(async () => {
			const result = await new DatabaseStateCreator().create();
			installation = result.installation;
			subscription = result.subscription;

			[[1, "first"], [22, "second"], [333, "third"]].forEach(([repoId, fullName]) =>
				RepoSyncState.create({
					subscriptionId: subscription.id,
					repoId: repoId,
					repoName: fullName,
					repoOwner: "myOrgName",
					repoFullName: "fullName",
					repoUrl: "myUrl"
				}));
		});

		it("shouldn't hit the create branch on GET if not authorized", async () => {

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					"jiraHost=" + installation.jiraHost
				).query({
					jiraHost: installation.jiraHost
				})
				.expect(res => {
					expect(res.status).toBe(401);
				});
		});

		it("should return repos that the installation has access to", async () => {
			githubNock
				.get(`/app/installations/${subscription.gitHubInstallationId}`)
				.reply(200, { account: { login: "myOrgName" } });

			githubNock
				.post(`/app/installations/${subscription.gitHubInstallationId}/access_tokens`)
				.reply(200);

			const owner = { login: "myOrgName" };

			nockSearchRepos200(`${randomString} org:myOrgName in:full_name fork:true`, {
				items: [{ owner, full_name: "first", id: 1 }, { owner, full_name: "second", id: 22 }, { owner, full_name: "second", id: 333 }]
			});

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost
					}))
				.query({
					repoName: randomString
				})
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(3);
					expect(res.body?.repositories[0].id).toEqual(1);
				});
		});

		it("should not return repos that are not connected", async () => {
			githubNock
				.get(`/app/installations/${subscription.gitHubInstallationId}`)
				.reply(200, { account: { login: "myOrgName" } });

			githubNock
				.post(`/app/installations/${subscription.gitHubInstallationId}/access_tokens`)
				.reply(200);

			nockSearchRepos200(`${randomString} org:myOrgName in:full_name fork:true`, {
				items: [{ full_name: "forth", id: 4444 }]
			});

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost
					}))
				.query({
					repoName: randomString
				})
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(0);
				});
		});

		it("a single error shouldn't nuke everything", async () => {
			await Subscription.create({
				gitHubInstallationId: subscription.gitHubInstallationId + 1,
				jiraHost
			});

			githubNock
				.get(`/app/installations/${subscription.gitHubInstallationId}`)
				.reply(200, { account: { login: "myOrgName" } });

			githubNock
				.get(`/app/installations/${subscription.gitHubInstallationId + 1}`)
				.reply(200, { account: { login: "anotherOrgName" } });

			githubNock
				.post(`/app/installations/${subscription.gitHubInstallationId}/access_tokens`)
				.reply(200);

			githubNock
				.post(`/app/installations/${subscription.gitHubInstallationId + 1}/access_tokens`)
				.reply(200);

			const owner = { login: "myOrgName" };

			nockSearchRepos200(`${randomString} org:myOrgName in:full_name fork:true`, {
				items: [{ owner, full_name: "first", id: 1 }, { owner, full_name: "second", id: 22 }, { owner, full_name: "third", id: 333 }]
			});

			nockSearchRepos422(`${randomString} org:anotherOrgName in:full_name fork:true`);

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost
					}))
				.query({
					repoName: randomString
				})
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(3);
					expect(res.body?.repositories[0].id).toEqual(1);
				});
		});
	});
});
