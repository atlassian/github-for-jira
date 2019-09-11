#!/bin/bash

NODE_USER=node
NODE_DEBUG_LOG_DIR=~${NODE_USER}/.npm/_logs
export NODE_ENV=${ENVIRONMENT}

# The Postgres URL used to connect to the database and secret for encrypting data
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_NAME}"
echo -e ${private_key} > private-key.pem
export LOG_LEVEL=${LOG_LEVEL:=debug}


cat <<EOF > .env
# The ID of your GitHub App
APP_ID=${APP_ID}
APP_URL=${APP_URL}
WEBHOOK_SECRET=${WEBHOOK_SECRET}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}

# Use 'trace' to get verbose logging or 'info' to show less
LOG_LEVEL=${LOG_LEVEL:=debug}
NODE_ENV=${NODE_ENV}

# The Postgres URL used to connect to the database and secret for encrypting data
DATABASE_URL=${DATABASE_URL}
STORAGE_SECRET=${STORAGE_SECRET}

# Unique identifier for this instance, used in the Atlassian Connect manifest to
# differentiate this instance from other deployments (staging, dev instances, etc).
INSTANCE_NAME=${ENVIRONMENT}
EOF

# This should stay in foreground until it exits:
echo "Starting Mya-Jira-Plugin v.${APP_VERSION}"
printf "Starting Node.js server version: %s (NPM version: %s)\n" "$( node --version 2>&1 )" "$( npm --version 2>&1 )"

# Run whenever you need to recreate the db
./script/db_create 2>&1
npm run dev 2>&1
RC=$?


echo "npm start exited with code: ${RC}"

if [ -d ${NODE_DEBUG_LOG_DIR} ]; then
    if [ $( ls ${NODE_DEBUG_LOG_DIR}/*.log > /dev/null 2>&1 ) ]; then
        echo "node debug logs output:"
        cat ${NODE_DEBUG_LOG_DIR}/*.log 2>&1
      fi
fi
exit ${RC}

