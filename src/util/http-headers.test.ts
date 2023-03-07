import { canLogHeader } from "./http-headers";

describe("canLogHeader", () => {
	it.each(["content-type", "Accept-encoding", "x-forwarded-for"])("allows to log %s header", (header) =>
		expect(canLogHeader(header)).toBeTruthy()
	);

	it.each(["X-github-delivery", "x-github-event", "x-github-hook-id"])("allows to log %s GitHub header", (header) =>
		expect(canLogHeader(header)).toBeTruthy()
	);

	it.each(["Authorization", "Cookie", "Set-Cookie"])("does not allow to log %s header", (header) =>
		expect(canLogHeader(header)).toBeFalsy()
	);

	it.each(["blah", "foo"])("does not allow to log unknown header %s", (header) =>
		expect(canLogHeader(header)).toBeFalsy()
	);
});
