import { saveIssueStatusToRedis, getIssueStatusFromRedis } from "./jira-issue-check-redis-util";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("config/feature-flags");

describe("Redis for jira issue status", () => {
	const TIMEOUT = 10_000;
	const ISSUE_KEY = "ABC-" + Math.floor(Math.random() * 10000);
	beforeEach(async () => {
		when(numberFlag).calledWith(NumberFlags.SKIP_PROCESS_QUEUE_IF_ISSUE_NOT_FOUND_TIMEOUT, expect.anything(), expect.anything())
			.mockResolvedValue(TIMEOUT);
	});
	it("should save and successfully retried last status (exist)", async () => {
		await saveIssueStatusToRedis(jiraHost, ISSUE_KEY, "exist");
		const status = await getIssueStatusFromRedis(jiraHost, ISSUE_KEY);
		expect(status).toEqual("exist");
	});
	it("should save and successfully retried last status (not-exists)", async () => {
		await saveIssueStatusToRedis(jiraHost, ISSUE_KEY, "not_exist");
		const status = await getIssueStatusFromRedis(jiraHost, ISSUE_KEY);
		expect(status).toEqual("not_exist");
	});
	it("should return null on not found status", async () => {
		const status = await getIssueStatusFromRedis(jiraHost, ISSUE_KEY);
		expect(status).toBeNull();
	});
});
