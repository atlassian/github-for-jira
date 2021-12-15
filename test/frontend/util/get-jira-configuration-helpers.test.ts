/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */

import { getInstallations } from "../../../src/frontend/get-jira-configuration";

describe("getInstallations", () => {
	const noSubscriptions = require("../../fixtures/get-jira-configuration/no-subscriptions");
	// const singleSubscription = require("../../fixtures/get-jira-configuration/single-subscription");
	// const multipleSubscriptions = require("../../fixtures/get-jira-configuration/multiple-subscriptions");
	// const subscriptionWithNoRepos = require("../../fixtures/get-jira-configuration/subscription-with-no-repos");

	it("should return no failed connections if there are no installations", async () => {
		expect(getInstallations({} as any, noSubscriptions)).toEqual({
			fulfilled: [], rejected: []
		});
	});

});
