import { getFrontendApp } from "~/src/app";
import { Browser, chromium, Page } from "playwright";
import { Application } from "express";
import { Server } from "http";
import { Installation } from "models/installation";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";
import { Subscription } from "models/subscription";
import reposFixture from "fixtures/api/graphql/repositories.json";
import { RepoSyncState } from "models/reposyncstate";
import { BrowserContext } from "@playwright/test";
import { generateSignedSessionCookie } from "test/utils/cookies";
describe("github-create-branch-post.frontend", () => {

	let app: Application;
	const port = 3000;
	let server: Server;
	let browser: Browser;
	let context: BrowserContext;
	let page: Page;

	beforeAll(async () => {
		app = getFrontendApp();
		server = app.listen(port);

		const options = {
			// headless: false, slowMo: 100  // uncomment for debugging
		};
		browser = await chromium.launch(options);
		context = await browser.newContext();
		page = await context.newPage();
	});

	afterAll(async () => {
		await browser.close();

		server.close();
	});

	describe("server", () => {
		let installation: Installation;
		let subscription: Subscription;
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator().forServer().create());
			installation = result.installation;
			subscription = result.subscription;
			gitHubServerApp = result.gitHubServerApp!;

			await Promise.all(reposFixture.data.viewer.repositories.edges.map(async (edge) =>
				RepoSyncState.create({
					subscriptionId: subscription.id,
					repoId: edge.node.id,
					repoName: edge.node.name,
					repoOwner: edge.node.owner.login,
					repoFullName: edge.node.full_name,
					repoUrl: edge.node.html_url
				})
			));

			const cookie = generateSignedSessionCookie({
				jiraHost: installation.jiraHost
			});
			await context.addCookies([
				{
					name: "session",
					value: cookie.session,
					domain: "localhost",
					path: "/"
				},
				{
					name: "session.sig",
					value: cookie.sessionSig,
					domain: "localhost",
					path: "/"
				}
			]);
		});

		const expandSelector = async (text: string) => {
			const elementWithTextLocator = await page.locator(`span.select2-chosen:has-text("${text}")`);
			const element = await elementWithTextLocator.elementHandle();

			const parentAnchor = (await page.evaluateHandle((span) => {
				const parentAElement = span!.closest("a");
				return parentAElement;
			}, element))!;

			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			await parentAnchor.click();

			// await page.keyboard.type("Your desired text");
		};

		const expandRepoSelector = async () => expandSelector("Select a repository");

		const selectRepo = async (repoFullName: string) => {
			const elementWithTextLocator = await page.locator(`li.select2-result-selectable:has-text("${repoFullName}")`);
			const element = await elementWithTextLocator.elementHandle();
			await element!.click();
		};

		describe("with pre-loaded repo", () => {

			it("should successfully create a branch", async () => {
				gheApiNock
					.post(`/app/installations/${subscription.gitHubInstallationId}/access_tokens`)
					.reply(200).persist();

				gheNock
					.post("/api/graphql", { query: GetRepositoriesQuery, variables: { per_page: 100, order_by: "UPDATED_AT" } })
					.reply(200, reposFixture);

				gheApiNock
					.get(`/repos/user1/SampleRepo1/branches?per_page=100`)
					.reply(200, [{
						name: "branch1"
					}, {
						name: "main"
					}]);

				gheApiNock
					.get("/repos/user1/SampleRepo1/git/refs/heads/branch1")
					.reply(200, {
						object: {
							sha: "123"
						}
					}).persist();

				gheApiNock
					.post("/repos/user1/SampleRepo1/git/refs", {
						owner: "user1",
						repo: "SampleRepo1",
						ref: `refs/heads/TEST-1`,
						sha: "123"
					})
					.reply(200);

				gheApiNock
					.get(`/repos/user1/SampleRepo1`)
					.reply(200, {
						default_branch: "main"
					});

				await page.goto(
					`http://localhost:3000/github/${gitHubServerApp.uuid}/create-branch?issueKey=TEST-1`
				);

				await expandRepoSelector();
				await selectRepo("user1/SampleRepo1");

				await page.waitForSelector("text=main");

				await expandSelector("main");

				const elementWithTextLocator = await page.locator(`div.select2-result-label:has-text("branch1")`);
				const element = (await elementWithTextLocator.elementHandle())!;
				await element.click();

				await page.click("#createBranchBtn");
				await page.waitForSelector("text=Github branch created");

				expect(gheApiNock).toBeDone();
			});
		});
	});
});
