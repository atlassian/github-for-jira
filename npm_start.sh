#!/bin/sh

NODE_USER=node
NODE_DEBUG_LOG_DIR=~${NODE_USER}/.npm/_logs

# Set some secrets
# The ID of your GitHub App
export APP_ID=${APP_ID}
export APP_URL=${APP_URL}
export WEBHOOK_SECRET=${WEBHOOK_SECRET}
export GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
export GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}

# Use 'trace' to get verbose logging or 'info' to show less
export LOG_LEVEL=${LOG_LEVEL:=debug}

# The Postgres URL used to connect to the database and secret for encrypting data
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_NAME}"
export STORAGE_SECRET=${STORAGE_SECRET}
echo -e ${private_key} > private-key.pem

# This should stay in foreground until it exits:
echo "Starting Mya-Jira-Plugin v.${APP_VERSION}"
printf "Starting Node.js server version: %s (NPM version: %s)\n" "$( node --version 2>&1 )" "$( npm --version 2>&1 )"

# TODO - make sure to set postgres db url via env var
source ./script/db_create
npm start 2>&1
RC=$?


echo "npm start exited with code: ${RC}"

if [ -d ${NODE_DEBUG_LOG_DIR} ]; then
    if [ $( ls ${NODE_DEBUG_LOG_DIR}/*.log > /dev/null 2>&1 ) ]; then
        echo "node debug logs output:"
        cat ${NODE_DEBUG_LOG_DIR}/*.log 2>&1
      fi
fi
exit ${RC}

