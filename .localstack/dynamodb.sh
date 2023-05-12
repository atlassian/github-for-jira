#!/usr/bin/env bash

echo "===== creating dynamo table for deployment status ====="

awslocal dynamodb create-table \
    --table-name $DYNAMO_TABLE_DEPLOYMENT \
    --key-schema \
      AttributeName=Id,KeyType=HASH \
      AttributeName=StatusCreatedAt,KeyType=RANGE \
    --attribute-definitions \
      AttributeName=Id,AttributeType=S \
      AttributeName=StatusCreatedAt,AttributeType=N \
    --region $DEFAULT_REGION \
    --provisioned-throughput \
        ReadCapacityUnits=10,WriteCapacityUnits=5

echo "===== table ${DYNAMO_TABLE_DEPLOYMENT} created ====="
echo "===== checking now ====="

awslocal dynamodb list-tables --region $DEFAULT_REGION

echo "===== check finished ====="
