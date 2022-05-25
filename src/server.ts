import "config/env";
import express from "express";
import { RootRouter } from "./routes/router";
import { setupGithubWebhooks } from "./webhook/setupGithubWebhooks";
import { webhookReceiver } from "./webhook/webhook-receiver";
import { Webhooks } from "./webhook/webhooks";
const app = express();
const port = 8082; 


const webhooks = new Webhooks();
setupGithubWebhooks(webhooks);
RootRouter.post("/webhook/event/:uuid", webhookReceiver.bind(null, webhooks));

app.use(RootRouter);


app.listen( port, () => {
	console.log( `server listening at port ${ port }` );
} );