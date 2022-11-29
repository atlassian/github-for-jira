import { Router } from "express";
import { ApiConfiguredGet } from "routes/api/configured/api-configured-get";
import { ApiConfiguredPost } from "routes/api/configured/api-configured-post";

export const ApiConfiguredRouter = Router({ mergeParams: true });

ApiConfiguredRouter.get("/:installationId", ApiConfiguredGet);
ApiConfiguredRouter.post("/", ApiConfiguredPost);
