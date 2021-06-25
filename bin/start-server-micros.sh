#!/bin/sh

cd "$(dirname "$0")/.."


case "$MICROS_GROUP" in
  "WebServer")
    COMMAND="start:main:production"
  ;;
  "Worker")
    COMMAND="start:worker:production"
  ;;
  *)
    echo "Wrong MICROS_GROUP environment parameter: ${MICROS_GROUP}"
    exit 1
  ;;
esac

npm run "${COMMAND}"
