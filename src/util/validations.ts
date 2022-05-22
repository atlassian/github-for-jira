// TODO: what is this regex actually checking? that it matches an alphanumeric
//  with dashes and underscore string that's at least length of 1 up to 62?
const domainRegexp = /^https:\/\/\w(?:[\w-]{0,61}\w)?\.(atlassian\.net|jira\.com)$/;

export const validJiraDomain = (url: string): boolean => domainRegexp.test(url);

