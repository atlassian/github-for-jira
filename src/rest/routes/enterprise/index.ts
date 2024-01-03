import { Router } from "express";
import { deleteEnterpriseServerHandler } from "./delete-ghe-server";
export { deleteEnterpriseAppHandler } from "./delete-ghe-app";
export const gheServerRouter = Router({ mergeParams: true });

gheServerRouter.delete("/", deleteEnterpriseServerHandler);
