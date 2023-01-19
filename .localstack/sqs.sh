#!/usr/bin/env bash

# Development queues
awslocal sqs create-queue --queue-name backfill
awslocal sqs create-queue --queue-name push
awslocal sqs create-queue --queue-name deployment
awslocal sqs create-queue --queue-name branch
awslocal sqs create-queue --queue-name github-webhooks
awslocal sqs create-queue --queue-name jira-webhooks

# Test queues
awslocal sqs create-queue --queue-name test-sqs-client
awslocal sqs create-queue --queue-name test-backfill
awslocal sqs create-queue --queue-name test-push
awslocal sqs create-queue --queue-name test-deployment
awslocal sqs create-queue --queue-name test-branch
awslocal sqs create-queue --queue-name test-github-webhooks
awslocal sqs create-queue --queue-name test-jira-webhooks
