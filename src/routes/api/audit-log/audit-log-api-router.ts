import { Router } from "express";
import { ApiAuditLogGetBySubscriptionId } from "./audit-log-get-by-sub-id";
import { param, query } from "express-validator";
import { returnOnValidationError } from "../api-utils";

export const AuditLogApiRouter = Router({ mergeParams: true });

AuditLogApiRouter.get("/subscription/:subscriptionId",
	param("subscriptionId").isInt(),
	query("entityType").isString(),
	query("entityId").isString(),
	query("issueKey").isString(),
	returnOnValidationError,
	ApiAuditLogGetBySubscriptionId
);
