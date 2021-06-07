import Keygrip from "keygrip";
import supertest from "supertest";
import testTracking from "../../setup/tracking";
import { mocked } from "ts-jest/utils";
import { Installation, Subscription } from "../../../src/models";
import FrontendApp from "../../../src/frontend/app";

jest.mock("../../../src/models");

describe("Frontend", () => {
  let frontendApp;
  let installation;
  let subscription;

  const authenticatedUserResponse = { login: "test-user" };
  const adminUserResponse = { login: "admin-user" };
  const organizationMembershipResponse = { role: "member" };
  const organizationAdminResponse = { role: "admin" };
  const userInstallationsResponse = {
    total_count: 2,
    installations: [
      {
        account: {
          login: "test-org"
        },
        id: 1,
        target_type: "Organization"
      },
      {
        id: 3
      }
    ]
  };

  function getCookieHeader(fixture): string[] {
    const cookie = Buffer.from(JSON.stringify(fixture)).toString("base64");
    const keygrip = Keygrip([process.env.GITHUB_CLIENT_SECRET]);

    return [
      `session=${cookie};session.sig=${keygrip.sign(`session=${cookie}`)};`
    ];
  }

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

    frontendApp = FrontendApp({
      getSignedJsonWebToken: jest.fn().mockReturnValue("github-token"),
      getInstallationAccessToken: jest.fn().mockReturnValue("access-token")
    });
  });

  describe("GitHub Configuration", () => {
    describe("#post", () => {
      it("should return a 401 if no GitHub token present in session", () =>
        supertest(frontendApp)
          .post("/github/configuration")
          .send({})
          .set(
            "Cookie",
            getCookieHeader({
              jiraHost: "test-jira-host"
            })
          )
          .expect(401));

      it("should return a 401 if no Jira host present in session", () =>
        supertest(frontendApp)
          .post("/github/configuration")
          .send({})
          .set(
            "Cookie",
            getCookieHeader({
              githubToken: "test-github-token"
            })
          )
          .expect(401));

      it("should return a 401 if the user doesn't have access to the requested installation ID", () => {
        githubNock
          .get("/user/installations")
          .reply(200, userInstallationsResponse);
        return supertest(frontendApp)
          .post("/github/configuration")
          .send({
            installationId: 2
          })
          .type("form")
          .set(
            "Cookie",
            getCookieHeader({
              githubToken: "test-github-token",
              jiraHost: "test-jira-host"
            })
          )
          .expect(401);
      });

      it("should return a 401 if the user is not an admin of the Org", () => {
        githubNock
          .get("/user/installations")
          .reply(200, userInstallationsResponse);
        githubNock
          .get("/user")
          .reply(200, authenticatedUserResponse);
        githubNock
          .get("/orgs/test-org/memberships/test-user")
          .reply(200, organizationMembershipResponse);
        return supertest(frontendApp)
          .post("/github/configuration")
          .send({
            installationId: 1
          })
          .type("form")
          .set(
            "Cookie",
            getCookieHeader({
              githubToken: "test-github-token",
              jiraHost: "test-jira-host"
            })
          )
          .expect(401);
      });

      it("should return a 400 if no installationId is present in the body", () =>
        supertest(frontendApp)
          .post("/github/configuration")
          .send({})
          .set(
            "Cookie",
            getCookieHeader({
              githubToken: "test-github-token",
              jiraHost: "test-jira-host"
            })
          )
          .expect(400));

      it("should return a 200 and install a Subscription", async () => {
        const jiraHost = "test-jira-host";

        githubNock
          .get("/user/installations")
          .reply(200, userInstallationsResponse);
        githubNock
          .get("/user")
          .reply(200, adminUserResponse);
        githubNock
          .get("/orgs/test-org/memberships/admin-user")
          .reply(200, organizationAdminResponse);

        await testTracking();

        const jiraClientKey = "a-unique-client-key";

        await supertest(frontendApp)
          .post("/github/configuration")
          .send({
            installationId: 1,
            clientKey: jiraClientKey
          })
          .type("form")
          .set(
            "Cookie",
            getCookieHeader({
              githubToken: "test-github-token",
              jiraHost
            })
          )
          .expect(200);
      });
    });
  });
});
