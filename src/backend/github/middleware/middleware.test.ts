import { logger } from "probot/lib/logger";
import { mocked } from "ts-jest/utils";
import { Installation, Subscription } from "../../models";
import GitHubAPI from "../../../config/github-api";
import middleware from ".";
import { mockModels } from "../../../../test-utils/mocks/models";

jest.mock("../../models");

describe("Probot event middleware", () => {
	describe("when processing fails for one subscription", () => {
		let context;
		beforeEach(async () => {
			context = {
				payload: {
					sender: { type: "not bot" },
					installation: { id: 1234 }
				},
				github: GitHubAPI(),
				log: logger
			};
		});

		it("calls handler for each subscription", async () => {
			const subscriptions = mockModels.Subscription.getAllForInstallation;
			// Repeat subscription 2 more times (3 total)
			subscriptions.push(subscriptions[0]);
			subscriptions.push(subscriptions[0]);
			mocked(Subscription.getAllForInstallation).mockResolvedValue(
				subscriptions
			);
			mocked(Installation.getForHost).mockResolvedValue(
				mockModels.Installation.getForHost
			);

			const spy = jest.fn();
			await expect(middleware(spy)(context)).toResolve();
			expect(spy).toHaveBeenCalledTimes(1);
		});
	});
});
