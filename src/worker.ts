import throng from "throng";
import { start } from "./worker/main";
import { isNodeProd } from "./util/isNodeEnv";

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (isNodeProd()) {
	throng({
		lifetime: Infinity
	}, start);
} else {
	start();
}

