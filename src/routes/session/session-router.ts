import { Router } from "express";
import { SessionCloudGet, SessionEnterpriseGet, SessionGet } from "routes/session/session-get";

export const SessionRouter = Router();

SessionRouter.get(["/enterprise", "/enterprise/*"], SessionEnterpriseGet);
SessionRouter.get(["/cloud", "/cloud/*"], SessionCloudGet);
SessionRouter.get(["/", "/*"], SessionGet);
