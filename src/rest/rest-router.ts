import { Router } from "express";
import { JwtHandler } from "./middleware/jwt/jwt-handler";
import { errorWrapper } from "./helper";
import { OAuthRouter } from "./routes/oauth";
import { OAuthCallbackHandler, OrgsInstalledHandler, OrgsInstallRequestedHandler } from "./routes/github-callback";
import { GitHubOrgsRouter } from "./routes/github-orgs";
import { GitHubTokenHandler } from "./middleware/jwt/github-token";
import { GitHubAppsRoute } from "./routes/github-apps";
import { JiraCloudIDRouter } from "./routes/jira";
import { RestErrorHandler } from "./middleware/error";
import { JiraAdminEnforceMiddleware } from "./middleware/jira-admin/jira-admin-check";
import { AnalyticsProxyHandler } from "./routes/analytics-proxy";
import { SubscriptionsRouter } from "./routes/subscriptions";
import { DeferredRouter } from "./routes/deferred";
import { deleteEnterpriseAppHandler, deleteEnterpriseServerHandler } from "./routes/enterprise";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";

export const RestRouter = Router({ mergeParams: true });

const subRouter = Router({ mergeParams: true });
const gheServerRouter = Router({ mergeParams: true });

/**
 * Separate route which returns the list of both cloud and server subscriptions
 */
RestRouter.use("/subscriptions", JwtHandler, JiraAdminEnforceMiddleware, SubscriptionsRouter);

RestRouter.use("/ghes-servers/:serverUrl",JwtHandler, JiraAdminEnforceMiddleware, gheServerRouter);
gheServerRouter.delete("/", deleteEnterpriseServerHandler);

/**
 * For cloud flow, the path will be `/rest/app/cloud/XXX`,
 * For enterprise flow, the path will be `/rest/app/SERVER-UUID/XXX`
 */
RestRouter.use("/app/:cloudOrUUID", subRouter);

subRouter.get("/github-callback", OAuthCallbackHandler);
subRouter.get("/github-installed", OrgsInstalledHandler);
subRouter.get("/github-requested", OrgsInstallRequestedHandler);

subRouter.use("/oauth", OAuthRouter);

subRouter.use("/deferred", DeferredRouter);

// TODO: what about Jira admin validation (a.k.a. authorization, we
//  have done authentication only)?
subRouter.use(JwtHandler);
subRouter.use(JiraAdminEnforceMiddleware);
subRouter.use((req, _, next) => {
	//This only temporarily add the cloudOrUUID to uuid so that
	//we don't have to modify the existing GithubServerAppMiddleware
	//Once all migrated, we can remove this.
	const cloudOrUUID = req.params.cloudOrUUID;
	if (cloudOrUUID !== "cloud") {
		req.params.uuid = cloudOrUUID;
	}
	next();
}, errorWrapper("GithubServerAppMiddleware", GithubServerAppMiddleware));
// This is to delete GHE server with specific UUID
subRouter.delete("/", deleteEnterpriseAppHandler);
// This is to delete GHE app which is associated with specific server having UUID
// subRouter.delete("/ghe-app", deleteEnterpriseAppHandler);

subRouter.post("/analytics-proxy", AnalyticsProxyHandler);

subRouter.use("/installation", GitHubAppsRoute);

subRouter.use("/jira/cloudid", JiraCloudIDRouter);

subRouter.use("/subscriptions/:subscriptionId", SubscriptionsRouter);

subRouter.use(GitHubTokenHandler);

subRouter.use("/org", GitHubOrgsRouter);

subRouter.use(RestErrorHandler);
