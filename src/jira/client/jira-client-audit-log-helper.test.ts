import { processBatchedBulkUpdateResp } from "./jira-client-audit-log-helper";
import { getLogger } from "config/logger";

describe("processAuditLogs", () => {
	const mockLogger = getLogger("mock-logger");
	it("should return isSuccess as false when status code is anything other than 202", () => {
		const request = {
			preventTransitions: false,
			operationType: "NORMAL",
			repositories: [
				{
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
				}
			],
			properties: { installationId: 42545874 }
		};
		const response = {
			status: 400,
			data: {
				acceptedDevinfoEntities: {},
				failedDevinfoEntities: {},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "NORMAL", entityAction: "COMMIT_PUSH", subscriptionId: 1122334455 };

		const result = processBatchedBulkUpdateResp({
			request,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: false
		});
	});
	it("should return isSuccess as false when status code is 202 but there is no acceptedDevinfoEntities", () => {
		const request = {
			preventTransitions: false,
			operationType: "NORMAL",
			repositories: [
				{
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
				}
			],
			properties: { installationId: 42545874 }
		};
		const response = {
			status: 202,
			data: {
				acceptedDevinfoEntities: {},
				failedDevinfoEntities: {},
				unknownIssueKeys: []
			}
		};
		const options = { preventTransitions:false, operationType: "NORMAL", entityAction: "COMMIT_PUSH", subscriptionId: 1122334455 };

		const result = processBatchedBulkUpdateResp({
			request,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: false
		});
	});
	it("should extract the commit with 2 issue keys linked - audit info for logging", () => {
		const request = {
			preventTransitions: false,
			operationType: "NORMAL",
			repositories: [
				{
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
				}
			],
			properties: { installationId: 42545874 }
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
		const options = { preventTransitions:false, operationType: "NORMAL", entityAction: "COMMIT_PUSH", subscriptionId: 1122334455 };

		const result = processBatchedBulkUpdateResp({
			request,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": new Date(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "e3fe8bf05f50f87c18611298e312217c4895747b",
				"entityType": "commits",
				"issueKey": "KAM-1",
				"source": "NORMAL",
				"subscriptionId": 1122334455
			},
			{
				"createdAt": new Date(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "e3fe8bf05f50f87c18611298e312217c4895747b",
				"entityType": "commits",
				"issueKey": "KAM-2",
				"source": "NORMAL",
				"subscriptionId": 1122334455
			}]
		});
	});
	it("should extract the commit with 1 issue keys linked - audit info for logging", () => {
		const request = {
			preventTransitions: false,
			operationType: "NORMAL",
			repositories: [
				{
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
				}
			],
			properties: { installationId: 42545874 }
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
		const options = { preventTransitions:false, operationType: "NORMAL", entityAction: "COMMIT_PUSH", subscriptionId: 11669900 };

		const result = processBatchedBulkUpdateResp({
			request,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": new Date(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "e3fe8bf05f50f87c18611298e312217c4895747b",
				"entityType": "commits",
				"issueKey": "KAM-1",
				"source": "NORMAL",
				"subscriptionId": 11669900
			}]
		});
	});
	it("should extract branch - audit info for logging", () => {
		const request = {
			preventTransitions: false,
			operationType: "NORMAL",
			repositories: [
				{
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
				}
			],
			properties: { installationId: 42545874 }
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
		const options = { preventTransitions:false, operationType: "NORMAL", entityAction: "COMMIT_PUSH", subscriptionId: 44558899 };

		const result = processBatchedBulkUpdateResp({
			request,
			response,
			options,
			logger: mockLogger
		});

		expect(result).toEqual({
			isSuccess: true,
			auditInfo:[{
				"createdAt": new Date(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "KAM-1-and-KAM-2",
				"entityType": "branches",
				"issueKey": "KAM-1",
				"source": "NORMAL",
				"subscriptionId": 44558899
			},
			{
				"createdAt": new Date(),
				"entityAction": "COMMIT_PUSH",
				"entityId": "KAM-1-and-KAM-2",
				"entityType": "branches",
				"issueKey": "KAM-2",
				"source": "NORMAL",
				"subscriptionId": 44558899
			}]
		});
	});
});
