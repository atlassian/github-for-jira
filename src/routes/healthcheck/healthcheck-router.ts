import { Router } from "express";
import { DeepcheckGet } from "./deepcheck-get";
import { HealthcheckGetPost } from "./healthcheck-get-post";

export const HealthcheckRouter = Router();

/**
 * /deepcheck endpoint to checks to see that all our connections are OK
 *
 * It's a race between the setTimeout and our ping + authenticate.
 */
HealthcheckRouter.get("/deepcheck", DeepcheckGet);

/**
 * healthcheck endpoint to check that the app started properly
 */
HealthcheckRouter.get("/healthcheck", HealthcheckGetPost);
// To troubleshoot connectivity between GHEs and the app
HealthcheckRouter.post("/healthcheck/:uuid", HealthcheckGetPost);
