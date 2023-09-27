import { isHealthcheckStopped, stopHealthcheck } from "utils/healthcheck-stopper";

describe("healthcheck-stopper", () => {
	it("allows healthchecks by default", () => {
		expect(isHealthcheckStopped()).toBeFalsy();
	});

	it("prohibits healthchecks after stop is called", () => {
		stopHealthcheck();
		expect(isHealthcheckStopped()).toBeTruthy();
	});
});
