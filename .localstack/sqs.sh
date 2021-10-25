#!/usr/bin/env bash

# Development queues
awslocal sqs create-queue --queue-name backfill
awslocal sqs create-queue --queue-name push

# Test queues
awslocal sqs create-queue --queue-name test-backfill
awslocal sqs create-queue --queue-name test-push
