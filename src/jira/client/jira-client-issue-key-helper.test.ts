import {
	IssueKeyObject,
	truncateIssueKeys,
	truncate,
	getTruncatedIssueKeys,
	withinIssueKeyLimit,
	updateRepositoryIssueKeys,
	updateIssueKeyAssociationValuesFor,
	findIssueKeyAssociation,
	updateIssueKeysFor,
	withinIssueKeyAssociationsLimit,
	dedupIssueKeys,
	extractAndHashIssueKeysForLoggingPurpose, safeParseAndHashUnknownIssueKeysForLoggingPurpose
} from "./jira-client-issue-key-helper";
import * as constants from "./jira-client-issue-key-helper";
import { getLogger } from "config/logger";
import {
	JiraRemoteLink,
	JiraCommit
} from "interfaces/jira";

// Force ISSUE_KEY_API_LIMIT to a more easily testable size
Object.defineProperty(constants, "ISSUE_KEY_API_LIMIT", { value: 3 });

describe("truncate", () => {
	it("should truncate an array to the specified limit", () => {
		const inputArray = [1, 2, 3, 4, 5, 6];
		const expectedOutput = [1, 2, 3];
		const result = truncate(inputArray);

		expect(result).toEqual(expectedOutput);
	});

	it("should not modify the array if it is within the limit", () => {
		const inputArray = [1, 2];
		const expectedOutput = [1, 2];
		const result = truncate(inputArray);

		expect(result).toEqual(expectedOutput);
	});
});

describe("truncateIssueKeys", () => {
	it("should truncate issue keys in a object", () => {
		const repositoryObj = {
			commits: [
				{ issueKeys: ["KEY1", "KEY2", "KEY3", "KEY4", "KEY5"] },
				{ issueKeys: ["KEY6", "KEY7", "KEY8"] }
			],
			branches: [
				{ issueKeys: ["KEY9", "KEY10"] }
			],
			pullRequests: [
				{ issueKeys: ["KEY11", "KEY12", "KEY13", "KEY14"] }
			]
		};

		const expectedOutput = {
			commits: [
				{ issueKeys: ["KEY1", "KEY2", "KEY3"] },
				{ issueKeys: ["KEY6", "KEY7", "KEY8"] }
			],
			branches: [
				{ issueKeys: ["KEY9", "KEY10"] }
			],
			pullRequests: [
				{ issueKeys: ["KEY11", "KEY12", "KEY13"] }
			]
		};

		truncateIssueKeys(repositoryObj);

		expect(repositoryObj).toEqual(expectedOutput);
	});

	it("should not modify issue keys if they are within the limit", () => {
		const repositoryObj = {
			commits: [
				{ issueKeys: ["KEY1", "KEY2", "KEY3"] },
				{ issueKeys: ["KEY4", "KEY5", "KEY6"] }
			],
			branches: [
				{ issueKeys: ["KEY7", "KEY8", "KEY9"] }
			],
			pullRequests: [
				{ issueKeys: ["KEY10", "KEY11", "KEY12"] }
			]
		};

		const expectedOutput = JSON.parse(JSON.stringify(repositoryObj));

		truncateIssueKeys(repositoryObj);

		expect(repositoryObj).toEqual(expectedOutput);
	});
});

describe("getTruncatedIssueKeys", () => {
	it("should truncate issue keys and associations that exceed the limit", () => {
		const input: IssueKeyObject[] = [
			{
				issueKeys: ["KEY1", "KEY2", "KEY3"],
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE1", "VALUE2", "VALUE3"]
					}
				]
			},
			{
				issueKeys: ["KEY4", "KEY5", "KEY6", "KEY7"],
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE4", "VALUE5", "VALUE6", "VALUE7"]
					}
				]
			}
		];

		const expectedOutput = [
			{
				issueKeys: ["KEY1", "KEY2", "KEY3"],
				associations: [
					{ associationType: "issueIdOrKeys", values: ["VALUE1", "VALUE2", "VALUE3"] }
				]
			},
			{
				issueKeys: ["KEY4", "KEY5", "KEY6"],
				associations: [
					{ associationType: "issueIdOrKeys", values: ["VALUE4", "VALUE5", "VALUE6"] }
				]
			}
		];

		const result = getTruncatedIssueKeys(input);

		expect(result).toEqual(expectedOutput);
	});

	it("should handle empty input data", () => {
		const input: IssueKeyObject[] = [];
		const result = getTruncatedIssueKeys(input);

		expect(result).toEqual([]);
	});
});

describe("withinIssueKeyLimit", () => {
	it("should return false when issue keys are outside the limit", () => {
		const resources = [
			{ issueKeys: ["KEY1", "KEY2", "KEY3", "KEY4", "KEY5", "KEY6"] }
		];

		const result = withinIssueKeyLimit(resources);

		expect(result).toBe(false);
	});

	it("should return true when issue keys and associations are within the limit", () => {
		const resources: IssueKeyObject[] = [
			{
				issueKeys: ["KEY1", "KEY2", "KEY3"],
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE1", "VALUE2", "VALUE3"]
					}
				]
			},
			{
				issueKeys: ["KEY4", "KEY5", "KEY6"],
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE4", "VALUE5", "VALUE6"]
					}
				]
			}
		];

		const result = withinIssueKeyLimit(resources);

		expect(result).toBe(true);
	});

	it("should return true when there are no issue keys", () => {
		const resources: IssueKeyObject[] = [
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE1", "VALUE2", "VALUE3"]
					}
				]
			},
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE4", "VALUE5", "VALUE6"]
					}
				]
			}
		];

		const result = withinIssueKeyLimit(resources);

		expect(result).toBe(true);
	});

	it("should return false when at least one issue key exceeds the limit", () => {
		const resources: IssueKeyObject[] = [
			{ issueKeys: ["KEY1", "KEY2", "KEY3", "KEY4"] },
			{ issueKeys: ["KEY5", "KEY6", "KEY7", "KEY8", "KEY9"] }
		];

		const result = withinIssueKeyLimit(resources);

		expect(result).toBe(false);
	});

	it("should return true when resources is null", () => {
		const resources = null as unknown as IssueKeyObject[];

		const result = withinIssueKeyLimit(resources);

		expect(result).toBe(true);
	});
});

describe("updateRepositoryIssueKeys", () => {
	const mockMutatingFunc = (issueKeys: string[]) => {
		return issueKeys.map(() => "cat");
	};

	it("should update commits if they exist", () => {
		const repositoryObj = {
			commits: [
				{ issueKeys: ["KEY1"] }
			]
		};

		updateRepositoryIssueKeys(repositoryObj, mockMutatingFunc);

		expect(repositoryObj.commits[0].issueKeys).toEqual(["cat"]);
	});

	it("should update branches if they exist", () => {
		const repositoryObj = {
			branches: [
				{ issueKeys: ["KEY2"], lastCommit: { issueKeys: ["KEY3"] } }
			]
		};

		updateRepositoryIssueKeys(repositoryObj, mockMutatingFunc);

		expect(repositoryObj.branches[0].issueKeys).toEqual(["cat"]);
		expect(repositoryObj.branches[0].lastCommit.issueKeys).toEqual(["cat"]);
	});

	it("should update pullRequests if they exist", () => {
		const repositoryObj = {
			pullRequests: [
				{ issueKeys: ["KEY4"] }
			]
		};

		updateRepositoryIssueKeys(repositoryObj, mockMutatingFunc);

		expect(repositoryObj.pullRequests[0].issueKeys).toEqual(["cat"]);
	});

	it("should not update if commits, branches, or pullRequests do not exist", () => {
		const repositoryObj = {};

		updateRepositoryIssueKeys(repositoryObj, mockMutatingFunc);

		expect(repositoryObj).toEqual({});
	});
});

describe("findIssueKeyAssociation", () => {
	it("should return the first 'issueIdOrKeys' association if it exists", () => {
		const resource: IssueKeyObject = {
			associations: [
				{
					associationType: "issueIdOrKeys",
					values: ["VALUE1", "VALUE2", "VALUE3"]
				},
				{
					associationType: "commit",
					values: ["COMMIT1", "COMMIT2"]
				}
			]
		};

		const result = findIssueKeyAssociation(resource);

		expect(result).toEqual({
			associationType: "issueIdOrKeys",
			values: ["VALUE1", "VALUE2", "VALUE3"]
		});
	});

	it("should return undefined if no 'issueIdOrKeys' association type exists", () => {
		const resource: IssueKeyObject = {
			associations: [
				{
					associationType: "commit",
					values: ["COMMIT1", "COMMIT2"]
				}
			]
		};

		const result = findIssueKeyAssociation(resource);

		expect(result).toBeUndefined();
	});

	it("should return undefined if associations array is empty", () => {
		const resource: IssueKeyObject = {
			associations: []
		};

		const result = findIssueKeyAssociation(resource);

		expect(result).toBeUndefined();
	});

	it("should return undefined if associations property is missing", () => {
		const resource: IssueKeyObject = {};

		const result = findIssueKeyAssociation(resource);

		expect(result).toBeUndefined();
	});
});

describe("updateIssueKeysFor", () => {
	const mockMutatingFunc = (issueKeys: string[]) => {
		return issueKeys.map(() => "cat");
	};
	it("should update issue keys and association values when they exist", () => {
		const resourceWithIssueKeys = {
			issueKeys: ["KEY1", "KEY2"]
		};
		const resourceWithAssociation = {
			associations: [
				{
					associationType: "issueIdOrKeys",
					values: ["VALUE1", "VALUE2"]
				}
			]
		};

		const resources = [resourceWithIssueKeys, resourceWithAssociation];
		const expectedUpdatedResources = [
			{
				issueKeys: ["cat", "cat"]
			},
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["cat", "cat"]
					}
				]
			}
		];

		const result = updateIssueKeysFor(resources, mockMutatingFunc);

		expect(result).toEqual(expectedUpdatedResources);
	});

	it("should handle resources without issue keys or associations", () => {
		const resourceWithoutIssueKeys = {};
		const resourceWithoutAssociation = {};

		const resources = [resourceWithoutIssueKeys, resourceWithoutAssociation];

		const result = updateIssueKeysFor(resources, mockMutatingFunc);

		expect(result).toEqual([resourceWithoutIssueKeys, resourceWithoutAssociation]);
	});

});

describe("updateIssueKeyAssociationValuesFor", () => {
	const mockMutatingFunc = (issueKeys: string[]) => {
		return issueKeys.map(() => "cat");
	};

	it("should update association values for each JiraRemoteLink", () => {
		const resources: JiraRemoteLink[] = [
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE1", "VALUE2", "VALUE3"]
					}
				]
			},
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE4", "VALUE5"]
					}
				]
			}
		] as JiraRemoteLink[];

		const result = updateIssueKeyAssociationValuesFor(resources, mockMutatingFunc);

		expect(result).toEqual([
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["cat", "cat", "cat"]
					}
				]
			},
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["cat", "cat"]
					}
				]
			}
		]);
	});

	it("should not update association values when 'issueIdOrKeys' association is missing", () => {

		const resources: JiraRemoteLink[] = [
			{
				associations: [
					{
						associationType: "commit",
						values: ["LAME1", "LAME2"]
					}
				]
			}
		] as JiraRemoteLink[];

		const result = updateIssueKeyAssociationValuesFor(resources, mockMutatingFunc);

		expect(result).toEqual(resources);
	});

	it("should handle empty input data", () => {

		const resources: JiraRemoteLink[] = [];

		const result = updateIssueKeyAssociationValuesFor(resources, mockMutatingFunc);

		expect(result).toEqual([]);
	});
});

describe("dedupIssueKeys", () => {
	it("should call updateRepositoryIssueKeys with repositoryObj and uniq function", () => {
		const repositoryObj = {
			commits: [
				{ issueKeys: ["KEY1", "KEY2", "KEY1", "KEY3"] }
			],
			branches: [
				{ issueKeys: ["KEY2", "KEY3", "KEY4"] }
			],
			pullRequests: [
				{ issueKeys: ["KEY1", "KEY4", "KEY5"] }
			]
		};

		const expectedDeduplicatedObj = {
			commits: [
				{ issueKeys: ["KEY1", "KEY2", "KEY3"] }
			],
			branches: [
				{ issueKeys: ["KEY2", "KEY3", "KEY4"] }
			],
			pullRequests: [
				{ issueKeys: ["KEY1", "KEY4", "KEY5"] }
			]
		};

		dedupIssueKeys(repositoryObj);

		expect(repositoryObj).toEqual(expectedDeduplicatedObj);
	});

});

describe("withinIssueKeyAssociationsLimit", () => {

	it("should return true when resources is an empty array", () => {
		const resources: JiraRemoteLink[] = [];

		const result = withinIssueKeyAssociationsLimit(resources);

		expect(result).toBe(true);
	});

	it("should return true when associations are within the limit", () => {
		const resources: JiraRemoteLink[] = [
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE1", "VALUE2", "VALUE3"]
					}
				]
			},
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE4", "VALUE5"]
					}
				]
			}
		] as JiraRemoteLink[];

		const result = withinIssueKeyAssociationsLimit(resources);

		expect(result).toBe(true);
	});

	it("should return false when associations exceed the limit", () => {

		const resources: JiraRemoteLink[] = [
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE1", "VALUE2", "VALUE3", "VALUETOOMUCH"]
					}
				]
			},
			{
				associations: [
					{
						associationType: "issueIdOrKeys",
						values: ["VALUE4", "VALUE5", "VALUE6", "VALUE7", "VALUE8"]
					}
				]
			}
		] as JiraRemoteLink[];

		const result = withinIssueKeyAssociationsLimit(resources);

		expect(result).toBe(false);
	});

	it("should return true when no resources", () => {

		const resources = null as unknown as JiraRemoteLink[];

		const result = withinIssueKeyAssociationsLimit(resources);

		expect(result).toBe(true);
	});
});

describe("extractAndHashIssueKeysForLoggingPurpose", () => {
	const mockLogger = getLogger("mock-logger");

	const Key1Hash = "1b3db66faabc90466c99b8c7c116c4667d3df0dbe467200331f96dc308a8f73d";
	const Key2Hash = "0b3669cb698c116aea0c8f8fb48d89049fdf312bb951c2ea9e22edfd143edd3b";
	const Key3Hash = "d4941a929360ab3fbad1399502f05421de6f305da8d4692c5bc76a0db0a8a06b";

	it("should extract and hash issue keys when commits have issue keys", () => {
		const commitChunk: JiraCommit[] = [
			{
				issueKeys: ["KEY1", "KEY2"]
			},
			{
				issueKeys: ["KEY3"]
			}
		] as JiraCommit[];

		const result = extractAndHashIssueKeysForLoggingPurpose(commitChunk, mockLogger);

		expect(result).toEqual([Key1Hash, Key2Hash, Key3Hash]);
	});

	it("should filter out empty issue keys", () => {
		const commitChunk: JiraCommit[] = [
			{
				issueKeys: ["KEY1", "", "KEY2"]
			},
			{
				issueKeys: []
			}
		] as JiraCommit[];

		const result = extractAndHashIssueKeysForLoggingPurpose(commitChunk, mockLogger);

		expect(result).toEqual([Key1Hash, Key2Hash]);
	});

	it("should throw an error", () => {

		mockLogger.error = jest.fn();

		const commitChunk: JiraCommit[] = "not an array" as unknown as JiraCommit[];

		extractAndHashIssueKeysForLoggingPurpose(commitChunk, mockLogger);

		expect(mockLogger.error).toHaveBeenCalled();
	});
});

describe("safeParseAndHashUnknownIssueKeysForLoggingPurpose", () => {

	const mockLogger = getLogger("mock-logger");
	const Key1Hash = "1b3db66faabc90466c99b8c7c116c4667d3df0dbe467200331f96dc308a8f73d";
	const Key2Hash = "0b3669cb698c116aea0c8f8fb48d89049fdf312bb951c2ea9e22edfd143edd3b";
	const Key3Hash = "d4941a929360ab3fbad1399502f05421de6f305da8d4692c5bc76a0db0a8a06b";

	it("should parse and hash unknownIssueKeys when they exist", () => {
		const responseData = {
			unknownIssueKeys: ["KEY1", "KEY2", "KEY3"]
		};

		const result = safeParseAndHashUnknownIssueKeysForLoggingPurpose(responseData, mockLogger);

		expect(result).toEqual([Key1Hash, Key2Hash, Key3Hash]);
	});

	it("should handle empty unknownIssueKeys", () => {
		const responseData = {
			unknownIssueKeys: []
		};

		const result = safeParseAndHashUnknownIssueKeysForLoggingPurpose(responseData, mockLogger);

		expect(result).toEqual([]);
	});

	it("should handle missing unknownIssueKeys", () => {
		const responseData = {};

		const result = safeParseAndHashUnknownIssueKeysForLoggingPurpose(responseData, mockLogger);

		expect(result).toEqual([]);
	});

	it("should throw an error", () => {

		mockLogger.error = jest.fn();

		const data = {
			unknownIssueKeys: {} // this should be an array, so it will cause an error
		};

		safeParseAndHashUnknownIssueKeysForLoggingPurpose(data, mockLogger);

		expect(mockLogger.error).toHaveBeenCalled();
	});

});
