import { findOrStartSync } from "./sync-utils";
import { sqsQueues } from "../sqs/queues";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";

jest.mock("../sqs/queues");

describe("findOrStartSync", () => {
	describe("GitHubAppConfig", () => {
		it("should send gitHubAppConfig to msg queue", async () => {
			const sub = await Subscription.install({
				installationId: 123,
				host: "https://whatever.url",
				gitHubAppId: 456,
				clientKey: "clientKey"
			});

			await findOrStartSync(
				sub,
				getLogger("test"),
				undefined,
				undefined,
				undefined,
				{
					gitHubAppId: 456,
					appId: 111,
					clientId: "clientId",
					gitHubBaseUrl: "https://github.server",
					gitHubApiUrl: "https://github.server/api",
					uuid: "some-random-uuid"
				}
			);
			expect(sqsQueues.backfill.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					gitHubAppId: 456,
					appId: 111,
					clientId: "clientId",
					gitHubBaseUrl: "https://github.server",
					gitHubApiUrl: "https://github.server/api",
					uuid: "some-random-uuid"
				}
			}), expect.anything(), expect.anything());
		});
	});
});
