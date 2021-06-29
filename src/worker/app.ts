// FIXME: This is all a bit of a hack to get access to a Probot Application
//        instance, mainly to use the `auth()` method. Probot needs refactored
//        so that method is more easily accessible.

import {Application, createProbot} from 'probot';
import { findPrivateKey } from 'probot/lib/private-key';
import setupDeepcheck from "../deepcheck";

export const probot = createProbot({
  id: Number(process.env.APP_ID),
  cert: findPrivateKey(),

  // These aren't needed by worker process
  secret: undefined,
  port: Number(process.env.WORKER_PORT) || Number(process.env.PORT) || 8081,
  webhookPath: undefined,
  webhookProxy: undefined,
});

const App = async (app: Application): Promise<Application> => {
  // Deepcheck and Healthchecks endpoints for checking app health
  setupDeepcheck(app);
  return app;
};

// We are always behind a proxy, but we want the source IP
probot.server.set('trust proxy', true);

// Load an empty app so we can get access to probot's auth handling
// eslint-disable-next-line @typescript-eslint/no-empty-function
export default probot.load(App);

