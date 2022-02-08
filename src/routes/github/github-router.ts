import express from "express";
import { GithubConfigurationGet } from "./configuration/github-configuration-GET";
import { GithubConfigurationPost } from "./configuration/github-configuration-POST";
import { GithubSetupGet } from "./setup/github-setup-GET";
import { GithubSetupPost } from "./setup/github-setup-POST";
import { GithubSubscriptionGet } from "./subscription/github-subscription-GET";
import { GithubSubscriptionDelete } from "./subscription/github-subscription-DELETE";

export const GithubRouter = express.Router();

GithubRouter.get("/configuration", GithubConfigurationGet);
GithubRouter.post("/configuration", GithubConfigurationPost);

GithubRouter.get("/setup", GithubSetupGet);
GithubRouter.post("/setup", GithubSetupPost);

GithubRouter.get("/subscription", GithubSubscriptionGet);
GithubRouter.delete("/subscription", GithubSubscriptionDelete);
