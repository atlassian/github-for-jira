import { AuditInfo, saveAuditLog } from "../../services/audit-log-service";
import { isArray, isObject } from "lodash";
import {
	JiraBuild,
	JiraSubmitOptions
} from "interfaces/jira";
import Logger from "bunyan";

const getAuditInfo = ({
	acceptedGithubEntities,
	repoFullName,
	repoEntities,
	githubEntityType,
	options
}) => {
	const auditInfo: Array<AuditInfo> = [];
	const createdAt = new Date();
	acceptedGithubEntities.map((githubEntityId) => {
		const repoEntity = repoEntities.find(({ id }) => id.toString() === githubEntityId);
		const issueKeys = repoEntity?.issueKeys;
		issueKeys.map((issueKey) => {
			const obj: AuditInfo = {
				createdAt,
				entityId: `${repoFullName}_${githubEntityId}`,
				entityType: githubEntityType,
				issueKey,
				subscriptionId: options?.subscriptionId,
				source: options?.auditLogsource || "WEBHOOK",
				entityAction: options?.entityAction || "null"
			};
			if (obj.subscriptionId && obj.entityId) {
				auditInfo.push(obj);
			}
		});
	});
	return auditInfo;
};

export const processBatchedBulkUpdateResp = ({
	reqRepoData,
	response,
	options,
	logger
}): {
	isSuccess: boolean;
	auditInfo?: Array<AuditInfo>;
} => {
	try {
		const isSuccess = response?.status === 202;
		const acceptedDevinfoEntities =
			response?.data && response?.data?.acceptedDevinfoEntities;
		const hasAcceptedDevinfoEntities =
			isObject(acceptedDevinfoEntities) &&
			Object.keys(acceptedDevinfoEntities).length > 0;
		let auditInfo: Array<AuditInfo> = [];
		if (isSuccess && hasAcceptedDevinfoEntities) {
			const repoData = reqRepoData;
			const acceptedDevinfoRepoID = repoData.id;
			const { commits, branches, pullRequests } =
				acceptedDevinfoEntities[acceptedDevinfoRepoID];
			const hasBranches = isArray(branches) && branches.length > 0;
			const hasCommits = isArray(commits) && commits.length > 0;
			const hasPRs = isArray(pullRequests) && pullRequests.length > 0;
			if (hasCommits) {
				const commitAuditInfo = getAuditInfo({
					acceptedGithubEntities: commits,
					githubEntityType: "commits",
					repoFullName: repoData.name,
					repoEntities: repoData["commits"],
					options
				});
				auditInfo = [...auditInfo, ...commitAuditInfo];
			}
			if (hasBranches) {
				const branchAuditInfo = getAuditInfo({
					acceptedGithubEntities: branches,
					githubEntityType: "branches",
					repoFullName: repoData.name,
					repoEntities: repoData["branches"],
					options
				});
				auditInfo = [...auditInfo, ...branchAuditInfo];
			}
			if (hasPRs) {
				const PRAuditInfo = getAuditInfo({
					acceptedGithubEntities: pullRequests,
					githubEntityType: "pullRequests",
					repoFullName: repoData.name,
					repoEntities: repoData["pullRequests"],
					options
				});
				auditInfo = [...auditInfo, ...PRAuditInfo];
			}
			return { isSuccess: true, auditInfo };
		}
		return { isSuccess: false };
	} catch (error) {
		logger.error(
			{ error },
			"Failed to process batched repo bulk update api response for audit log"
		);
		return { isSuccess: false };
	}
};

export const processWorkflowSubmitResp = ({
	reqBuildDataArray,
	repoFullName,
	response,
	options,
	logger
}: {
	reqBuildDataArray: JiraBuild[],
	repoFullName: string,
	response: { status: number, data: any },
	options: JiraSubmitOptions,
	logger: Logger
}): {
	isSuccess: boolean;
	auditInfo?: Array<AuditInfo>;
} => {
	try {
		const isSuccess = response?.status === 202;
		const acceptedBuilds =
			response?.data && response?.data?.acceptedBuilds;
		const hasAcceptedBuilds =
			isArray(acceptedBuilds) &&
			acceptedBuilds.length > 0;
		const auditInfo: Array<AuditInfo> = [];
		if (isSuccess && hasAcceptedBuilds) {
			reqBuildDataArray.forEach((reqBuildData) => {
				const reqBuildNo = reqBuildData.buildNumber;
				const reqBuildPipelineId = reqBuildData.pipelineId;
				const createdAt = new Date();
				const acceptedBuildFound = acceptedBuilds.some(acceptedBuild => acceptedBuild?.buildNumber.toString() === reqBuildNo.toString() && acceptedBuild.pipelineId.toString() === reqBuildPipelineId.toString());
				if (acceptedBuildFound) {
					const issueKeys = reqBuildData?.issueKeys;
					issueKeys.map((issueKey) => {
						const obj: AuditInfo = {
							createdAt,
							entityId: `${repoFullName}_${reqBuildPipelineId}_${reqBuildNo}`,
							entityType: "builds",
							issueKey,
							subscriptionId: options.subscriptionId,
							source: options.auditLogsource || "WEBHOOK",
							entityAction: (reqBuildData.state || "").toUpperCase()
						};
						if (obj.subscriptionId && obj.entityId) {
							auditInfo.push(obj);
						}
					});
				}
			});
			return { isSuccess: true, auditInfo };
		}
		return { isSuccess: false };
	} catch (error) {
		logger.error(
			{ error },
			"Failed to process batched build bulk update api response for audit log"
		);
		return { isSuccess: false };
	}
};
export const processAuditLogsForDevInfoBulkUpdate = ({ reqRepoData, response, options, logger }) => {
	try {
		const { isSuccess, auditInfo } = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger
		});
		if (isSuccess) {
			auditInfo?.map(async (auditInf) => {
				await saveAuditLog(auditInf, logger);
			});
		} else {
			logger.error("the DD devInfo update api call failed for all github entities!");
		}
	} catch (error) {
		logger.error({ error }, "Failed to log DD devInfo update api call success");
	}
};

export const processAuditLogsForWorkflowSubmit = (
	{ reqBuildDataArray, repoFullName, response, options, logger }: {
		reqBuildDataArray: JiraBuild[],
		repoFullName: string,
		response: { status: number, data: any },
		options: JiraSubmitOptions,
		logger: Logger
	}
) => {
	try {

		if (!options) {
			logger.debug("Skip sending to audit log as options are undefined");
		}

		const { isSuccess, auditInfo } = processWorkflowSubmitResp({
			reqBuildDataArray,
			repoFullName,
			response,
			options: options,
			logger
		});
		if (isSuccess) {
			auditInfo?.map(async (auditInf) => {
				await saveAuditLog(auditInf, logger);
			});
		} else {
			logger.error("the DD build update api call failed!");
		}
	} catch (error) {
		logger.error({ error }, "Failed to log DD build update api call success");
	}
};
