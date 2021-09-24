export const notFoundErrorOctokitRequest = {
	status: 404,
	headers: {
		"access-control-allow-origin": "*",
		"access-control-expose-headers":
			"ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, Deprecation, Sunset",
		connection: "close",
		"content-encoding": "gzip",
		"content-security-policy": "default-src 'none'",
		"content-type": "application/json; charset=utf-8",
		date: "Fri, 24 Sep 2021 04:13:24 GMT",
		"referrer-policy":
			"origin-when-cross-origin, strict-origin-when-cross-origin",
		server: "GitHub.com",
		"strict-transport-security": "max-age=31536000; includeSubdomains; preload",
		"transfer-encoding": "chunked",
		vary: "Accept-Encoding, Accept, X-Requested-With",
		"x-content-type-options": "nosniff",
		"x-frame-options": "deny",
		"x-github-media-type": "github.v3; format=json",
		"x-github-request-id": "043F:508D:292C7C:2CFE35:614D5064",
		"x-ratelimit-limit": "5000",
		"x-ratelimit-remaining": "4943",
		"x-ratelimit-reset": "1632459926",
		"x-ratelimit-resource": "core",
		"x-ratelimit-used": "57",
		"x-xss-protection": "0",
	},
	request: {
		method: "GET",
		url: "https://api.github.com/repos/some-org/some-repo/pulls?per_page=20&page=1&state=all&sort=created&direction=desc",
		headers: {
			accept: "application/vnd.github.v3+json",
			"user-agent": "octokit.js/16.43.2 Node.js/14.17.6 (Linux 5.10; x64)",
			authorization: "token [REDACTED]",
		},
		request: {
			hook: "",
			validate: {},
			retries: 6,
			retryAfter: 10,
			retryCount: 6,
		},
	},
	documentation_url:
		"https://docs.github.com/rest/reference/pulls#list-pull-requests",
};
