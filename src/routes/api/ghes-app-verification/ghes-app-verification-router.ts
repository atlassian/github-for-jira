import { Router } from "express";
import { GHESVerifyGetApps } from "./ghes-app-verify-get-apps";

export const GHESVerificationRouter = Router();
GHESVerificationRouter.post("/verify-get-apps", GHESVerifyGetApps);

