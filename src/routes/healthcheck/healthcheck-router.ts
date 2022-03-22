import { Router } from "express";
import { DeepcheckGet } from "./deepcheck-get";
import { HealthcheckGet } from "./healthcheck-get";

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
HealthcheckRouter.get("/healthcheck", HealthcheckGet);
