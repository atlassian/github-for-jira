import { isTestJiraHost } from "./jira-test-site-check";

describe.each([
	[undefined, false],
	["https://site-1.some-test.atlassian.net", true],
	["https://site-2.some-test.atlassian.net", true],
	["https://site-3.some-test.atlassian.net", true],
	["https://real-site-1.non-test.atlassian.net", false]
])("Checking whether it is jira test site", (site, shouldBeTest) => {
	it(`should successfully check ${site ?? "undefined"} to be is-jira-test-site?: ${shouldBeTest}`, () => {
		expect(isTestJiraHost(site)).toBe(shouldBeTest);
	});
});
