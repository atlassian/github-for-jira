import { extractClientKey } from "./client-key-regex";

const sampleUuid = "yyyyyyyy-0569-4f33-8413-cccccccc";
const sampleJiraSite = "sample-site.atlassian.net";
const xmlTemplate = `
<consumer>
<key>$$KEY$$</key>
<name>JIRA</name>
<publicKey>
...SIb3DQEBAQUAA4GNADCBiQK...
</publicKey>
<description>Atlassian JIRA at url</description>
</consumer>
`;

const getXml = (key: string) => {
	return xmlTemplate.replace("$$KEY$$", key);
};

const possibleJiraXmlInfo = [
	[getXml(`jira:${sampleUuid}`), `jira:${sampleUuid}`],
	[getXml(`${sampleUuid}`), sampleUuid],
	[getXml(`${sampleJiraSite}`), sampleJiraSite],
	["random-string", undefined]
];

describe("Extract client key from xml", ()=>{
	it.each(possibleJiraXmlInfo)("should extract client key correctly", (xml, key)=>{
		expect(extractClientKey(xml as string)).toBe(key);
	});
});

