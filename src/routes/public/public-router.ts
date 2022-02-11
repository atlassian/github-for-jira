import { Router, static as Static } from "express";
import path from "path";

export const PublicRouter = Router();

const rootPath = process.cwd();
PublicRouter.use("/", Static(path.join(rootPath, "static")));
PublicRouter.use("/css-reset", Static(path.join(rootPath, "node_modules/@atlaskit/css-reset/dist")));
PublicRouter.use("/primer", Static(path.join(rootPath, "node_modules/primer/build")));
PublicRouter.use("/atlassian-ui-kit", Static(path.join(rootPath, "node_modules/@atlaskit/reduced-ui-pack/dist")));
PublicRouter.use("/aui", Static(path.join(rootPath, "node_modules/@atlassian/aui/dist/aui")));
