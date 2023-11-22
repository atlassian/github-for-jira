import supertest from "supertest";
import { when } from "jest-when";
import { omit } from "lodash";
import { getFrontendApp } from "../../../app";
import { DatabaseStateCreator, CreatorResult } from "test/utils/database-state-creator";
import { findLog } from "services/audit-log-service";

jest.mock("services/audit-log-service");

describe("AuditLogApiGetBySubscriptionId", () => {

	const makeApiCall = (subscriptionId: string | number, params: Record<string, unknown>) => {
		return supertest(getFrontendApp())
			.get(`/api/audit-log/subscription/${subscriptionId}`)
			.query(params)
			.set("X-Slauth-Mechanism", "test")
			.send();
	};

	let db: CreatorResult;
	let params;

	beforeEach(async () => {
		db = await new DatabaseStateCreator().forServer().create();
		params = {
			issueKey: "ABC-123",
			entityType: "commit",
			entityId: "abcd-efgh-ijkl"
		};
	});

	describe.each(["issueKey", "entityType", "entityId"])("param validation", (paramKey) => {
		it(`should return 422 on missing param ${paramKey}`, async () => {
			await makeApiCall(db.subscription.id, omit(params, paramKey))
				.expect(422);
		});
	});

	it(`should return error on missing subscription`, async () => {
		await makeApiCall(db.subscription.id + 1, params)
			.expect(500);
	});


	it("should return audit log data successfully", async () => {

		when(findLog).calledWith({
			subscriptionId: db.subscription.id,
			issueKey: "ABC-123",
			entityType: "commit",
			entityId: "abcd-efgh-ijkl"
		}, expect.anything()).mockResolvedValue({
			name: "hello"
		} as any);

		const result = await makeApiCall(db.subscription.id, params).expect(200);

		expect(result.body).toEqual({
			name: "hello"
		});
	});
});
