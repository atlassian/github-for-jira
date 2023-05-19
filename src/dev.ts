import { Server } from "http";
import { Express } from "express";
import "config/env"; // Important to be before other dependencies
import { isNodeDev } from "utils/is-node-env";
import httpProxy from "http-proxy";

let proxy;
if (isNodeDev()) {
	proxy = httpProxy.createProxyServer({
		target: {
			host: "localhost",
			port: 5173,
			path: "/web"
		},
		ws: true
	});
}

export const proxyLocalUIIfDev = (app: Express) => {
	//for local dev proxy through to new react ui
	if (isNodeDev()) {
		app.use("/web", (req, res) => { proxy.web(req, res); });
	}
};

export const proxyLocalWSIfDev = (server: Server) => {
	//for local dev proxy through to new react ui
	if (isNodeDev()) {
		server.on("upgrade", (req, socket, head) => { proxy.ws(req, socket, head); });
	}
};

