import { processBatchedBulkUpdateResp } from "./jira-client-audit-log-helper";
import { getLogger } from "config/logger";

describe("processAuditLogsForDevInfoBulkUpdate", () => {
	const mockLogger = getLogger("mock-logger");
	it("should return isSuccess as false when status code is anything other than 202", () => {
		const reqRepoData = {
			id: "691330555",
			name: "KamaksheeSamant/react-cods-hub",
			url: "https://github.com/KamaksheeSamant/react-cods-hub",
			updateSequenceId: 1700453687210,
			commits: [
				{
					hash: "e3fe8bf05f50f87c18611298e312217c4895747b",
					message: "KAM-1 and KAM-2",
					authorTimestamp: "2023-11-20T04:14:44Z",
					displayId: "e3fe8b",
					fileCount: 1,
					id: "e3fe8bf05f50f87c18611298e312217c4895747b",
					issueKeys: ["KAM-1", "KAM-2"],
					url: "https://github.com/KamaksheeSamant/react-cods-hub/commit/e3fe8bf05f50f87c18611298e312217c4895747b",
					updateSequenceId: 1700453687210
				}
			]
		};
		const response = {
			status: 400,
			data: {
				acceptedDevinfoEntities: {},
				failedDevinfoEntities: {},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "WEBHOOK", auditLogsource: "WEBHOOK", entityAction: "COMMIT_PUSH", subscriptionId: 1122334455 };

		const result = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: false
		});
	});
	it("should return isSuccess as false when status code is 202 but there is no acceptedDevinfoEntities", () => {
		const reqRepoData = {
			id: "691330555",
			name: "KamaksheeSamant/react-cods-hub",
			url: "https://github.com/KamaksheeSamant/react-cods-hub",
			updateSequenceId: 1700453687210,
			commits: [
				{
					hash: "e3fe8bf05f50f87c18611298e312217c4895747b",
					message: "KAM-1 and KAM-2",
					authorTimestamp: "2023-11-20T04:14:44Z",
					displayId: "e3fe8b",
					fileCount: 1,
					id: "e3fe8bf05f50f87c18611298e312217c4895747b",
					issueKeys: ["KAM-1", "KAM-2"],
					url: "https://github.com/KamaksheeSamant/react-cods-hub/commit/e3fe8bf05f50f87c18611298e312217c4895747b",
					updateSequenceId: 1700453687210
				}
			]
		};
		const response = {
			status: 202,
			data: {
				acceptedDevinfoEntities: {},
				failedDevinfoEntities: {},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "WEBHOOK", auditLogsource: "WEBHOOK",entityAction: "COMMIT_PUSH", subscriptionId: 1122334455 };

		const result = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: false
		});
	});
	it("should return isSuccess as true when status code is 202 and there are/is acceptedDevinfoEntities but the result has failedDevinfoEntities as well", () => {
		const reqRepoData = {
			id: "691330555",
			name: "KamaksheeSamant/react-cods-hub",
			url: "https://github.com/KamaksheeSamant/react-cods-hub",
			updateSequenceId: 1700453687210,
			commits: [
				{
					hash: "e3fe8bf05f50f87c18611298e312217c4895747b",
					message: "KAM-1 pl",
					authorTimestamp: "2023-11-20T04:14:44Z",
					displayId: "e3fe8b",
					fileCount: 1,
					id: "e3fe8bf05f50f87c18611298e312217c4895747b",
					issueKeys: ["KAM-1"],
					url: "https://github.com/KamaksheeSamant/react-cods-hub/commit/e3fe8bf05f50f87c18611298e312217c4895747b",
					updateSequenceId: 1700453687210
				}
			]
		};
		const response = {
			status: 202,
			data: {
				acceptedDevinfoEntities: {
					"691330555": {
						branches: [],
						commits: ["e3fe8bf05f50f87c18611298e312217c4895747b"],
						pullRequests: []
					}
				},
				failedDevinfoEntities: {
					"112233445": {
						branches: [],
						commits: ["9829bshjjhsj99sbss8611298e312217c489nsnsi"],
						pullRequests: []
					}
				},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "WEBHOOK", auditLogsource: "WEBHOOK", entityAction: "COMMIT_PUSH", subscriptionId: 11669900 };

		const result = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": expect.anything(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "e3fe8bf05f50f87c18611298e312217c4895747b",
				"entityType": "commits",
				"issueKey": "KAM-1",
				"source": "WEBHOOK",
				"subscriptionId": 11669900
			}]
		});
	});
	it("should extract the commit with 2 issue keys linked - audit info for logging", () => {
		const reqRepoData = {
			id: "691330555",
			name: "KamaksheeSamant/react-cods-hub",
			url: "https://github.com/KamaksheeSamant/react-cods-hub",
			updateSequenceId: 1700453687210,
			commits: [
				{
					hash: "e3fe8bf05f50f87c18611298e312217c4895747b",
					message: "KAM-1 and KAM-2",
					authorTimestamp: "2023-11-20T04:14:44Z",
					displayId: "e3fe8b",
					fileCount: 1,
					id: "e3fe8bf05f50f87c18611298e312217c4895747b",
					issueKeys: ["KAM-1", "KAM-2"],
					url: "https://github.com/KamaksheeSamant/react-cods-hub/commit/e3fe8bf05f50f87c18611298e312217c4895747b",
					updateSequenceId: 1700453687210
				}
			]
		};
		const response = {
			status: 202,
			data: {
				acceptedDevinfoEntities: {
					"691330555": {
						branches: [],
						commits: ["e3fe8bf05f50f87c18611298e312217c4895747b"],
						pullRequests: []
					}
				},
				failedDevinfoEntities: {},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "WEBHOOK", entityAction: "COMMIT_PUSH", subscriptionId: 1122334455 };

		const result = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": expect.anything(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "e3fe8bf05f50f87c18611298e312217c4895747b",
				"entityType": "commits",
				"issueKey": "KAM-1",
				"source": "WEBHOOK",
				"subscriptionId": 1122334455
			},
			{
				"createdAt": expect.anything(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "e3fe8bf05f50f87c18611298e312217c4895747b",
				"entityType": "commits",
				"issueKey": "KAM-2",
				"source": "WEBHOOK",
				"subscriptionId": 1122334455
			}]
		});
	});
	it("should extract the commit with 1 issue keys linked - audit info for logging", () => {
		const reqRepoData = {
			id: "691330555",
			name: "KamaksheeSamant/react-cods-hub",
			url: "https://github.com/KamaksheeSamant/react-cods-hub",
			updateSequenceId: 1700453687210,
			commits: [
				{
					hash: "e3fe8bf05f50f87c18611298e312217c4895747b",
					message: "KAM-1 pl",
					authorTimestamp: "2023-11-20T04:14:44Z",
					displayId: "e3fe8b",
					fileCount: 1,
					id: "e3fe8bf05f50f87c18611298e312217c4895747b",
					issueKeys: ["KAM-1"],
					url: "https://github.com/KamaksheeSamant/react-cods-hub/commit/e3fe8bf05f50f87c18611298e312217c4895747b",
					updateSequenceId: 1700453687210
				}
			]
		};
		const response = {
			status: 202,
			data: {
				acceptedDevinfoEntities: {
					"691330555": {
						branches: [],
						commits: ["e3fe8bf05f50f87c18611298e312217c4895747b"],
						pullRequests: []
					}
				},
				failedDevinfoEntities: {},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "WEBHOOK", auditLogsource: "WEBHOOK",  entityAction: "COMMIT_PUSH", subscriptionId: 11669900 };

		const result = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": expect.anything(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "e3fe8bf05f50f87c18611298e312217c4895747b",
				"entityType": "commits",
				"issueKey": "KAM-1",
				"source": "WEBHOOK",
				"subscriptionId": 11669900
			}]
		});
	});
	it("should extract branch - audit info for logging", () => {
		const reqRepoData = {
			id: "691330555",
			name: "KamaksheeSamant/react-cods-hub",
			url: "https://github.com/KamaksheeSamant/react-cods-hub",
			updateSequenceId: 1700453571125,
			branches: [
				{
					createPullRequestUrl:
						"https://github.com/KamaksheeSamant/react-cods-hub/compare/KAM-1-and-KAM-2?title=KAM-1-and-KAM-2&quick_pull=1",
					id: "KAM-1-and-KAM-2",
					issueKeys: ["KAM-1", "KAM-2"],
					name: "KAM-1-and-KAM-2",
					url: "https://github.com/KamaksheeSamant/react-cods-hub/tree/KAM-1-and-KAM-2",
					updateSequenceId: 1700453571126
				}
			]
		};
		const response = {
			status: 202,
			data: {
				acceptedDevinfoEntities: {
					"691330555": {
						branches: ["KAM-1-and-KAM-2"],
						commits: [],
						pullRequests: []
					}
				},
				failedDevinfoEntities: {},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "WEBHOOK", auditLogsource: "WEBHOOK",  entityAction: "COMMIT_PUSH", subscriptionId: 44558899 };

		const result = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": expect.anything(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "KAM-1-and-KAM-2",
				"entityType": "branches",
				"issueKey": "KAM-1",
				"source": "WEBHOOK",
				"subscriptionId": 44558899
			},
			{
				"createdAt": expect.anything(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "KAM-1-and-KAM-2",
				"entityType": "branches",
				"issueKey": "KAM-2",
				"source": "WEBHOOK",
				"subscriptionId": 44558899
			}]
		});
	});
	it("should extract PR - audit info for logging", () => {
		const reqRepoData = {
			id: "681937718",
			name: "kamaOrgOne/repo_react",
			url: "https://github.com/kamaOrgOne/repo_react",
			updateSequenceId: 1700740159051,
			branches: [
				{
					createPullRequestUrl:
						"https://github.com/kamaOrgOne/repo_react/compare/KAM-5-feat?title=KAM-5-feat&quick_pull=1",
					id: "KAM-5-feat",
					issueKeys: ["KAM-5"],
					name: "KAM-5-feat",
					url: "https://github.com/kamaOrgOne/repo_react/tree/KAM-5-feat",
					updateSequenceId: 1700740158603
				}
			],
			pullRequests: [
				{
					commentCount: 0,
					destinationBranch: "main",
					destinationBranchUrl:
						"https://github.com/kamaOrgOne/repo_react/tree/main",
					displayId: "#10",
					id: 10,
					issueKeys: ["KAM-5"],
					lastUpdate: "2023-11-23T11:49:13Z",
					reviewers: [],
					sourceBranch: "KAM-5-feat",
					sourceBranchUrl:
						"https://github.com/kamaOrgOne/repo_react/tree/KAM-5-feat",
					status: "OPEN",
					timestamp: "2023-11-23T11:49:13Z",
					title: "Kam 5 feat",
					url: "https://github.com/kamaOrgOne/repo_react/pull/10",
					updateSequenceId: 1700740159052
				}
			]
		};
		const response = {
			status: 202,
			data: {
				acceptedDevinfoEntities: {
					"681937718": {
						branches: ["KAM-5-feat"],
						commits: [],
						pullRequests: ["10"]
					}
				},
				failedDevinfoEntities: {},
				unknownIssueKeys: [],
				unknownAssociations: []
			}
		};
		const options = { preventTransitions:false, operationType: "WEBHOOK", auditLogsource: "WEBHOOK",  entityAction: "PR_OPENED", subscriptionId: 44558899 };

		const result = processBatchedBulkUpdateResp({
			reqRepoData,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": expect.anything(),
				"entityAction": "PR_OPENED",
				"entityId": "KAM-5-feat",
				"entityType": "branches",
				"issueKey": "KAM-5",
				"source": "WEBHOOK",
				"subscriptionId": 44558899
			},
			{
				"createdAt": expect.anything(),
				"entityAction": "PR_OPENED",
				"entityId": "10",
				"entityType": "pullRequests",
				"issueKey": "KAM-5",
				"source": "WEBHOOK",
				"subscriptionId": 44558899
			}]
		});
	});
});
