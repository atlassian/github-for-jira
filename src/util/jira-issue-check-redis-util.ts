import IORedis  from "ioredis";
import { getRedisInfo } from "config/redis-info";

//five seconds
const REDIS_CLEANUP_TIMEOUT = 5 * 1000;

const redis = new IORedis(getRedisInfo("JiraIssueStatusStorage"));

export const saveIssueStatusToRedis = async (
	jiraHost: string,
	issueKey: string,
	status: "exist" | "not_exist"
) => {
	const key = getKey(jiraHost, issueKey);
	await redis.set(key, status, "px", REDIS_CLEANUP_TIMEOUT);
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
