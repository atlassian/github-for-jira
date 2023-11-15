import { Router } from "express";
import { GHESVerifyGetApps } from "./ghes-app-verify-get-apps";

export const GHESVerificationRouter = Router({ mergeParams: true });
GHESVerificationRouter.post("/verify-get-apps", GHESVerifyGetApps);

