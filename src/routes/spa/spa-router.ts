import { Router, static as Static } from "express";
import path from "path";

export const SpaRouter = Router();

const rootPath = process.cwd();

//Asset from root static folder shared with existing experience
SpaRouter.use("/spa-assets", Static(path.join(rootPath, "static/assets")));

//Asset from within the new spa expereicen in /spa/build/static
SpaRouter.use("/static", Static(path.join(rootPath, 'spa/build/static')));

//Because it is Single Page App, for all routes to /spa/screen1 , /spa/screen1/step2 should render the spa index.html anyway
SpaRouter.use("/*", function SpaIndexHtml(_, res) { res.sendFile(path.join(process.cwd(), "spa/build/index.html")); });
