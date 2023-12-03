import {
	canBeUsedAsApiKeyHeader,
	canLogHeader,
	getAllKnownHeaders,
	isUniquelyGitHubServerHeader
} from "./http-headers";

describe("http-headers", () => {

	describe("canLogHeader", () => {
		it.each(["content-type", "Accept-encoding", "x-forwarded-for"])("allows to log %s header", (header) =>
		{ expect(canLogHeader(header)).toBeTruthy(); }
		);

		it.each(["X-github-delivery", "x-github-event", "x-github-hook-id"])("allows to log %s GitHub header", (header) =>
		{ expect(canLogHeader(header)).toBeTruthy(); }
		);

		it.each(["Authorization", "Cookie", "Set-Cookie"])("does not allow to log %s header", (header) =>
		{ expect(canLogHeader(header)).toBeFalsy(); }
		);

		it.each(["blah", "foo"])("does not allow to log unknown header %s", (header) =>
		{ expect(canLogHeader(header)).toBeFalsy(); }
		);
	});

	describe("isUniquelyGitHubServerHeader", () => {
		it.each(["content-type", "Accept-encoding", "x-forwarded-for"])("does not identify %s header as GitHub's one", (header) =>
		{ expect(isUniquelyGitHubServerHeader(header)).toBeFalsy(); }
		);

		it.each(["X-github-delivery", "x-github-event", "x-github-hook-id"])("identies %s as GitHub header", (header) =>
		{ expect(isUniquelyGitHubServerHeader(header)).toBeTruthy(); }
		);
	});

	describe("canBeUsedAsApiKeyHeader", () => {
		it.each(["content-type", "Accept-encoding", "x-forwarded-for"])("%s header cannot be used as an API key header", (header) =>
		{ expect(canBeUsedAsApiKeyHeader(header)).toBeFalsy(); }
		);

		it.each(["X-github-delivery", "x-github-event", "x-github-hook-id"])("%s header cannot be used as an API key header", (header) =>
		{ expect(canBeUsedAsApiKeyHeader(header)).toBeFalsy(); }
		);

		it.each(["authorization", "cookie", "CooKie", "set-cookie"])("%s header cannot be used as an API key header", (header) =>
		{ expect(canBeUsedAsApiKeyHeader(header)).toBeFalsy(); }
		);

		it.each(["foo_auth", "x-my-header"])("%s header can be used as an API key header", (header) =>
		{ expect(canBeUsedAsApiKeyHeader(header)).toBeTruthy(); }
		);
	});

	describe("getAllKnownHeaders", () => {
		it.each([
			"content-type", "Accept-encoding", "x-forwarded-for",
			"X-github-delivery", "x-github-event", "x-github-hook-id",
			"authorization", "cookie", "CooKie", "set-cookie"
		])("%s header is known", (header) =>
		{ expect(getAllKnownHeaders().indexOf(header.trim().toLowerCase()) + 1).toBeGreaterThan(0); }
		);

		it.each(["foo_auth", "x-my-header"])("%s header can be used as an API key header", (header) =>
		{ expect(getAllKnownHeaders().indexOf(header) + 1).toBeLessThan(1); }
		);
	});

});
