import IORedis  from "ioredis";
import { getRedisInfo } from "config/redis-info";
import { numberFlag, NumberFlags } from "config/feature-flags";

//five seconds
const REDIS_CLEANUP_TIMEOUT = 5 * 1000;

const redis = new IORedis(getRedisInfo("JiraIssueStatusStorage"));

export const saveIssueStatusToRedis = async (
	jiraHost: string,
	issueKey: string,
	status: "exist" | "not_exist"
) => {
	const key = getKey(jiraHost, issueKey);
	const timeout = await numberFlag(NumberFlags.SKIP_PROCESS_QUEUE_IF_ISSUE_NOT_FOUND_TIMEOUT, REDIS_CLEANUP_TIMEOUT, jiraHost);
	await redis.set(key, status, "px", timeout);
};

export const getIssueStatusFromRedis = async (
	jiraHost: string,
	issueKey: string
): Promise<"exist" | "not_exist" | null> => {
	const key = getKey(jiraHost, issueKey);
	const status = await redis.get(key);
	return status as "exist" | "not_exist" | null;
};

const getKey = (jiraHost: string, issueKey: string) => {
	return `jiraHost_${jiraHost}_issueKey_${issueKey}`;
};
