import { toRateLimitState } from "../../src/backfill/rate-limit-mapper";
import { AxiosResponse } from "axios";

describe("rate limit mapper", () => {

	it("maps GitHub headers", async () => {

		const refreshDate = new Date(2021, 11, 18);
		const response = createResponse(refreshDate, 100);

		const rateLimitState = toRateLimitState(response);
		expect(rateLimitState?.budgetLeft).toEqual(100);
		expect(rateLimitState?.refreshDate).toEqual(refreshDate);
	});

	it("maps invalid GitHub headers to undefined", async () => {

		const refreshDate = new Date(2021, 11, 18);
		const response = createResponse(refreshDate, "invalid");

		const rateLimitState = toRateLimitState(response);
		expect(rateLimitState).toBeUndefined();
	});

	function createResponse(refreshDate: Date, rateLimitRemaining: unknown): AxiosResponse {
		const response = {
			headers: {},
			data: {},
			status: 200,
			statusText: "OK",
			config: {},
		};
		response.headers["X-RateLimit-Reset"] = refreshDate.getTime() / 1000;
		response.headers["X-RateLimit-Remaining"] = rateLimitRemaining;
		return response;
	}

});

