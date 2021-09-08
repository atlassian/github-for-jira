import transformCodeScanningAlert from "../../../src/transforms/code-scanning-alert";
import codeScanningPayload from "../../fixtures/api/code-scanning-alert.json";
import {Context} from "probot/lib/context";
import {GitHubAPI} from "probot";
import {getLogger} from "../../../src/config/logger";

const buildContext = (payload): Context => {
	return new Context({
		"id": "hi",
		"name": "hi",
		"payload": payload
	}, GitHubAPI(), getLogger("logger"));
}

describe("code_scanning_alert transform", () => {
	Date.now = jest.fn(() => 12345678);

	it("code_scanning_alert is transformed into a remote link", async () => {
		const remoteLinks = transformCodeScanningAlert(buildContext(codeScanningPayload));
		expect(remoteLinks).toMatchObject({
			remoteLinks: [{
				schemaVersion: "1.0",
				id: "403470608-272",
				updateSequenceNumber: 12345678,
				displayName: "Reflected cross-site scripting",
				description: "Writing user input directly to an HTTP response allows for a cross-site scripting vulnerability.",
				url: "https://github.com/TerryAg/github-jira-test/security/code-scanning/272",
				type: "security",
				status: {
					appearance: "removed",
					label: "open"
				},
				lastUpdated: "2021-09-06T06:00:00Z",
				associations: [{
					associationType: "issueKeys",
					values: ["GH-9"]
				}]
			}]
		})
	})

	it("manual code_scanning_alert maps to multiple Jira issue keys", async () => {
		codeScanningPayload.action = "closed_by_user"
		const remoteLinks = transformCodeScanningAlert(buildContext(codeScanningPayload));
		expect(remoteLinks.remoteLinks[0].associations[0].values).toEqual(["GH-9", "GH-10", "GH-11"])
	})

	// TODO ARC-618
	it("code_scanning_alert with pr reference queries Pull Request title", async () => {
		codeScanningPayload.ref = "refs/pull/8/merge"
		const remoteLinks = transformCodeScanningAlert(buildContext(codeScanningPayload));
		expect(remoteLinks.remoteLinks[0].associations[0].values[0]).toEqual("GH-8");
	})
})
