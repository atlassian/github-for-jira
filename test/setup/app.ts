/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-var-requires */
import { Application } from "probot";
import { findPrivateKey } from "probot/lib/private-key";
import { caching } from "cache-manager";
import { App } from "@octokit/app";
import { TestDouble } from "testdouble";
import Nock from "nock";
import * as NockFunction from "nock";

declare global {
  let app: Application;
  let nock: typeof Nock;
  let td: TestDouble<any>;
  let models: any;

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      app: Application;
      nock: typeof NockFunction;
      td: TestDouble<any>;
      models: any;
    }
  }
}

// DO NOT TOUCH, EXTREMELY FLAKY WITH TS
global.nock = require("nock");
global.td = require("testdouble");

beforeAll(() => {
  require("testdouble-jest")(td, jest);
  require("testdouble-nock")(td, nock);
});

beforeEach(async () => {
  global.models = td.replace("../../src/models", {
    Installation: td.object([
      "getForHost",
      "findByPk",
      "build",
      "getPendingHost",
      "install"
    ]),
    Subscription: td.object([
      "getAllForInstallation",
      "install",
      "getSingleInstallation",
      "findOrStartSync",
      "getAllForHost"
    ]),
    Project: td.object(["incrementOccurence"])
  });

  td.when(models.Installation.getForHost(process.env.ATLASSIAN_URL))
    .thenResolve({
      jiraHost: process.env.ATLASSIAN_URL,
      sharedSecret: process.env.ATLASSIAN_SECRET
    });

  td.when(models.Subscription.getAllForInstallation(1234))
    .thenResolve([
      {
        jiraHost: process.env.ATLASSIAN_URL
      }
    ]);

  td.when(models.Subscription.getSingleInstallation(process.env.ATLASSIAN_URL, 1234))
    .thenResolve({ id: 1, jiraHost: process.env.ATLASSIAN_URL });

  td.when(models.Project.incrementOccurence("PROJ-1", process.env.ATLASSIAN_URL))
    .thenResolve({
      projectKey: "PROJ"
    });

  nock("https://api.github.com")
    .post(/\/app\/installations\/[\d\w-]+\/access_tokens/)
    .reply(200, {
      token: "mocked-token",
      expires_at: "9999-12-31T23:59:59Z"
    })
    .get("/repos/test-repo-owner/test-repo-name/contents/.github/jira.yml")
    .reply(200, {
      content: Buffer.from(`jira: ${process.env.ATLASSIAN_URL}`).toString("base64")
    });

  const configureRobot = (await import("../../src/configure-robot")).default;

  global.app = await configureRobot(new Application({
    app: new App({
      id: 12257,
      privateKey: findPrivateKey()
    }),
    cache: caching({
      store: "memory",
      ttl: 60 * 60 // 1 hour
    }),
    throttleOptions: {
      enabled: false
    }
  }));
});

afterEach(() => {
  nock.cleanAll();
  td.reset();
});
