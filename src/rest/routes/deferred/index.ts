import { Router } from "express";
import { DeferredCheckOwnershipAndConnectRoute } from "./deferred-check-ownership-and-connect";
import { JwtHandler } from "../../middleware/jwt/jwt-handler";
import { GitHubTokenHandler } from "~/src/rest/middleware/jwt/github-token";

import { DeferredInstallationUrlRoute } from "./deferred-installation-url";
import { DeferredRequestParseRoute } from "./deferred-request-parse";
import DeferredAnalyticsProxy from "~/src/rest/routes/deferred/deferred-analytics-proxy";
export const DeferredRouter = Router({ mergeParams: true });

DeferredRouter.get("/parse/:requestId", DeferredRequestParseRoute);

DeferredRouter.post("/analytics-proxy/:requestId", DeferredAnalyticsProxy);

DeferredRouter.get("/installation-url", JwtHandler, DeferredInstallationUrlRoute);

DeferredRouter.post("/connect/:requestId", GitHubTokenHandler, DeferredCheckOwnershipAndConnectRoute);
