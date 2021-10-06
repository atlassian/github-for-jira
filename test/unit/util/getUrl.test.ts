import {getJiraHostFromRedirectUrlNew} from "../../../src/util/getUrl";
import {getLogger} from "../../../src/config/logger";

describe('getJiraHostFromRedirectUrl', () => {
	test('extracts jiraHost from xdm_e', () => {
		const host = getJiraHostFromRedirectUrlNew(`/github/configuration?jwt=eyo&xdm_e=https%3A%2F%2Fbgvozdev.atlassian.net`, getLogger('test'))
		expect(host).toBe('bgvozdev.atlassian.net');
	});

	test('extracts jiraHost from host', () => {
		const host = getJiraHostFromRedirectUrlNew(`https://bgvozdev.atlassian.net/whatever`, getLogger('test'))
		expect(host).toBe('bgvozdev.atlassian.net');
	});

	test('returns unknown when cannot parse', ()=> {
		const host = getJiraHostFromRedirectUrlNew("yadayada", getLogger('test'));
		expect(host).toBe('unknown');
	})
});
