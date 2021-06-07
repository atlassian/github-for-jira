/* eslint-disable @typescript-eslint/no-explicit-any */
import jwt from "atlassian-jwt";
import { mocked } from "ts-jest/utils";
import { Installation } from "../../../src/models";
import verifyJiraMiddleware from "../../../src/frontend/verify-jira-middleware";

jest.mock("../../../src/models");

describe("#verifyJiraMiddleware", () => {
  let res;
  const next = jest.fn();
  let installation;
  let subscription;

  beforeEach(async () => {
    res = {
      locals: {}
    };

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
  });

  describe("GET request", () => {
    const buildRequest = (jiraHost, secret = "secret"): any => {
      const jwtValue = jwt.encode("test-jwt", secret);

      return {
        query: {
          xdm_e: jiraHost,
          jwt: jwtValue
        },
        session: {
          jiraHost: subscription.jiraHost
        },
        addLogFields: jest.fn()
      };
    };

    it("should call next with a valid token and secret", async () => {
      mocked(Installation.getForHost).mockResolvedValue(installation);
      const req = buildRequest("test-host", "secret");
      jwt.decode(req.query.jwt, "secret");

      await verifyJiraMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("sets res.locals to installation", async () => {
      mocked(Installation.getForHost).mockResolvedValue(installation);
      const req = buildRequest("host", "secret");
      jwt.decode(req.query.jwt, "secret");

      await verifyJiraMiddleware(req, res, next);

      expect(res.locals.installation).toEqual(installation);
    });

    it("should return a 404 for an invalid installation", async () => {
      const req = buildRequest("host");

      await verifyJiraMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(new Error("Not Found"));
    });

    it("should return a 401 for an invalid jwt", async () => {
      mocked(Installation.getForHost).mockResolvedValue(installation);
      const req = buildRequest("good-host", "wrong-secret");

      await verifyJiraMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
    });

    it("adds installation details to log", async () => {
      mocked(Installation.getForHost).mockResolvedValue(installation);
      const req = buildRequest("host", "secret");
      const addLogFieldsSpy = jest.spyOn(req, "addLogFields");

      jwt.decode(req.query.jwt, "secret");

      await verifyJiraMiddleware(req, res, next);

      expect(addLogFieldsSpy).toHaveBeenCalledWith({
        jiraHost: installation.jiraHost,
        jiraClientKey: installation.clientKey
      });
    });
  });

  describe("POST request", () => {
    const buildRequest = (jiraHost, secret): any => {
      const encodedJwt = secret && jwt.encode("test-jwt", secret);

      return {
        body: {
          jiraHost,
          token: encodedJwt
        },
        session: {
          jiraHost: subscription.jiraHost
        },
        query: {
          xdm_e: jiraHost,
          jwt: encodedJwt
        },
        addLogFields: jest.fn()
      };
    };

    it("pulls jiraHost and token from body", async () => {
      mocked(Installation.getForHost).mockResolvedValue(installation);
      const req = buildRequest("host", "secret");
      jwt.decode(req.query.jwt, "secret");

      await verifyJiraMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("is not found when host is missing", async () => {
      const req = buildRequest("host", "secret");

      await verifyJiraMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(new Error("Not Found"));
    });

    it("is unauthorized when token missing", async () => {
      mocked(Installation.getForHost).mockResolvedValue(installation);
      const req = buildRequest("host", "secret");

      await verifyJiraMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
    });
  });
});
