/* eslint-disable @typescript-eslint/no-explicit-any */
import jwt from "atlassian-jwt";
import { mocked } from "ts-jest/utils";
import { Installation } from "../../../src/models";
import verifyJiraMiddleware from "../../../src/frontend/verify-jira-middleware";

describe("#verifyJiraMiddleware", () => {
  let res;
  let next;
  let installation;
  let subscription;

  beforeEach(async () => {
    res.locals = {};

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

    mocked(Installation.getForHost).mockResolvedValue(installation);
  });

  describe("GET request", () => {
    const buildRequest = (jiraHost, secret = "secret"): any => {
      const jwtValue = jwt.encode("test-jwt", secret);

      return {
        query: {
          xdm_e: jiraHost,
          jwt: jwtValue
        },
        addLogFields: () => undefined
      };
    };

    it("should call next with a valid token and secret", async () => {
      const req = buildRequest("test-host", "secret");

      // TODO: update testdouble call
      // td.when(jwt.decode(req.query.jwt, 'secret'));

      await verifyJiraMiddleware(req, res, next);

      // TODO: update testdouble call
      // td.verify(next());
    });

    it("sets res.locals to installation", async () => {
      const req = buildRequest("host", "secret");

      const installation = { jiraHost: "host", sharedSecret: "secret" };

      // TODO: update testdouble call
      // td.when(jwt.decode(req.query.jwt, 'secret'));

      await verifyJiraMiddleware(req, res, next);

      expect(res.locals.installation).toEqual(installation);
    });

    it("should return a 404 for an invalid installation", async () => {
      const req = buildRequest("host");

      await verifyJiraMiddleware(req, res, next);

      // TODO: update testdouble call
      // td.verify(next(td.matchers.contains(new Error('Not Found'))));
    });

    it("should return a 401 for an invalid jwt", async () => {
      const req = buildRequest("good-host", "wrong-secret");

      await verifyJiraMiddleware(req, res, next);

      // TODO: update testdouble call
      // td.verify(next(td.matchers.contains(new Error('Unauthorized'))));
    });

    it("adds installation details to log", async () => {
      const req = buildRequest("host", "secret");
      const addLogFieldsSpy = jest.spyOn(req, "addLogFields");

      const installation = {
        jiraHost: "host",
        sharedSecret: "secret",
        clientKey: "abcdef"
      };

      // TODO: update testdouble call
      // td.when(jwt.decode(req.query.jwt, 'secret'));

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
        addLogFields: () => undefined
      };
    };

    it("pulls jiraHost and token from body", async () => {
      const req = buildRequest("host", "secret");

      // TODO: update testdouble call
      // td.when(jwt.decode(req.body.token, 'secret'));

      await verifyJiraMiddleware(req, res, next);

      // TODO: update testdouble call
      // td.verify(next());
    });

    it("is not found when host is missing", async () => {
      const req = buildRequest("host", "secret");

      await verifyJiraMiddleware(req, res, next);

      // TODO: update testdouble call
      // td.verify(next(td.matchers.contains(new Error('Not Found'))));
    });

    it("is unauthorized when token missing", async () => {
      const req = buildRequest("host", "secret");

      await verifyJiraMiddleware(req, res, next);

      // TODO: update testdouble call
      // td.verify(next(td.matchers.contains(new Error('Unauthorized'))));
    });
  });
});
