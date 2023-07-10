import { Router } from "express";
import { JwtHandler } from "./jwt/jwt-handler";
import { OAuthRouter } from "./oauth/oauth-router";

export const RestRouter = Router();

RestRouter.use(JwtHandler);

RestRouter.use("/oauth", OAuthRouter);

