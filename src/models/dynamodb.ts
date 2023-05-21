import AWS from "aws-sdk";
import { envVars } from "config/env";
import { isNodeProd } from "utils/is-node-env";

export const dynamodb = new AWS.DynamoDB({
	apiVersion: "2012-11-05",
	region: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_REGION,
	endpoint: isNodeProd() ? undefined : "http://localhost:4566"
});

export const purgeItemsInTable = async (tableName: string) => {

	if (isNodeProd()) throw new Error("No purging items in prod!");

	try {

		const rows = await dynamodb.scan({
			TableName: tableName,
			AttributesToGet: [ "Id", "CreatedAt" ]
		}).promise();

		const deleteRequests: Promise<unknown>[] = ((rows.Items || []).map(item => {
			return dynamodb.deleteItem({
				TableName: tableName,
				Key: {
					"Id": { "S": item.Id.S },
					"CreatedAt": { "N" : item.CreatedAt.N }
				}
			}).promise();
		}));

		await Promise.all(deleteRequests);

	} catch (e) {
		//do nothing as this method is for local test only
	}

};
