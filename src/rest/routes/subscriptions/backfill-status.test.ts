import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import supertest from "supertest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import { RepoSyncState } from "models/reposyncstate";

jest.mock("config/feature-flags");

describe("jira-get-connections-backfillStatus.test", () => {
	let app;
	let installation: Installation;
	let subscription: Subscription;
	let repoSyncState: RepoSyncState;
	const generateJwt = async () => {
		return encodeSymmetric(
			{
				qsh: "context-qsh",
				iss: installation.plainClientKey,
				sub: "myAccountId"
			},
			await installation.decrypt("encryptedSharedSecret", getLogger("test"))
		);
	};

	beforeEach(async () => {
		app = getFrontendApp();
		const result = await new DatabaseStateCreator()
			.withActiveRepoSyncState()
			.create();
		installation = result.installation;
		subscription = result.subscription;
		repoSyncState = result.repoSyncState!;
		when(booleanFlag)
			.calledWith(BooleanFlags.JIRA_ADMIN_CHECK)
			.mockResolvedValue(true);
	});

	it("should return 401 when no JWT was provided", async () => {
		const resp = await supertest(app).get(
			`/rest/subscriptions/backfill-status?subscriptionIds=${subscription.id}`
		);
		expect(resp.status).toStrictEqual(401);
		expect(resp.text).toBe("Unauthorised");
	});

	it("should return 403 when not an admin", async () => {
		const resp = await supertest(app)
			.get(
				`/rest/subscriptions/backfill-status?subscriptionIds=${subscription.id}`
			)
			.set(
				"authorization",
				`JWT ${await generateJwt()}`
			);
		expect(resp.status).toStrictEqual(403);
	});

	describe("admin and JWT are OK", () => {
		beforeEach(() => {
			const payload = {
				accountId: "myAccountId",
				globalPermissions: ["ADMINISTER"]
			};
			jiraNock
				.post("/rest/api/latest/permissions/check", payload)
				.reply(200, { globalPermissions: ["ADMINISTER"] });
		});

		it("should return 400 when no subscriptions were found", async () => {
			const resp = await supertest(app)
				.get(
					`/rest/subscriptions/backfill-status?subscriptionIds=${
						subscription.id + 1
					}`
				)
				.set(
					"authorization",
					`JWT ${await generateJwt()}`
				);
			expect(resp.status).toStrictEqual(400);
		});

		it("should return 400 when no Missing Subscription IDs were found in query", async () => {
			const resp = await supertest(app)
				.get(`/rest/subscriptions/backfill-status`)
				.set("authorization", `JWT ${await generateJwt()}`);
			expect(resp.status).toStrictEqual(400);
			expect(resp.text).toBe("Missing Subscription IDs");
		});

		it("should return 403 if the subscription belongs to a different user", async () => {
			const result = await new DatabaseStateCreator()
				.forJiraHost("https://another-one.atlassian.net")
				.create();
			const resp = await supertest(app)
				.get(
					`/rest/subscriptions/backfill-status?subscriptionIds=${result.subscription.id}`
				)
				.set(
					"authorization",
					`JWT ${await generateJwt()}`
				);

			expect(resp.status).toStrictEqual(403);
		});

		it("should return 200 if the subscription belongs to the same user", async () => {
			const resp = await supertest(app)
				.get(
					`/rest/subscriptions/backfill-status?subscriptionIds=${subscription.id}`
				)
				.set(
					"authorization",
					`JWT ${await generateJwt()}`
				);
			expect(resp.status).toStrictEqual(200);
		});

		describe("happy paths", () => {
			beforeEach(async () => {
				const newRepoSyncStatesData: any[] = [];
				for (let newRepoStateNo = 1; newRepoStateNo < 50; newRepoStateNo++) {
					const newRepoSyncState = { ...repoSyncState.dataValues };
					newRepoSyncState["repoId"] = repoSyncState.repoId + newRepoStateNo;
					newRepoSyncState["repoName"] =
						repoSyncState.repoName + newRepoStateNo.toString();
					newRepoSyncState["repoFullName"] =
						repoSyncState.repoFullName +
						String(newRepoStateNo).padStart(3, "0");
					if (newRepoStateNo === 1) {
						newRepoSyncState["commitStatus"] = "pending";
						newRepoSyncState["branchStatus"] = "complete";
						newRepoSyncState["pullStatus"] = "complete";
						newRepoSyncState["buildStatus"] = "complete";
						newRepoSyncState["deploymentStatus"] = "pending";
					} else if (newRepoStateNo % 3 == 1) {
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

			it("should return 200 if the subscription belongs to the same user", async () => {
				const resp = await supertest(app)
					.get(
						`/rest/subscriptions/backfill-status?subscriptionIds=${subscription.id}`
					)
					.set(
						"authorization",
						`JWT ${await generateJwt()}`
					);
				expect(resp.status).toStrictEqual(200);

				expect(resp.body).toMatchObject({
					data: {
						subscriptions: {
							[subscription.id]: {
								isSyncComplete: false,
								syncStatus: "IN PROGRESS",
								totalRepos: 33,
								syncedRepos: 17,
								backfillSince: null
							}
						},
						isBackfillComplete: false,
						subscriptionIds: [subscription.id]
					}
				});
			});
		});
	});
});