import { Subscription } from "models/subscription";

const GITHUHB_INSTALLATION_ID = 123;

// TODO: add rest of tests, use jira issue ARC-1580
describe("Subscription", () => {

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId: GITHUHB_INSTALLATION_ID,
			jiraHost,
			jiraClientKey: "myClientKey"
		});
	});

	describe("Fetching subscription for mix of cloud and ghe with conflicting gitHubInstallationId", () => {
		const GHEH_GITHUB_SERVER_APP_PK_ID_1 = 10001;
		const GHEH_GITHUB_SERVER_APP_PK_ID_2 = 10002;
		beforeEach(async () => {
			await Subscription.create({
				gitHubInstallationId: GITHUHB_INSTALLATION_ID,
				gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1,
				jiraHost,
				jiraClientKey: "myClientKey_ghe_1"
			});
			await Subscription.create({
				gitHubInstallationId: GITHUHB_INSTALLATION_ID,
				gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_2,
				jiraHost,
				jiraClientKey: "myClientKey_ghe_2"
			});
		});
		describe("getAllForHost", () => {
			it("should get all cloud and server records when only jiraHost is passed", async () => {
				const records = await Subscription.getAllForHost(jiraHost);
				expect(records.length).toBe(3);
				expect(records[0]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					jiraHost,
					jiraClientKey: "myClientKey"
				}));
				expect(records[1]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1"
				}));
				expect(records[2]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_2,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_2"
				}));
			});
			it("should get all server records when jiraHost is passed with gitHubAppid", async () => {
				const record1 = await Subscription.getAllForHost(jiraHost, GHEH_GITHUB_SERVER_APP_PK_ID_1);
				expect(record1.length).toBe(1);
				expect(record1[0]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1"
				}));

				const record2 = await Subscription.getAllForHost(jiraHost, GHEH_GITHUB_SERVER_APP_PK_ID_2);
				expect(record2.length).toBe(1);
				expect(record2[0]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_2,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_2"
				}));
			});

		});
		describe("getAllFiltered", () => {
			it("should get for cloud record when gitHubAppId not present", async () => {
				const records = await Subscription.getAllFiltered(
					[GITHUHB_INSTALLATION_ID], []
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async () => {
				const records = await Subscription.getAllFiltered(
					[GITHUHB_INSTALLATION_ID], [], 0, undefined, undefined,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("getSingleInstallation", () => {
			it("should get for cloud record when gitHubAppId not present", async () => {
				const record = await Subscription.getSingleInstallation(
					jiraHost,
					GITHUHB_INSTALLATION_ID
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async () => {
				const record = await Subscription.getSingleInstallation(
					jiraHost,
					GITHUHB_INSTALLATION_ID,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("findOneForGitHubInstallationId", () => {
			it("should get for cloud record when gitHubAppId not present", async () => {
				const record = await Subscription.findOneForGitHubInstallationId(
					GITHUHB_INSTALLATION_ID
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async () => {
				const record = await Subscription.findOneForGitHubInstallationId(
					GITHUHB_INSTALLATION_ID,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("getAllForInstallation", () => {
			it("should only fetch cloud records when gitHubAppId not present", async () => {
				const records = await Subscription.getAllForInstallation(
					GITHUHB_INSTALLATION_ID
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should fetch correct github server app", async () => {
				const records = await Subscription.getAllForInstallation(
					GITHUHB_INSTALLATION_ID,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("uninstall", () => {
			it("should only uninstall cloud records when gitHubAppId not present", async () => {
				await Subscription.uninstall({
					host: jiraHost,
					installationId: GITHUHB_INSTALLATION_ID
				});
				const [results] = await Subscription.sequelize!.query("select * from \"Subscriptions\"");
				expect(results).toEqual([expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_1"
				}), expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_2"
				})]);
			});
			it("should uninstall correct github server app", async () => {
				await Subscription.uninstall({
					host: jiraHost,
					installationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				});
				const [results] = await Subscription.sequelize!.query("select * from \"Subscriptions\"");
				expect(results).toEqual([expect.objectContaining({
					jiraClientKey: "myClientKey"
				}), expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_2"
				})]);
			});
		});
	});

	it("should have tests in here", () => {
		// TODO: add tests
	});

	describe.skip("getAllForInstallation", () => {
		// TODO: add tests
	});

	describe.skip("findOneForGitHubInstallationId", () => {
		// TODO: add tests
	});

	describe.skip("getAllFiltered", () => {
		// TODO: add tests
	});

	describe.skip("getAllForClientKey", () => {
		// TODO: add tests
	});

	describe.skip("getSingleInstallation", () => {
		// TODO: add tests
	});

	describe.skip("getInstallationForClientKey", () => {
		// TODO: add tests
	});

	describe.skip("install", () => {
		// TODO: add tests
	});

	describe.skip("uninstall", () => {
		// TODO: add tests
	});

	describe.skip("syncStatusCounts", () => {
		// TODO: add tests
	});
});
