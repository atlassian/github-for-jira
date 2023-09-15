import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import supertest from "supertest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import { RepoSyncState } from "models/reposyncstate";

jest.mock("config/feature-flags");

describe("jira-connected-repos-get", () => {

	let app;
	let installation: Installation;
	let subscription: Subscription;
	let repoSyncState: RepoSyncState;
	const generateJwt = async (subscriptionId: number, query: any = {}) => {
		return encodeSymmetric({
			qsh: createQueryStringHash({
				method: "GET",
				pathname: `/jira/subscription/${subscriptionId}/repos`,
				query
			}, false),
			iss: installation.plainClientKey,
			sub: "myAccountId"
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	beforeEach(async () => {
		app = getFrontendApp();
		const result = (await new DatabaseStateCreator().withActiveRepoSyncState().create());
		installation = result.installation;
		subscription = result.subscription;
		repoSyncState = result.repoSyncState!;

		when(booleanFlag).calledWith(BooleanFlags.JIRA_ADMIN_CHECK).mockResolvedValue(true);
	});

	it("should return 403 when not an admin", async () => {
		const resp = await supertest(app)
			.get(`/jira/subscription/${subscription.id + 1}/repos`)
			.set("authorization", `JWT ${await generateJwt(subscription.id + 1)}`);
		expect(resp.status).toStrictEqual(403);
	});

	it("should return 401 when no JWT was provided", async () => {
		const resp = await supertest(app)
			.get(`/jira/subscription/${subscription.id + 1}/repos`);
		expect(resp.status).toStrictEqual(401);
	});

	describe("admin and JWT are OK", () => {
		beforeEach(() => {
			const payload = {
				accountId: "myAccountId",
				globalPermissions: [
					"ADMINISTER"
				]
			};
			jiraNock
				.post("/rest/api/latest/permissions/check", payload)
				.reply(200, { globalPermissions: ["ADMINISTER"] });
		});

		it("should return 400 when no subscription was found", async () => {
			const resp = await supertest(app)
				.get(`/jira/subscription/${subscription.id + 1}/repos`)
				.set("authorization", `JWT ${await generateJwt(subscription.id + 1)}`);
			expect(resp.status).toStrictEqual(400);
		});

		it("should return 400 if the subscription belongs to a different user", async () => {
			const result = await new DatabaseStateCreator().forJiraHost("https://another-one.atlassian.net").create();
			const resp = await supertest(app)
				.get(`/jira/subscription/${result.subscription.id}/repos`)
				.set("authorization", `JWT ${await generateJwt(result.subscription.id)}`);
			expect(resp.status).toStrictEqual(400);
		});

		it("should return 400 when unknown filtered status was provided", async () => {
			const resp = await supertest(app)
				.get(`/jira/subscription/${subscription.id}/repos?syncStatus=blah`)
				.set("authorization", `JWT ${await generateJwt(subscription.id, { syncStatus: "blah" })}`);
			expect(resp.status).toStrictEqual(400);
		});

		it("should return 400 when a page size is too great", async () => {
			const resp = await supertest(app)
				.get(`/jira/subscription/${subscription.id}/repos?pageSize=50000`)
				.set("authorization", `JWT ${await generateJwt(subscription.id, { pageSize: "50000" })}`);
			expect(resp.status).toStrictEqual(400);
		});

		describe("happy paths", () => {
			beforeEach(async () => {
				const newRepoSyncStatesData: any[] = [];
				for (let newRepoStateNo = 1; newRepoStateNo < 50; newRepoStateNo++) {
					const newRepoSyncState = { ...repoSyncState.dataValues };
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					delete newRepoSyncState["id"];
					delete newRepoSyncState["commitStatus"];
					delete newRepoSyncState["branchStatus"];
					newRepoSyncState["repoId"] = repoSyncState.repoId + newRepoStateNo;
					newRepoSyncState["repoName"] = repoSyncState.repoName + newRepoStateNo.toString();
					newRepoSyncState["repoFullName"] = repoSyncState.repoFullName + String(newRepoStateNo).padStart(3, "0");
					if (newRepoStateNo % 3 == 1) {
						newRepoSyncState["commitStatus"] = "complete";
						newRepoSyncState["branchStatus"] = "complete";
						newRepoSyncState["pullStatus"] = "complete";
						newRepoSyncState["buildStatus"] = "complete";
						newRepoSyncState["deploymentStatus"] = "complete";
					} else if (newRepoStateNo % 3 == 2) {
						newRepoSyncState["commitStatus"] = "failed";
						newRepoSyncState["branchStatus"] = "complete";
						newRepoSyncState["pullStatus"] = "complete";
						newRepoSyncState["buildStatus"] = "complete";
						newRepoSyncState["deploymentStatus"] = "failed";
					}
					newRepoSyncStatesData.push(newRepoSyncState);
				}
				await RepoSyncState.bulkCreate(newRepoSyncStatesData);
			});

			it("should return the first page of repos by default without any filters", async ()=> {
				const resp = await supertest(app)
					.get(`/jira/subscription/${subscription.id}/repos`)
					.set("authorization", `JWT ${await generateJwt(subscription.id)}`);
				expect(resp.status).toStrictEqual(200);
				expect(resp.text).toContain("<div class=\"page-num-link page-selector\" data-page-num=\"5\">5</div>");
				expect(resp.text).not.toContain("<div class=\"page-num-link page-selector\" data-page-num=\"6\">6</div>");
				expect(resp.text).toContain("test-repo-name006");
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__in-progress");
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__failed");
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__finished");
			});

			it("should correctly apply repoSearch filter", async () => {
				const resp = await supertest(app)
					.get(`/jira/subscription/${subscription.id}/repos?repoName=est-repo-name048`)
					.set("authorization", `JWT ${await generateJwt(subscription.id, { repoName: "est-repo-name048" })}`);
				expect(resp.status).toStrictEqual(200);
				expect(resp.text).toContain("test-repo-name048");
				expect(resp.text).not.toContain("<div class=\"page-num-link page-selector\" data-page-num=\"2\">2</div>");
			});

			it("should correctly apply all status filter", async () => {
				const resp = await supertest(app)
					.get(`/jira/subscription/${subscription.id}/repos?syncStatus=all`)
					.set("authorization", `JWT ${await generateJwt(subscription.id, { syncStatus: "all" })}`);
				expect(resp.status).toStrictEqual(200);
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__in-progress");
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__failed");
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__finished");
			});

			it("should correctly apply pending status filter", async () => {
				const resp = await supertest(app)
					.get(`/jira/subscription/${subscription.id}/repos?syncStatus=pending`)
					.set("authorization", `JWT ${await generateJwt(subscription.id, { syncStatus: "pending" })}`);
				expect(resp.status).toStrictEqual(200);
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__in-progress");
				expect(resp.text).not.toContain("<span class=\"jiraConnectedRepos__table__failed");
				expect(resp.text).not.toContain("<span class=\"jiraConnectedRepos__table__finished");
			});

			it("should correctly apply failed status filter", async () => {
				const resp = await supertest(app)
					.get(`/jira/subscription/${subscription.id}/repos?syncStatus=failed`)
					.set("authorization", `JWT ${await generateJwt(subscription.id, { syncStatus: "failed" })}`);
				expect(resp.status).toStrictEqual(200);
				expect(resp.text).not.toContain("<span class=\"jiraConnectedRepos__table__in-progress");
				expect(resp.text).toContain("<span class=\"jiraConnectedRepos__table__failed");
				expect(resp.text).not.toContain("<span class=\"jiraConnectedRepos__table__finished");
			});

			it("should correctly apply pagination", async () => {
				const resp = await supertest(app)
					.get(`/jira/subscription/${subscription.id}/repos?pageNumber=2`)
					.set("authorization", `JWT ${await generateJwt(subscription.id, { pageNumber: "2" })}`);
				expect(resp.status).toStrictEqual(200);
				expect(resp.text).not.toContain("test-repo-name006");
				expect(resp.text).toContain("test-repo-name016");
			});
		});
	});

});
