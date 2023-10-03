import { Request, Response } from "express";
import { RepoSyncState } from "models/reposyncstate";
import { Op } from "sequelize";
import { getLogger } from "config/logger";
import safeJsonStringify from "safe-json-stringify";

const DEFAULT_BATCH_SIZE = 5000;

export const ResetFailedAndPendingDeploymentCursorPost = async (req: Request, res: Response): Promise<void> => {

	const log = getLogger("ResetFailedAndPendingDeploymentCursorPost");

	try {

		const startRepoSyncStatesId: number = Number(req.query.startRepoSyncStatesId) || 0;
		const batchSize: number = Number(req.query.batchSize) || DEFAULT_BATCH_SIZE;
		const extraRepoSyncIdsToReset: number[] = String(req.query.extraRepoSyncIdsToReset).split(",").map(id => Number(id)).filter(n => !!n);

		const info = (msg: string) => {
			log.info(msg);
			res.write(msg + "\n");
		};

		res.status(200);

		info(`Start resetting deployment task cursor for RepoSyncState starting from ${startRepoSyncStatesId} with batch size ${batchSize}`);

		const repoSyncStatesToBeUpdated: RepoSyncState[] = await RepoSyncState.findAll({
			limit: batchSize,
			where: {
				[Op.or]: {
					[Op.and]: {
						"deploymentStatus": {
							[Op.in]: ["pending", "failed"]
						},
						"id": {
							[Op.gte]: startRepoSyncStatesId
						}
					},
					"id": {
						[Op.in]: extraRepoSyncIdsToReset
					}
				}
			},
			order: [ ["id", "ASC"] ]
		});
		info(`Found ${repoSyncStatesToBeUpdated.length} repo sync states to update`);

		let count = 0;
		let lastId: number | undefined;
		for (const repo of repoSyncStatesToBeUpdated) {
			await repo.update({
				deploymentCursor: null
			});
			count++;
			lastId = repo.id;
		}
		info(`${count} repo sync states updated, last RepoSyncState id is ${lastId ? lastId.toString() : "undefined"})`);

		res.end();

	} catch (err: unknown) {
		const e = err as { statusCode?: number };
		log.error({ err: e }, "Error happen when reseting deployment cursor");
		res.end(`Error happen when reseting deployment cursor: ${safeJsonStringify(e)}`);
	}

};
