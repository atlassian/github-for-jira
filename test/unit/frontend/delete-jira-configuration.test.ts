/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from "../../setup/tracking";
import nock from "nock";
import { Installation, Subscription } from "../../../src/models";
import { mocked } from "ts-jest/utils";
import deleteConfig from "../../../src/frontend/delete-jira-configuration";

jest.mock("../../../src/models");

describe("DELETE /jira/configuration", () => {
  let installation;
  let subscription;
  let deleteJiraConfiguration;

  beforeEach(async () => {
    subscription = {
      githubInstallationId: 15,
      jiraHost: "https://test-host.jira.com",
      destroy: jest.fn().mockResolvedValue(undefined)
    };

    installation = {
      id: 19,
      jiraHost: subscription.jiraHost,
      clientKey: "abc123",
      enabled: true,
      secrets: "def234",
      sharedSecret: "ghi345",
      subscriptions: jest.fn().mockResolvedValue([])
    };

    mocked(Subscription.getSingleInstallation).mockResolvedValue(subscription);
    mocked(Installation.getForHost).mockResolvedValue(installation);

    deleteJiraConfiguration = await deleteConfig;
  });

  it("Delete Jira Configuration", async () => {
    await testTracking();

    nock(subscription.jiraHost)
      .delete("/rest/devinfo/0.10/bulkByProperties")
      .query({ installationId: subscription.githubInstallationId })
      .reply(200, "OK");

    const req = {
      log: { debug: jest.fn(), error: jest.fn(), info: jest.fn()  },
      body: { installationId: subscription.githubInstallationId },
      query: {
        xdm_e: subscription.jiraHost
      },
      session: {
        jiraHost: subscription.jiraHost
      }
    };

    const res = { sendStatus: jest.fn(), locals: { installation } };
    await deleteJiraConfiguration(req as any, res as any);
    expect(subscription.destroy).toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
