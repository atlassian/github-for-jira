#!/bin/sh

cd "$(dirname "$0")/.."

if [ "$MICROS_GROUP" = "WebServer" ]; then
  COMMAND="start:main:production"
fi

if [ "$MICROS_GROUP" = "Worker" ]; then
  COMMAND="start:worker:production"
fi

if [ -z "$COMMAND" ]; then
  echo "Wrong MICROS_GROUP environment parameter: ${MICROS_GROUP}"
  exit 1
fi

npm run "${COMMAND}"
