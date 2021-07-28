import supertest from "supertest";
import { BooleanEnum, isMaintenanceMode } from "../../../src/config/env";
import express from "express";
import healthcheck from "../../../src/frontend/healthcheck";
import setupFrontend from "../../../src/frontend/app";

describe("Maintenance", () => {
  let app;
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = BooleanEnum.true;
    app = express();
  });

  describe("Environment", () => {
    it("should return `true` if Maintenance Mode is \"true\"", () => {
      expect(isMaintenanceMode()).toBeTruthy();
    });

    it("should return `false` if Maintenance Mode is \"false\", not set, undefined, or any other string", () => {
      process.env.MAINTENANCE_MODE = "false";
      expect(isMaintenanceMode()).toBeFalsy();
      delete process.env.MAINTENANCE_MODE;
      expect(isMaintenanceMode()).toBeFalsy();
      process.env.MAINTENANCE_MODE = undefined;
      expect(isMaintenanceMode()).toBeFalsy();
      process.env.MAINTENANCE_MODE = "";
      expect(isMaintenanceMode()).toBeFalsy();
      process.env.MAINTENANCE_MODE = "foobar";
      expect(isMaintenanceMode()).toBeFalsy();
    });
  });

  describe("Healthcheck", () => {
    beforeEach(() => {
      app.use("/", healthcheck);
    });
    it("should still work in maintenance mode", () =>
      supertest(app)
        .get("/healthcheck")
        .expect(200));

    it("deepcheck should still work in maintenance mode", () =>
      supertest(app)
        .get("/deepcheck")
        .expect(200));
  });

  // describe("Github", () => {});

  describe("Frontend", () => {
    beforeEach(() => {
      app.use("/", setupFrontend({
        getSignedJsonWebToken: () => undefined,
        getInstallationAccessToken: () => undefined
      }));
    });
    describe("Jira", () => {
      it("should return a non 200 status code when in maintenance mode", () =>
        supertest(app)
          .get("/jira/atlassian-connect.json")
          .then(response => {
            expect(response.status).not.toBe(200);
          }));

      it("should return a 200 status code when not in maintenance mode", () => {
        delete process.env.MAINTENANCE_MODE;
        return supertest(app)
          .get("/jira/atlassian-connect.json")
          .expect(200);
      });
    });

    describe("Admin API", () => {
      beforeEach(() => {
        githubNock
          .post("/graphql")
          .reply(200, {
            data: {
              viewer: {
                login: "monalisa",
                organization: {
                  viewerCanAdminister: true
                }
              }
            }
          });
      });

      it("should still work in maintenance mode", () =>
        supertest(app)
          .get("/api")
          .set("Authorization", "Bearer xxx")
          .expect(200));
    });

    describe("Maintenance", () => {
      it("should return maintenance page on \"/maintenance\" even if maintenance mode is off", () => {
        delete process.env.MAINTENANCE_MODE;
        return supertest(app)
          .get("/maintenance")
          .expect(503)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });

      it("should return 503 for any frontend routes", () =>
        supertest(app)
          .get("/jira/atlassian-connect.json")
          .expect(503)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          }));

      it("should return expected page when maintenance mode is off", () => {
        delete process.env.MAINTENANCE_MODE;
        return supertest(app)
          .get("/jira/atlassian-connect.json")
          .expect(200).then(response => {
            // removing keys that changes for every test run
            delete response.body.baseUrl;
            delete response.body.name;
            delete response.body.key;
            expect(response.body).toMatchSnapshot();
          });
      });

      it("should still be able to get static assets in maintenance mode", () =>
        supertest(app)
          .get("/public/maintenance.svg")
          .set("Accept", "image/svg+xml")
          .expect("Content-Type", "image/svg+xml")
          .expect(200)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          }));
    });
  });
});
