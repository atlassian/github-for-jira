/* eslint-disable @typescript-eslint/no-var-requires */
import { getFailedConnections } from "../../../src/frontend/get-jira-configuration";

describe("getFailedConnections", () => {
	const noSubscriptions = require("../../fixtures/get-jira-configuration/no-subscriptions");
	const singleSubscription = require("../../fixtures/get-jira-configuration/single-subscription");
	const multipleSubscriptions = require("../../fixtures/get-jira-configuration/multiple-subscriptions");
	const subscriptionWithNoRepos = require("../../fixtures/get-jira-configuration/subscription-with-no-repos");

	it("should return no failed connections if there are no installations", async () => {
		const noInstallations = require("../../fixtures/get-jira-configuration/no-installations");
		const result = await getFailedConnections(noInstallations, noSubscriptions);
		expect(result).toHaveLength(0);
		expect(result).toEqual([]);
	});

	it("should return no failed connections if no connections fail", async () => {
		const singleSuccessfulInstallation = require("../../fixtures/get-jira-configuration/single-successful-installation");
		const result = await getFailedConnections(singleSuccessfulInstallation, singleSubscription);
		expect(result).toHaveLength(0);
		expect(result).toEqual([]);
	});

	it("should return a single failed connection if 1 connection fails", async () => {
		const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");
		const result = await getFailedConnections(singleFailedInstallation, singleSubscription);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
	});

	it("should return a single failed connection if 1 connection fails and 1 succeeds", async () => {
		const singleFailedAndSingleSuccessdulInstallation = require("../../fixtures/get-jira-configuration/single-successful-and-single-failed-installations");
		const result = await getFailedConnections(singleFailedAndSingleSuccessdulInstallation, singleSubscription);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
	});

	it("should return a multiple failed connections if there is more than 1 failed connection", async () => {
		const multipleFailedInstallations = require("../../fixtures/get-jira-configuration/multiple-failed-installations");
		const result = await getFailedConnections(multipleFailedInstallations, multipleSubscriptions);
		expect(result).toHaveLength(2);
		expect(result).toEqual([
			{ deleted: true, id: 12345678, orgName: "fake-name" },
			{ deleted: true, id: 23456789, orgName: "fake-name-two" },
		]);
	});

	it("should return a multiple failed connections if there are multiple successful and failed connections", async () => {
		const multipleFailedAndSuccessfulInstallations = require("../../fixtures/get-jira-configuration/muliple-successful-and-multiple-failed-installations");
		const result = await getFailedConnections(multipleFailedAndSuccessfulInstallations, multipleSubscriptions);
		expect(result).toHaveLength(2);
		expect(result).toEqual([
			{ deleted: true, id: 12345678, orgName: "fake-name" },
			{ deleted: true, id: 23456789, orgName: "fake-name-two" },
		]);
	});

	it("should return 'undefined' for the orgName of subscriptions with no repos", async () => {
		const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");
		const result = await getFailedConnections(singleFailedInstallation, subscriptionWithNoRepos);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: undefined }]);
	});
});
