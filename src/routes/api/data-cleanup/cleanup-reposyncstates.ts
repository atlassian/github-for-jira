import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { RepoSyncState } from "models/reposyncstate";
import safeJsonStringify from "safe-json-stringify";

const log = getLogger("RecoverClientKeyPost");

const getCleanupSql = (repoSyncStateId: number) => {
	return `from "RepoSyncStates" where not exists (select null from "Subscriptions" where "RepoSyncStates"."subscriptionId" = "Subscriptions"."id")  and "RepoSyncStates"."id" <= ${repoSyncStateId}`;
};

const getDryRunSql = (fromWhere: string) => {
	return `select "id", "subscriptionId", "createdAt", "updatedAt" ${fromWhere}`;
};

const getCommitInDBSql = (fromWhere: string) => {
	return `delete ${fromWhere}`;
};

export const RepoSyncStateCleanUpOrphanDataPost = async (req: Request, res: Response): Promise<void> => {
	const repoSyncStateId = Number(req.query.repoSyncStateId) || -1;
	const commitToDB = "true" === req.query.commitToDB;
	try {
		const cleanUpFromWhereSql = getCleanupSql(repoSyncStateId);
		const sql = commitToDB ? getCommitInDBSql(cleanUpFromWhereSql) : getDryRunSql(cleanUpFromWhereSql);
		const result = await RepoSyncState.sequelize?.query(sql);

		if (!result) {
			throw new Error("Repo sync data not found");
		}

		const parsedResult = result && safeParseResult(result, commitToDB);
		log.info({ result: parsedResult }, `Orphan RepoSyncStates data ${ commitToDB ? "deleted" : "found" }`);
		res.status(200).end("Done. Result: " + parsedResult);
	} catch (e: unknown) {
		log.error(e, `Error ${ commitToDB ? "deleting" : "finding" } orphan RepoSyncStates data`);
		res.status(500).end(safeJsonStringify(e as object));
	}
};

const safeParseResult = (result: object, commitToDB: boolean) => {
	try {
		if (commitToDB) {
			/*
			 * something like
			 * [
						[],
						{
							"command": "DELETE",
							"rowCount": 1,
							"oid": null,
							"rows": [],
							"fields": [],
							"_types": {
								"_types": {},
								"text": {},
								"binary": {}
							},
							"RowCtor": null,
							"rowAsArray": false
						}
					]
				*/
			return `${(result[1].rowCount as number)} rows deleted`;
		} else {
			/*
			 * something like   result: [
					[
						{
							"id": 827,
							"subscriptionId": 9999,
							"createdAt": "2023-02-06T00:58:55.760Z",
							"updatedAt": "2023-02-06T00:58:55.760Z"
						}
					],
					{
						"command": "SELECT",
						"rowCount": 1,
						"oid": null,
						"rows": [
							{
								"id": 827,
								"subscriptionId": 9999,
								"createdAt": "2023-02-06T00:58:55.760Z",
								"updatedAt": "2023-02-06T00:58:55.760Z"
							}
						],
						"fields": [
							{
								"name": "id",
								"tableID": 324164,
								"columnID": 1,
								"dataTypeID": 23,
								"dataTypeSize": 4,
								"dataTypeModifier": -1,
								"format": "text"
							},
							...
						],
						"_parsers": ...
						...
					}
				]
			 */
			return result[0].map((r: object) => safeJsonStringify(r)).join("\n") as string;
		}
	} catch (_) {
		return "ERROR Failed to parse result";
	}
};
