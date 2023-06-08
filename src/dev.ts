import { Server } from "http";
import { Express } from "express";
import httpProxy from "http-proxy";

/**
 * This is only for Dev environment,
 * You need to run spa separately by `yarn start`, which will be running at port `3000`,
 * That server is being proxied within this file, which makes developing in spa quicker and easier
 */
const proxy = httpProxy.createProxyServer({
	target: {
		host: "localhost",
		port: 3000,
		path: "/public/build"
	},
	ws: true
});

export const proxyLocalUI = (app: Express) => {
	app.use("/public/build", (req, res) => proxy.web(req, res));
};

export const proxyLocalWS = (server: Server) => {
	server.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));
};
