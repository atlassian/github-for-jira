// TODO: what is this regex actually checking? that it matches an alphanumeric
//  with dashes and underscore string that's at least length of 1 up to 62?
const domainRegexp = /^\w(?:[\w-]{0,61}\w)?$/;
const jiraTopleveldomains = ["atlassian.net", "jira.com"];

export const validJiraDomains = (jiraDomain: string, jiraTopleveldomain: string): boolean =>
	!!jiraDomain && !!jiraTopleveldomain &&
	domainRegexp.test(jiraDomain) &&
	jiraTopleveldomains.includes(jiraTopleveldomain);
export interface JiraTopleveldomain {
	value: string;
	selected: boolean;
}
