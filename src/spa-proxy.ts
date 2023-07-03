import { Server } from "http";
import { Express } from "express";
import httpProxy from "http-proxy";
import { isNodeDev, isNodeProd } from "utils/is-node-env";

const LOCAL_PORT = 5173;
const PROD_PORT = 4173;
/**
 * This is only for Dev environment,
 * You need to run spa separately by `yarn start`, which will be running at port `3000`,
 * That server is being proxied within this file, which makes developing in spa quicker and easier
 */
const proxy = httpProxy.createProxyServer({
	target: {
		host: "localhost",
		port: isNodeProd() ? PROD_PORT : LOCAL_PORT,
		path: "/spa"
	},
	ws: true
});

export const proxyLocalUIForDev = (app: Express) => {
	if (isNodeDev()) {
		app.use("/spa", (req, res) => proxy.web(req, res));
	}
};

export const proxyLocalWSForDev = (server: Server) => {
	if (isNodeDev()) {
		server.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));
	}
};
