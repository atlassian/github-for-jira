import { JiraDeploymentBulkSubmitData, JiraDeployment } from "interfaces/jira";
import { getDeploymentDebugInfo } from "./jira-client-deployment-helper";

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
