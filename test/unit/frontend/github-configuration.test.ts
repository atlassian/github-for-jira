import Keygrip from "keygrip";
import supertest from "supertest";
import testTracking from "../../setup/tracking";
import nock from "nock";
import { mocked } from "ts-jest/utils";
import { Installation, Subscription } from "../../../src/models";
import frontendApp from "../../../src/frontend/app";

jest.mock("../../../src/models");

describe("Frontend", () => {
  let subject;
  let locals;
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

  let setIsDisabled;
  let originalDisabledState;

  beforeEach(async () => {
    const Frontend = frontendApp;
    locals = {
      client: {
        apps: {
          getInstallation: jest.fn().mockResolvedValue({ data: {} })
        }
      }
    };

    subject = Frontend(locals.client.apps);

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
  });

  afterEach(() => {
    setIsDisabled(originalDisabledState);
  });

  describe("GitHub Configuration", () => {
    describe("#post", () => {
      it("should return a 401 if no GitHub token present in session", () =>
        supertest(subject)
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
        supertest(subject)
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
        nock("https://api.github.com")
          .get("/user/installations")
          .reply(200, userInstallationsResponse);
        return supertest(subject)
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
        nock("https://api.github.com")
          .get("/user/installations")
          .reply(200, userInstallationsResponse);
        nock("https://api.github.com")
          .get("/user")
          .reply(200, authenticatedUserResponse);
        nock("https://api.github.com")
          .get("/orgs/test-org/memberships/test-user")
          .reply(200, organizationMembershipResponse);
        return supertest(subject)
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
        supertest(subject)
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

        nock("https://api.github.com")
          .get("/user/installations")
          .reply(200, userInstallationsResponse);
        nock("https://api.github.com")
          .get("/user")
          .reply(200, adminUserResponse);
        nock("https://api.github.com")
          .get("/orgs/test-org/memberships/admin-user")
          .reply(200, organizationAdminResponse);

        await testTracking();

        const jiraClientKey = "a-unique-client-key";

        await supertest(subject)
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
