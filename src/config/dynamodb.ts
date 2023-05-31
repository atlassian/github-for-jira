import AWS from "aws-sdk";
import { envVars } from "config/env";
import { isNodeProd } from "utils/is-node-env";

export const dynamodb = new AWS.DynamoDB({
	apiVersion: "2012-11-05",
	region: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_REGION,
	endpoint: isNodeProd() ? undefined : "http://localhost:4566"
});

