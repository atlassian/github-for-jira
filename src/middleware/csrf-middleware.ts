// setup route middlewares
import csrf from "csurf";
import { isNodeTest } from "utils/is-node-env";

export const csrfMiddleware = csrf(
	isNodeTest()
		? { ignoreMethods: ["GET", "HEAD", "OPTIONS", "POST", "PUT"] }
		: undefined
);
