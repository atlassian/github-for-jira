import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { RepoSyncState } from "models/reposyncstate";
import safeJsonStringify from "safe-json-stringify";

const log = getLogger("RecoverClientKeyPost");

const getCleanupSql = (repoSyncStateId: number) => {
	return `delete from "RepoSyncStates" where not exists (select null from "Subscriptions" where "RepoSyncStates"."subscriptionId" = "Subscriptions"."id")  and "RepoSyncStates"."id" <= ${repoSyncStateId}`;
};

export const RepoSyncStateCleanUpOrphanDataPost = async (req: Request, res: Response): Promise<void> => {
	const repoSyncStateId = Number(req.query.repoSyncStateId) || -1;
	try {
		const result = await RepoSyncState.sequelize?.query(getCleanupSql(repoSyncStateId));
		log.info({ count: result }, "Orphan RepoSyncStates data deleted");
		res.status(200).end("Done. Count: " + result);
	} catch (e) {
		log.error(e, "Error deleting orphan RepoSyncStates data");
		res.status(500).end(safeJsonStringify(e));
	}
};
