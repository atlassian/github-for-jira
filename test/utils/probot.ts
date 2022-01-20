import { Application, GitHubAPI } from "probot";
import { App } from "@octokit/app";
import { findPrivateKey } from "probot/lib/private-key";
import { caching } from "cache-manager";
import { setupApp } from "../../src/configure-robot";

export const createApplication = () => {
	const app = new Application({
		app: new App({
			id: 12257,
			privateKey: findPrivateKey() || ""
		}),
		cache: caching({
			store: "none", // disable probot caching in tests
			ttl: 0
		}),
		throttleOptions: {
			enabled: false
		}
	});
	app.auth = jest.fn().mockResolvedValue(GitHubAPI());
	return app;
}
export const createWebhookApp = async (): Promise<Application> => await setupApp(createApplication());
