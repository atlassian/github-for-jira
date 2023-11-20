#!/usr/bin/env bash
# DEPLOYMENT_HISTORY_CACHE_TABLE
echo "===== creating dynamo table ${DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME} ====="

awslocal dynamodb create-table \
    --table-name $DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME \
    --key-schema \
      AttributeName=Id,KeyType=HASH \
      AttributeName=CreatedAt,KeyType=RANGE \
    --attribute-definitions \
      AttributeName=Id,AttributeType=S \
      AttributeName=CreatedAt,AttributeType=N \
    --region $DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_REGION \
    --provisioned-throughput \
        ReadCapacityUnits=10,WriteCapacityUnits=5

echo "===== table ${DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME} created ====="

# AUDIT_LOG_TABLE
echo "===== creating dynamo table ${DYNAMO_AUDIT_LOG_TABLE_NAME} ====="

awslocal dynamodb create-table \
    --table-name $DYNAMO_AUDIT_LOG_TABLE_NAME \
    --key-schema \
      AttributeName=Id,KeyType=HASH \
      AttributeName=CreatedAt,KeyType=RANGE \
    --attribute-definitions \
      AttributeName=Id,AttributeType=S \
      AttributeName=CreatedAt,AttributeType=N \
    --region $DYNAMO_AUDIT_LOG_TABLE_REGION \
    --provisioned-throughput \
        ReadCapacityUnits=10,WriteCapacityUnits=5

echo "===== table ${DYNAMO_AUDIT_LOG_TABLE_NAME} created ====="

echo "===== checking now ====="

awslocal dynamodb list-tables --region $DYNAMO_AUDIT_LOG_TABLE_REGION
awslocal dynamodb list-tables --region $DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_REGION

echo "===== check finished ====="
