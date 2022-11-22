import { extractClientKey } from "./client-key-regex";

const sampleUuid = "yyyyyyyy-0569-4f33-8413-cccccccc";
const possibleJiraXmlInfo = [
	[`blah\n<key>jira:${sampleUuid}</key>\nblah`, `jira:${sampleUuid}`],
	[`blah\n<key>${sampleUuid}</key>\nblah`, sampleUuid]
];

describe("Extract client key from xml", ()=>{
	it.each(possibleJiraXmlInfo)("should extract client key correctly", (xml, key)=>{
		expect(extractClientKey(xml)).toBe(key);
	});
});

