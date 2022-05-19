// TODO: what is this regex actually checking? that it matches an alphanumeric
//  with dashes and underscore string that's at least length of 1 up to 62?
const domainRegexp = /^\w(?:[\w-]{0,61}\w)?\.(atlassian\.net|jira\.com)$/;

export const validJiraDomain = (jiraHost: string): boolean => {
	try {
		const hostname = new URL(jiraHost).hostname;
		return domainRegexp.test(hostname);
	} catch (e) {
		return false;
	}
};

