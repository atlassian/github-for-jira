import { Server } from "http";
import { Express } from "express";
import httpProxy from "http-proxy";
import { isNodeDev } from "utils/is-node-env";

const SPA_PATH = "/spa";

const proxy = httpProxy.createProxyServer({
	target: {
		host: "localhost",
		port: 5173,
		path: SPA_PATH
	},
	ws: true
});

export const proxyLocalUIForDev = (app: Express) => {
	if (isNodeDev()) {
		app.use(SPA_PATH, (req, res) => proxy.web(req, res));
	}
};

export const proxyLocalWSForDev = (server: Server) => {
	if (isNodeDev()) {
		server.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));
	}
};
