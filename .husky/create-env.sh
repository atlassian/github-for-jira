#!/bin/sh

DIR=$(dirname "$0")
FILE="${DIR}/../.env"

if [ !  -f "$FILE" ]; then
  echo ".env file not found, creating it..."
  touch "$FILE"
  echo "APP_URL=http://localhost" >> "$FILE"
  echo "WEBHOOK_PROXY_URL=http://localhost/github/events" >> "$FILE"
  echo "NGROK_AUTHTOKEN=insert ngrok token here" >> "$FILE"
  echo ".env file created with defaults"
fi
