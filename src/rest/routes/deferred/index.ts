import { Router } from "express";
import { DeferredInstallationUrlRoute } from "./deferred-installation-url";
import { DeferredRequestParseRoute } from "./deferred-request-parse";
import { DeferredCheckOwnershipAndConnectRoute } from "./deferred-check-ownership-and-connect";
import { JwtHandler } from "../../middleware/jwt/jwt-handler";
import { GitHubTokenHandler } from "~/src/rest/middleware/jwt/github-token";

export const DeferredRouter = Router({ mergeParams: true });

DeferredRouter.get("/installation-url", JwtHandler, DeferredInstallationUrlRoute);

DeferredRouter.get("/parse/:requestId", JwtHandler, DeferredRequestParseRoute);

DeferredRouter.post("/connect/:requestId", GitHubTokenHandler, DeferredCheckOwnershipAndConnectRoute);
