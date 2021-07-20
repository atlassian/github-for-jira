import { isAdmin } from "../../../src/frontend/github-client-middleware";
import GitHubAPI from "../../../src/config/github-api";
import logger from "../../../src/config/logger"

describe("GitHub client middleware", () => {
  let adminFunction;

  beforeEach(async () => {
    adminFunction = isAdmin(GitHubAPI(), logger);
  });

  it("isAdmin returns true if user is admin of a given organization", async () => {
    githubNock
      .get("/orgs/test-org/memberships/test-user")
      .reply(200, { role: "admin" });

    const result = await adminFunction({
      org: "test-org",
      username: "test-user",
      type: "Organization"
    });

    expect(result).toBe(true);
  });

  it("isAdmin returns false if user is not an admin of a given organization", async () => {
    githubNock
      .get("/orgs/test-org/memberships/test-user")
      .reply(200, { role: "member" });

    const result = await adminFunction({
      org: "test-org",
      username: "test-user",
      type: "Organization"
    });

    expect(result).toBe(false);
  });

  it("isAdmin returns true if repo is owned by a given user", async () => {
    const result = await adminFunction({
      org: "test-user",
      username: "test-user",
      type: "User"
    });

    expect(result).toBe(true);
  });

  it("isAdmin returns false if repo is owned by another user", async () => {
    const result = await adminFunction({
      org: "different-user",
      username: "test-user",
      type: "User"
    });

    expect(result).toBe(false);
  });
});
