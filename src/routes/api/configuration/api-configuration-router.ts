import { Router } from "express";
import { ApiConfigurationGet } from "routes/api/configuration/api-configuration-get";
import { ApiConfigurationPost } from "routes/api/configuration/api-configuration-post";

export const ApiConfigurationRouter = Router({ mergeParams: true });

ApiConfigurationRouter.get("/:installationId", ApiConfigurationGet);
ApiConfigurationRouter.post("/", ApiConfigurationPost);
