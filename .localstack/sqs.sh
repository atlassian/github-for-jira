#!/usr/bin/env bash

awslocal sqs create-queue --queue-name test
awslocal sqs create-queue --queue-name dev
