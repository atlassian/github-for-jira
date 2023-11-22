import { AuditInfo, auditLog } from "../../services/audit-log-service";
import { isArray, isObject } from "lodash";

const getRepoData = (repoId,request) =>{
	const repositories = request["repositories"] || null;
	const acceptedDevinfoEntityData = repositories?.find(({ id })=>id===repoId);
	return acceptedDevinfoEntityData;
};

const getAuditInfo = ({
	acceptedGithubEntities,
	repoEntities,
	githubEntityType,
	options
}) => {
	const auditInfo: Array<AuditInfo> = [];
	const createdAt = new Date();
	acceptedGithubEntities.map((githubEntityId) => {
		// const repoEntities = repoData?.[githubEntityType];
		const repoEntity = repoEntities.find(({ id }) => id === githubEntityId);
		const issueKeys = repoEntity.issueKeys;
		issueKeys.map((issueKey) => {
			const obj: AuditInfo = {
				createdAt,
				entityId: githubEntityId,
				entityType: githubEntityType,
				issueKey,
				subscriptionId: options?.subscriptionId,
				source: options?.operationType || "NORMAL",
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
	request,
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
		const hasAcceptedDevinfoEntities = isObject(acceptedDevinfoEntities) && Object.keys(acceptedDevinfoEntities).length > 0;
		let auditInfo: Array<AuditInfo> = [];
		if (isSuccess && hasAcceptedDevinfoEntities) {
			Object.keys(acceptedDevinfoEntities).forEach(
				(acceptedDevinfoEntityID) => {
					const { commits, branches, pullRequests } =
						acceptedDevinfoEntities[acceptedDevinfoEntityID];
					const hasBranches = isArray(branches);
					const hasCommits = isArray(commits);
					const hasPRs = isArray(pullRequests);
					let repoData;
					if (hasBranches || hasCommits || hasPRs) {
						repoData = getRepoData(acceptedDevinfoEntityID, request);
					}
					// commits
					if (hasCommits) {
						const commitAuditInfo = getAuditInfo({
							acceptedGithubEntities: commits,
							githubEntityType: "commits",
							repoEntities:repoData["commits"],
							options
						});
						auditInfo = [...auditInfo, ...commitAuditInfo];
					}

					// branches
					if (hasBranches) {
						const branchAuditInfo = getAuditInfo({
							acceptedGithubEntities: branches,
							githubEntityType: "branches",
							repoEntities:repoData["branches"],
							options
						});
						auditInfo = [...auditInfo, ...branchAuditInfo];
					}

					// prs
					if (hasPRs) {
						const PRAuditInfo = getAuditInfo({
							acceptedGithubEntities: pullRequests,
							githubEntityType: "pullRequests",
							repoEntities:repoData["pullRequests"],
							options
						});
						auditInfo = [...auditInfo, ...PRAuditInfo];
					}
				}
			);
			return { isSuccess: true, auditInfo };
		}
		return { isSuccess: false };
	} catch (error) {
		logger.error({ error }, "Failed to process batched bulk update api response for audit log");
		return { isSuccess: false };
	}
};
export const processAuditLogs = ({ request, response, options, logger }) => {
	try {
		const { isSuccess, auditInfo } = processBatchedBulkUpdateResp({
			request,
			response,
			options,
			logger
		});
		if (isSuccess) {
			auditInfo?.map(async (auditInf) => {
				await auditLog(auditInf, logger);
			});
		} else {
			logger.error("the DD api call failed for all github entities!");
		}
	} catch (error) {
		logger.error({ error }, "Failed to log DD api call success");
	}
};