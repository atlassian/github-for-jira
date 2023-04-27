import express, { Application } from "express";
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";
import { Subscription } from "~/src/models/subscription";

const randomString = "random-string";
describe("GitHub Repository Search", () => {
	let app: Application;
	beforeEach(() => {
		app = express();
		app.use((req, _, next) => {
			req.query = { repoName: randomString, jiraHost };
			next();
		});
		app.use(getFrontendApp());
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

		it("should hit the create branch on GET if authorized", async () => {
			const gitHubInstallationId = 15;
			const orgName = "orgName";

			await Subscription.create({
				gitHubInstallationId,
				jiraHost
			});

			githubNock
				.get(`/app/installations/${gitHubInstallationId}`)
				.reply(200, { account: { login: orgName } });

			githubNock
				.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
				.reply(200);

			nockSearchRepos200(`${randomString} org:${orgName} in:name`, {
				items: [{ full_name: "first", id: 2 }, { full_name: "second", id: 1 }]
			});

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}))
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(2);
				});
		});

		it("should return repos that the installation has access to", async () => {
			const gitHubInstallationId = 15;
			const orgName = "orgName";

			await Subscription.create({
				gitHubInstallationId,
				jiraHost
			});

			githubNock
				.get(`/app/installations/${gitHubInstallationId}`)
				.reply(200, { account: { login: orgName } });

			githubNock
				.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
				.reply(200);

			nockSearchRepos200(`${randomString} org:${orgName} in:name`, {
				items: [{ full_name: "first", id: 1 }, { full_name: "second", id: 22 }, { full_name: "second" }]
			});

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}))
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(3);
					expect(res.body?.repositories[0].id).toEqual(1);
				});
		});

		it("a single error shouldn't nuke everything", async () => {
			const gitHubInstallationId = 15;
			const orgName = "orgName";

			await Subscription.create({
				gitHubInstallationId,
				jiraHost
			});

			await Subscription.create({
				gitHubInstallationId: gitHubInstallationId + 1,
				jiraHost
			});

			githubNock
				.get(`/app/installations/${gitHubInstallationId}`)
				.reply(200, { account: { login: orgName } });

			githubNock
				.get(`/app/installations/${gitHubInstallationId + 1}`)
				.reply(200, { account: { login: orgName + "1" } });

			githubNock
				.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
				.reply(200);

			githubNock
				.post(`/app/installations/${gitHubInstallationId + 1}/access_tokens`)
				.reply(200);

			nockSearchRepos200(`${randomString} org:${orgName} in:name`, {
				items: [{ full_name: "first", id: 1 }, { full_name: "second", id: 22 }, { full_name: "second" }]
			});

			nockSearchRepos422(`${randomString} org:${orgName + "1"} in:name`);

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}))
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(3);
					expect(res.body?.repositories[0].id).toEqual(1);
				});
		});
	});
});
