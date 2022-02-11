// setup route middlewares
import csrf from "csurf";
import { isNodeTest } from "../util/isNodeEnv";

export const csrfMiddleware = csrf(
	isNodeTest()
		? { ignoreMethods: ["GET", "HEAD", "OPTIONS", "POST", "PUT"] }
		: undefined
);
