import { logger } from "probot/lib/logger";
import { mocked } from "ts-jest/utils";
import { Installation, Subscription } from "../../../src/models";
import GitHubAPI from "../../../src/config/github-api";
import middleware from "../../../src/github/middleware";
import { mockModels } from "../../utils/models";

jest.mock("../../../src/models");

describe("Probot event middleware", () => {

  describe("when processing fails for one subscription", () => {
    let context;
    let handlerCalls;

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
      mocked(Subscription.getAllForInstallation).mockResolvedValue(mockModels.Subscription.getAllForInstallation);
      mocked(Installation.getForHost).mockResolvedValue(mockModels.Installation.getForHost);

      handlerCalls = [];
      const handler = middleware((context, jiraClient, util) => {
        handlerCalls.push([context, jiraClient, util]);

        if (handlerCalls.length === 1) {
          throw Error("boom");
        }
      });

      await expect(handler(context)).toResolve();
      expect(handlerCalls.length).toEqual(3);
    });
  });
});
