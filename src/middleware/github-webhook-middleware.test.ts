import { mocked } from "jest-mock";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { GithubWebhookMiddleware } from "./github-webhook-middleware";
import { mockModels } from "test/utils/models";
import { createLogger } from "bunyan";
import { emitWebhookFailedMetrics } from "utils/webhook-utils";

jest.mock("models/installation");
jest.mock("models/subscription");
jest.mock("utils/webhook-utils");

describe("Probot event middleware", () => {
	let context;
	beforeEach(async () => {
		context = {
			payload: {
				sender: { type: "not bot" },
				installation: { id: 1234 }
			},
			log: createLogger({ name: "test" })
		};

		const subscriptions = [...mockModels.Subscription.getAllForInstallation];
		// Repeat subscription 2 more times (3 total)
		subscriptions.push(subscriptions[0]);
		subscriptions.push(subscriptions[0]);
		mocked(Subscription.getAllForInstallation).mockResolvedValue(
			subscriptions
		);
	});

	describe("calls handler for each subscription", () => {
		it("when all ok", async () => {

			mocked(Installation.getForHost).mockResolvedValue(
				mockModels.Installation.getForHost
			);

			const spy = jest.fn();
			await expect(GithubWebhookMiddleware(spy)(context)).toResolve();
			expect(spy).toHaveBeenCalledTimes(3);
		});

		it("when one call fails", async () => {
			mocked(Installation.getForHost).mockResolvedValue(
				mockModels.Installation.getForHost
			);

			const spy = jest.fn().mockRejectedValueOnce(new Error("Failed!"));
			await expect(GithubWebhookMiddleware(spy)(context)).toResolve();
			expect(spy).toHaveBeenCalledTimes(3);
		});

		it("when all calls fail", async () => {
			mocked(Installation.getForHost).mockResolvedValue(
				mockModels.Installation.getForHost
			);

			const spy = jest.fn().mockRejectedValue(new Error("Failed!"));
			await expect(GithubWebhookMiddleware(spy)(context)).toResolve();
			expect(spy).toHaveBeenCalledTimes(3);
		});

		it("should not call slo metrics when call fails with 401/404s", async () => {
			mocked(Installation.getForHost).mockResolvedValue(
				mockModels.Installation.getForHost
			);

			const spy = jest.fn().mockRejectedValue(new Error("Request Failed with 401"));
			await expect(GithubWebhookMiddleware(spy)(context)).toResolve();
			expect(spy).toHaveBeenCalledTimes(3);
			expect(emitWebhookFailedMetrics).not.toHaveBeenCalled();
		});

		it("should call slo metrics when call fails with other errors", async () => {
			mocked(Installation.getForHost).mockResolvedValue(
				mockModels.Installation.getForHost
			);

			const spy = jest.fn().mockRejectedValue(new Error("Request Failed with 500"));
			await expect(GithubWebhookMiddleware(spy)(context)).toResolve();
			expect(spy).toHaveBeenCalledTimes(3);
			expect(emitWebhookFailedMetrics).toHaveBeenCalled();
		});
	});

	it("preserves parent log", async () => {
		context.log = context.log.child({ foo: 123 });
		await GithubWebhookMiddleware(jest.fn())(context);
		context.log.info("test");
		expect(context.log.fields.foo).toBe(123);
	});
});
