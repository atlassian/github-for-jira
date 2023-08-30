import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import supertest from "supertest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("config/feature-flags");

describe("jira-connected-repos-get", () => {

	let app;
	let installation: Installation;
	let subscription: Subscription;
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
		const result = (await new DatabaseStateCreator().create());
		installation = result.installation;
		subscription = result.subscription;

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

		// TODO
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		it("should return the first page of repos by default without any filters", ()=> {

		});

		// TODO
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		it("should correctly apply repoSearch filter", () => {

		});

		// TODO
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		it("should correctly apply pagination", () => {

		});
	});

});
