/* eslint-disable @typescript-eslint/no-var-requires */
import { getFailedConnections } from "../../../src/frontend/get-jira-configuration";

describe("getFailedConnections", () => {
	const noSubscriptions = require("../../fixtures/get-jira-configuration/no-subscriptions");
	const singleSubscription = require("../../fixtures/get-jira-configuration/single-subscription");
	const multipleSubscriptions = require("../../fixtures/get-jira-configuration/multiple-subscriptions");

	it("should return no failed connections if there are no installations", async () => {
		const noInstallations = require("../../fixtures/get-jira-configuration/no-installations");
		expect(getFailedConnections(noInstallations, noSubscriptions)).toHaveLength(
			0
		);
		expect(getFailedConnections(noInstallations, noSubscriptions)).toEqual([]);
	});

	it("should return no failed connections if no connections fail", async () => {
		const singleSuccessfulInstallation = require("../../fixtures/get-jira-configuration/single-successful-installation");
		expect(
			getFailedConnections(singleSuccessfulInstallation, singleSubscription)
		).toHaveLength(0);
		expect(
			getFailedConnections(singleSuccessfulInstallation, singleSubscription)
		).toEqual([]);
	});

	it("should return a single failed connection if 1 connection fails", async () => {
		const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");
		expect(
			getFailedConnections(singleFailedInstallation, singleSubscription)
		).toHaveLength(1);
		expect(
			getFailedConnections(singleFailedInstallation, singleSubscription)
		).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
	});

	it("should return a single failed connection if 1 connection fails and 1 succeeds", async () => {
		const singleFailedAndSingleSuccessdulInstallation = require("../../fixtures/get-jira-configuration/single-successful-and-single-failed-installations");
		expect(
			getFailedConnections(
				singleFailedAndSingleSuccessdulInstallation,
				singleSubscription
			)
		).toHaveLength(1);
		expect(
			getFailedConnections(
				singleFailedAndSingleSuccessdulInstallation,
				singleSubscription
			)
		).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
	});

	it("should return a multiple failed connections if there is more than 1 failed connection", async () => {
		const multipleFailedInstallations = require("../../fixtures/get-jira-configuration/multiple-failed-installations");
		expect(
			getFailedConnections(multipleFailedInstallations, multipleSubscriptions)
		).toHaveLength(2);
		expect(
			getFailedConnections(multipleFailedInstallations, multipleSubscriptions)
		).toEqual([
			{ deleted: true, id: 12345678, orgName: "fake-name" },
			{ deleted: true, id: 23456789, orgName: "fake-name-two" },
		]);
	});

	it("should return a multiple failed connections if there are multiple successful and failed connections", async () => {
		const multipleFailedAndSuccessfulInstallations = require("../../fixtures/get-jira-configuration/muliple-successful-and-multiple-failed-installations");
		expect(
			getFailedConnections(
				multipleFailedAndSuccessfulInstallations,
				multipleSubscriptions
			)
		).toHaveLength(2);
		expect(
			getFailedConnections(
				multipleFailedAndSuccessfulInstallations,
				multipleSubscriptions
			)
		).toEqual([
			{ deleted: true, id: 12345678, orgName: "fake-name" },
			{ deleted: true, id: 23456789, orgName: "fake-name-two" },
		]);
	});
});
