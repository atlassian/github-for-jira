import {getJiraHostFromRedirectUrl} from "../../../src/util/getUrl";
import {getLogger} from "../../../src/config/logger";

describe("getJiraHostFromRedirectUrl", () => {
	test("extracts jiraHost from xdm_e", () => {
		const host = getJiraHostFromRedirectUrl("/github/configuration?jwt=eyo&xdm_e=https%3A%2F%2Fbgvozdev.atlassian.net", getLogger("test"))
		expect(host).toBe("bgvozdev.atlassian.net");
	});

	test("extracts jiraHost from host", () => {
		const host = getJiraHostFromRedirectUrl("https://bgvozdev.atlassian.net/whatever", getLogger("test"))
		expect(host).toBe("bgvozdev.atlassian.net");
	});

	test("xdm_e has priority", () => {
		const host = getJiraHostFromRedirectUrl("https://bgvozdev.atlassian.net/whatever?xdm_e=https%3A%2F%2Fblah.atlassian.net", getLogger("test"))
		expect(host).toBe("blah.atlassian.net");
	});

	test("returns unknown when neither host nor xdm_e were provided", () => {
		const host = getJiraHostFromRedirectUrl("/whatever", getLogger("test"))
		expect(host).toBe("unknown");
	});

	test("returns unknown when cannot parse", ()=> {
		const host = getJiraHostFromRedirectUrl("yadayada", getLogger("test"));
		expect(host).toBe("unknown");
	});

	test("returns empty on empty", ()=> {
		const host = getJiraHostFromRedirectUrl("", getLogger("test"));
		expect(host).toBe("empty");
	});
});
