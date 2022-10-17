/* eslint-disable @typescript-eslint/no-explicit-any */
import { matchRouteWithPattern } from "utils/match-route-with-pattern";

const testData = [
	{
		pattern: "/jira/connect",
		route: "/jira/connect",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise?new={ac.new}",
		route: "/jira/connect/enterprise",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise?new={ac.new}",
		route: "/jira/connect/enterprise?new=123",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise?new={ac.new}",
		route: "/jira/connect/enterprise?randomQueryString=true",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise?new={ac.new}",
		route: "/jira/connect/1/enterprise",
		match: false
	},
	{
		pattern: "/jira/connect/enterprise",
		route: "/jira/connect/1/enterprise",
		match: false
	},
	{
		pattern: "/jira/connect/enterprise",
		route: "/jira/connect/enterprise",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise/{ac.serverUrl}/app?new={ac.new}",
		route: "/jira/connect/enterprise/http%3A%2F%2FmyRandomsite.com/app",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise/{ac.serverUrl}/app?new={ac.new}",
		route: "/jira/connect/enterprise/http%3A%2F%2FmyRandomsite.com/app/new",
		match: false
	},
	{
		pattern: "/jira/connect/enterprise/{ac.serverUrl}/app?new={ac.new}",
		route: "/jira/connect/enterprise/abcdef/app/new",
		match: false
	},
	{
		pattern: "/jira/connect/enterprise/{ac.serverUrl}/app?new={ac.new}",
		route: "/jira/connect/enterprise/http%3A%2F%2FmyRandomsite.com/app?new=new",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise/{ac.serverUrl}/app/new",
		route: "/jira/connect/enterprise/http%3A%2F%2FmyRandomsite.com/app?new=new",
		match: false
	},
	{
		pattern: "/jira/connect/enterprise/{ac.serverUrl}/app/new",
		route: "/jira/connect/enterprise/http%3A%2F%2FmyRandomsite.com/app/new?random=new",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise/app/{ac.uuid}",
		route: "/jira/connectenterprise/app",
		match: false
	},
	{
		pattern: "/jira/connect/enterprise/app/{ac.uuid}",
		route: "/jira/connect/enterprise/app/123",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise/app/{ac.uuid}",
		route: "/jira/connect/enterprise/app/123",
		match: true
	},
	{
		pattern: "/jira/connect/enterprise/{ac.serverUrl}/app/{ac.uuid}",
		route: "/jira/connect/enterprise/http%3A%2F%2FmyRandomsite.com/app/123",
		match: true
	}
];

describe("Test for matchRouteWithPattern", () => {
	testData.forEach(datum => {
		const { pattern, route, match } = datum;
		it(`Testing ${pattern} for ${route}`, () => {
			expect(matchRouteWithPattern(pattern, route)).toBe(match);
		});
	});
});
