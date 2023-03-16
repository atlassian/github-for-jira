import { Request, Response } from "express";
import { RepoSyncState } from "models/reposyncstate";
import { Op } from "sequelize";
import { getLogger } from "config/logger";
import safeJsonStringify from "safe-json-stringify";

const DEFAULT_BATCH_SIZE = 5000;

export const ResetFailedAndPendingDeploymentCursorPost = async (req: Request, res: Response): Promise<void> => {

	const log = getLogger("ResetFailedAndPendingDeploymentCursorPost");

	try {

		const startRepoSyncStatesId = Number(req.query.startRepoSyncStatesId) || 0;
		const batchSize = Number(req.query.batchSize) || DEFAULT_BATCH_SIZE;

		const info = (msg: string) => {
			log.info(msg);
			res.write(msg + "\n");
		};

		res.status(200);

		info(`Start resetting deployment task cursor for RepoSyncState starting from ${startRepoSyncStatesId} with batch size ${batchSize}`);

		const repoSyncStatesToBeUpdated: RepoSyncState[] = await RepoSyncState.findAll({
			limit: batchSize,
			where: {
				[Op.and]: {
					"deploymentStatus": {
						[Op.or]: {
							[Op.is]: undefined,
							[Op.in]: ["pending", "failed"]
						}
					},
					"id": {
						[Op.gte]: startRepoSyncStatesId
					}
				}
			},
			order: [ ["id", "ASC"] ]
		});
		info(`Found ${repoSyncStatesToBeUpdated.length} repo sync states potentially to look at`);

		let count = 0;
		let lastId: number | undefined;
		for (const repo of repoSyncStatesToBeUpdated) {
			if (!repo.deploymentStatus || repo.deploymentStatus === "pending" || repo.deploymentStatus === "failed") {
				//just double check it is the record we want to update
				if (repo.deploymentCursor) {
					//resetting the cursor since we are changing the pagination order from asc to desc
					await repo.update({
						deploymentCursor: null
					});
					count++;
				}
			}
			lastId = repo.id;
		}
		info(`${count} repo sync states updated, last RepoSyncState id is ${lastId})`);

		res.end();

	} catch (e) {
		log.error({ err: e }, "Error happen when reseting deployment cursor");
		res.end(`Error happen when reseting deployment cursor: ${safeJsonStringify(e)}`);
	}

};
