#!/bin/sh

DIR=$(dirname "$0")
FILE="${DIR}/../.env"
EXAMPLE="${DIR}/../.env.example"

if [ !  -f "$FILE" ]; then
  echo ".env file not found, using .env.example..."
  cp "$EXAMPLE" "$FILE"
  echo ".env file created with example"
fi
