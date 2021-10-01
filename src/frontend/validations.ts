// TODO: what is this regex actually checking? that it matches an alphanumeric
//  with dashes and underscore string that's at least length of 1 up to 62?
const subdomainRegexp = /^\w(?:[\w-]{0,61}\w)?$/;
const jiraDomains = ["atlassian.net", "jira.com"];

export const validJiraDomains = (jiraSubdomain: string, jiraDomain: string): boolean =>
	!!jiraDomain && !!jiraSubdomain &&
	jiraDomains.includes(jiraDomain) &&
	subdomainRegexp.test(jiraSubdomain);

export const jiraDomainOptions = (jiraDomain?: string): JiraDomain[] =>
	jiraDomains.map(value => ({
		value,
		selected: value === jiraDomain
	}));

export interface JiraDomain {
	value: string;
	selected: boolean;
}
