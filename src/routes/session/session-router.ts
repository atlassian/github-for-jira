import { Router } from "express";
import { SessionEnterpriseGet, SessionGet } from "routes/session/session-get";

export const SessionRouter = Router();

SessionRouter.get(["/enterprise", "/enterprise/*"], SessionEnterpriseGet);
SessionRouter.get(["/", "/*"], SessionGet);
