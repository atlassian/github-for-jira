import throng from "throng";
import { start } from "./worker/main";
import { isNodeProd } from "./util/isNodeEnv";
import { listenToMicrosLifecycle } from "./services/micros/lifecycle";

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (isNodeProd()) {
	// Listen to micros lifecycle event to know when to start/stop
	listenToMicrosLifecycle(() => {
		// Start clustered server
		throng({ lifetime: Infinity }, start);
	}, () => {
		// TODO: add shutdown mechanism here - might need different clustering lib
	});
} else {
	start();
}

