import { Router } from "express";
import { JwtHandler } from "./jwt/jwt-handler";
import { OAuthRouter } from "./oauth/oauth-router";

export const RestRouter = Router({ mergeParams: true });

const subRouter = Router({ mergeParams: true });
RestRouter.use("/app/:cloudOrUUID", subRouter);

subRouter.use(JwtHandler);
subRouter.use("/oauth", OAuthRouter);
