import { Application } from "probot";
import { App } from "@octokit/app";
import { findPrivateKey } from "probot/lib/private-key";
import { caching } from "cache-manager";

import { setupApp } from "../../src/configure-robot";

export const createApplication = () => new Application({
	app: new App({
		id: 12257,
		privateKey: findPrivateKey()
	}),
	cache: caching({
		store: "memory",
		ttl: 60 * 60 // 1 hour
	}),
	throttleOptions: {
		enabled: false
	}
});
export const createWebhookApp = async (): Promise<Application> => await setupApp(createApplication());
