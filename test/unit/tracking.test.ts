import url from "url";

import crypto from "crypto";
import { Action, ActionType } from "../../src/backend/proto/v0/action";
import nock from "nock";

import { BaseURL, isDisabled, setIsDisabled, submitProto } from "../../src/tracking";
import statsd, { globalTags } from "../../src/config/statsd";

describe("Hydro Gateway Protobuf Submissions", () => {
	let parsedURL;
	let basePath;
	let origDisabledState;

	beforeEach(async () => {
		parsedURL = url.parse(BaseURL);
		basePath = parsedURL.href.replace(parsedURL.path, "");
		origDisabledState = isDisabled();
		setIsDisabled(false);
		statsd.mockBuffer = [];
	});

	afterEach(() => {
		setIsDisabled(origDisabledState);
	});

	test.each([
		[200, true, "OK"],
		[400, false, "clientID Missing"],
		[404, false, "Unknown schema"],
		[422, false, "Invalid Payload"]
	])(
		"Protobuf submission status=%i expected=%p",
		async (status, expected, errMsg) => {
			const e = new Action();
			e.type = ActionType.CREATED;
			nock(basePath)
				.post(parsedURL.path)
				.reply(status, function(_: string, requestBody) {
					expect(this.req.headers["x-hydro-app"]).toBe("github-for-jira");
					const hmac = crypto.createHmac(
						"sha256",
						process.env.HYDRO_APP_SECRET
					);
					hmac.update(JSON.stringify(requestBody));
					expect(this.req.headers.authorization).toBe(
						`Hydro ${hmac.digest("hex")}`
					);
					return errMsg;
				});
			expect(await submitProto(e)).toBe(expected);
			// There will be a .dist.post and a .submission metric
			expect(statsd.mockBuffer.length).toBe(2);
		}
	);

	it("Multiple protobuf submission", async () => {
		const protos = [new Action(), new Action(), new Action()];
		protos.forEach((proto) => {
			proto.type = ActionType.CREATED;
		});

		nock(basePath)
			.post(parsedURL.path)
			.reply(200, function(_: string, requestBody) {
				expect(this.req.headers["x-hydro-app"]).toBe("github-for-jira");
				const hmac = crypto.createHmac("sha256", process.env.HYDRO_APP_SECRET);
				hmac.update(JSON.stringify(requestBody));
				expect(this.req.headers.authorization).toBe(
					`Hydro ${hmac.digest("hex")}`
				);
				return "OK";
			});
		expect(await submitProto(protos)).toBe(true);
		// There will be a .dist.post and a .submission metric
		expect(statsd.mockBuffer.length).toBe(2);

		const { environment, environment_type } = globalTags;
		expect(statsd.mockBuffer[1]).toBe(
			`github-for-jira.app.server.http.request.hydro.submission:3|c|#environment:${environment},environment_type:${environment_type},deployment_id:1,region:localhost,schema:jira.v0.Action,status:200`
		);
	});

	/**
	 * This would fail if we didn't have the right secret in place
	 */
	it("Returns true when disabled", async () => {
		setIsDisabled(true);
		const e = new Action();
		e.type = ActionType.CREATED;
		expect(await submitProto(e)).toBe(true);
		expect(statsd.mockBuffer.length).toBe(0);
	});
});
