import { JiraDeploymentBulkSubmitData, JiraDeployment } from "interfaces/jira";
import { getDeploymentDebugInfo, extractDeploymentDataForLoggingPurpose } from "./jira-client-deployment-helper";
import { getLogger } from "config/logger";

jest.mock("utils/encryption", () => ({
	createHashWithSharedSecret: (input:string) => `hashed-${input}`
}));

describe("getDeploymentDebugInfo", () => {
	describe.each([
		undefined,
		{ deployments: undefined } as any as JiraDeploymentBulkSubmitData,
		{ deployments: [] } as any as JiraDeploymentBulkSubmitData,
		{ deployments: [ undefined ] } as any as JiraDeploymentBulkSubmitData
	])("for empty payload", (emptyPayload: JiraDeploymentBulkSubmitData | undefined) => {
		it(`should not throw error for ${JSON.stringify(emptyPayload)}`, () => {
			expect(getDeploymentDebugInfo(emptyPayload)).toEqual({});
		});
	});
	describe.each([
		{ deployments: [{}] } as any as JiraDeploymentBulkSubmitData,
		{ deployments: [{ associations: undefined }] } as any as JiraDeploymentBulkSubmitData,
		{ deployments: [{ associations: [ {} ] }] } as any as JiraDeploymentBulkSubmitData
	])("for empty association payload", (emptyPayload: JiraDeploymentBulkSubmitData | undefined) => {
		it(`should not throw error for ${JSON.stringify(emptyPayload)}`, () => {
			expect(getDeploymentDebugInfo(emptyPayload)).toEqual({
				commitCount: 0,
				issueIdOrKeysCount: 0,
				issueKeysCount: 0,
				serviceIdOrKeysCount: 0
			});
		});
	});
	const commonProps = (): JiraDeployment => ({
		schemaVersion: "1",
		deploymentSequenceNumber: 1,
		updateSequenceNumber: 1,
		displayName: "blah",
		url: "https://test.blah",
		description: "desc",
		lastUpdated: new Date(),
		state: "success",
		pipeline: {
			id: "11",
			displayName: "p11",
			url: "https://test.blah"
		},
		environment: {
			id: "22",
			displayName: "env22",
			type: "production"
		},
		associations: []
	});
	describe.each([
		{
			deployments: [{
				...commonProps(),
				associations: [{
					associationType: "commit",
					values: [{ commitHash: "23441234234", repositoryId: 1 }]
				}, {
					associationType: "issueKeys",
					values: ["DEV-1", "DEV-2"]
				}, {
					associationType: "issueIdOrKeys",
					values: ["DEV-3", "DEV-4", "DEV-5"]
				}, {
					associationType: "serviceIdOrKeys",
					values: ["JST-6", "JST-7", "JST-8", "JST-9"]
				}]
			}]
		} as JiraDeploymentBulkSubmitData
	])("for jira deployment payload", (payload) => {
		it("should return proper count for each key", () => {
			expect(getDeploymentDebugInfo(payload)).toEqual({
				commitCount: 1,
				issueKeysCount: 2,
				issueIdOrKeysCount: 3,
				serviceIdOrKeysCount: 4
			});
		});
	});
});


describe("extractDeploymentDataForLoggingPurpose", () => {
	const mockLogger = getLogger("mock-logger");

	it("should extract and hash deployment data for logging", () => {
		const data = {
			deployments: [
				{
					updateSequenceNumber: 1,
					state: "state1",
					url: "url1",
					associations: [
						{
							associationType: "issueKeys",
							values: ["key1", "key2"]
						},
						{
							associationType: "otherType",
							values: ["value1", "value2"]
						}
					]
				},
				{
					updateSequenceNumber: 2,
					state: "state2",
					url: "url2",
					associations: [
						{
							associationType: "issueIdOrKeys",
							values: ["key3", "key4"]
						}
					]
				}
			]
		} as JiraDeploymentBulkSubmitData;

		const result = extractDeploymentDataForLoggingPurpose(data, mockLogger);

		expect(result).toEqual({
			deployments: [
				{
					updateSequenceNumber: 1,
					state: "hashed-state1",
					url: "hashed-url1",
					issueKeys: ["hashed-key1", "hashed-key2"]
				},
				{
					updateSequenceNumber: 2,
					state: "hashed-state2",
					url: "hashed-url2",
					issueKeys: ["hashed-key3", "hashed-key4"]
				}
			]
		});

	});

});
