import "config/env";
import express, { Router, json } from "express";
import { header } from "express-validator";
import { getLogger } from "./config/logger";
import { setupGithubWebhooks } from "./webhook/setupGithubWebhooks";
import { webhookReceiver } from "./webhook/webhook-receiver";
import { Webhooks } from "./webhook/webhooks";
const app = express();
const port = 8082;

const logger = getLogger("server");

app.use(json());

const webhooks = new Webhooks();
setupGithubWebhooks(webhooks);

const RootRouter = Router();
RootRouter.post("/webhook/event/:uuid",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).not().isEmpty().withMessage("Missing Header"),
	webhookReceiver.bind(null, webhooks));

app.use(RootRouter);


app.listen(port, () => {
	logger.info(`server listening at port ${port}`);
});