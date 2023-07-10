import { Router } from "express";
import { JwtHandler } from "routes/rest/middleware/jwt/jwt-handler";
import { OAuthRouter } from "routes/rest/routes/oauth";

export const RestRouter = Router({ mergeParams: true });

const subRouter = Router({ mergeParams: true });

/**
 * For cloud flow, the path will be `/rest/app/cloud/XXX`,
 * For enterprise flow, the path will be `/rest/app/SERVER-UUID/XXX`
 */
RestRouter.use("/app/:cloudOrUUID", subRouter);

subRouter.use(JwtHandler);

subRouter.use("/oauth", OAuthRouter);
