import "config/env";
import express, { Router } from "express";
import { getLogger } from "./config/logger";
import { setupGithubWebhooks } from "./webhook/setupGithubWebhooks";
import { webhookReceiver } from "./webhook/webhook-receiver";
import { Webhooks } from "./webhook/webhooks";
const app = express();
const port = 8082; 

const logger =  getLogger("server");

const webhooks = new Webhooks();
setupGithubWebhooks(webhooks);

const RootRouter = Router();
RootRouter.post("/webhook/event/:uuid", webhookReceiver.bind(null, webhooks));

app.use(RootRouter);


app.listen( port, () => {
	logger.info( `server listening at port ${ port }` );
} );