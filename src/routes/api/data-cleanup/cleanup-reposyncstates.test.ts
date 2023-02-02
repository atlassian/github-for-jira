import supertest from "supertest";
import express, { Application, NextFunction, Request, Response } from "express";
import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { RepoSyncState } from "models/reposyncstate";

const DEFAULT_BATCH_SIZE = 1000;

const log = getLogger("RecoverClientKeyPost");

const getCleanupSql = (size: number) => {
	return `delete from "RepoSyncStates" where not exists (select null from "Subscriptions" where "RepoSyncStates"."subscriptionId" = "Subscriptions"."id") order by "RepoSyncStates"."updatedAt" limit ${size}`;
};

export const RepoSyncStateCleanUpOrphanDataPost = async (req: Request, res: Response): Promise<void> => {
	const batchSize = Number(req.query.batchSize) || DEFAULT_BATCH_SIZE;
	const result = await RepoSyncState.sequelize?.query(getCleanupSql(batchSize));
	log.info({ count: result }, "Orphan RepoSyncStates data deleted");
	res.status(204).end("Done. Count: " + result);
};
