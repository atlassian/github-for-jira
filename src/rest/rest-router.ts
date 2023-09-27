import { Router } from "express";
import { JwtHandler } from "./middleware/jwt/jwt-handler";
import { OAuthRouter } from "./routes/oauth";
import { OAuthCallbackHandler, OrgsInstalledHandler, OrgsInstallRequestedHandler } from "./routes/github-callback";
import { GitHubOrgsRouter } from "./routes/github-orgs";
import { GitHubTokenHandler } from "./middleware/jwt/github-token";
import { GitHubAppsRoute } from "./routes/github-apps";
import { JiraCloudIDRouter } from "./routes/jira";
import { RestErrorHandler } from "./middleware/error";
import { JiraAdminEnforceMiddleware } from "./middleware/jira-admin/jira-admin-check";
import { AnalyticsProxyHandler } from "./routes/analytics-proxy";
import { DeferredInstallationUrlRoute } from "./routes/deferred-installation-url";
import { DeferredInstallRequestRoute } from "./routes/deferred-installation-url/redirect-route";

export const RestRouter = Router({ mergeParams: true });

const subRouter = Router({ mergeParams: true });

RestRouter.use("/deferred-installation/request/:requestId", DeferredInstallRequestRoute);

/**
 * For cloud flow, the path will be `/rest/app/cloud/XXX`,
 * For enterprise flow, the path will be `/rest/app/SERVER-UUID/XXX`
 */
RestRouter.use("/app/:cloudOrUUID", subRouter);

subRouter.get("/github-callback", OAuthCallbackHandler);
subRouter.get("/github-installed", OrgsInstalledHandler);
subRouter.get("/github-requested", OrgsInstallRequestedHandler);

// TODO: what about Jira admin validation (a.k.a. authorization, we
//  have done authentication only)?
subRouter.use(JwtHandler);
subRouter.use(JiraAdminEnforceMiddleware);

subRouter.post("/analytics-proxy", AnalyticsProxyHandler);

subRouter.use("/oauth", OAuthRouter);

subRouter.use("/installation", GitHubAppsRoute);

subRouter.use("/jira/cloudid", JiraCloudIDRouter);

subRouter.use("/deferred-installation-url", DeferredInstallationUrlRoute);

subRouter.use(GitHubTokenHandler);

subRouter.use("/org", GitHubOrgsRouter);

subRouter.use(RestErrorHandler);
