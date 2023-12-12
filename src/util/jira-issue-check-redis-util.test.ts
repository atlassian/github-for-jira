import { saveIssueStatusToRedis, getIssueStatusFromRedis } from "./jira-issue-check-redis-util";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("config/feature-flags");

describe("Redis for jira issue status", () => {
	const TIMEOUT = 10_000;
	let issueKey: string;
	beforeEach(async () => {
		when(numberFlag).calledWith(NumberFlags.SKIP_PROCESS_QUEUE_IF_ISSUE_NOT_FOUND_TIMEOUT, expect.anything(), expect.anything())
			.mockResolvedValue(TIMEOUT);
		issueKey = "ABC-" + Math.floor(Math.random() * 10000);
	});
	it("should save and successfully retried last status (exist)", async () => {
		await saveIssueStatusToRedis(jiraHost, issueKey, "exist");
		const status = await getIssueStatusFromRedis(jiraHost, issueKey);
		expect(status).toEqual("exist");
	});
	it("should save and successfully retried last status (not-exists)", async () => {
		await saveIssueStatusToRedis(jiraHost, issueKey, "not_exist");
		const status = await getIssueStatusFromRedis(jiraHost, issueKey);
		expect(status).toEqual("not_exist");
	});
	it("should return null on not found status", async () => {
		const status = await getIssueStatusFromRedis(jiraHost, issueKey);
		expect(status).toBeNull();
	});
});
