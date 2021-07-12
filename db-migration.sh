#!/usr/bin/env bash

BOLD=$(tput bold)
RED=$(tput setaf 1)
GREEN=$(tput setaf 2)
YELLOW=$(tput setaf 3)
RESET=$(tput sgr0)

## VARS
OUTPUT=/tmp/github-for-jira.dir
JOBS=$(($(nproc --all)-2)) # Number of cpu cores minus 2 to do parallel restore jobs
SOURCE_URL="$1"
TARGET_URL="$2"

if ! [ -x "$(command -v pg_dump)" ]; then
  echo "${RED}postgresql-client is not installed, please install it first.${RESET}"
  exit 1
fi

function check_db {
  if [ -z "$1" ]
  then
    echo "${RED}$2 database URL must be specified.${RESET}"
    exit 1
  fi
  echo "${YELLOW}Checking connection to $2 database...${RESET}"
  pg_isready --timeout 60 --dbname "$1"
  if [ "$?" == "0" ]
  then
    echo "${GREEN}Successful connection to $2 database!${RESET}"
  else
    echo "${RED}Cannot connect to $2 database with URL '$1'. Exiting.${RESET}"
    exit 1
  fi
}

read -p "Check that you are connected to the Atlassian VPN (Press any key to continue)" PROMPT

if [ -z "$SOURCE_URL" ]
then
  read -p "Enter the Source Database URL: " SOURCE_URL
fi
check_db $SOURCE_URL "Source"

if [ -z "$TARGET_URL" ]
then
  read -p "Enter the Target Database URL: " TARGET_URL
fi
check_db $TARGET_URL "Target"

echo "Databases ready for migration from '$SOURCE_URL' to '$TARGET_URL'."
read -p "${YELLOW}${BOLD}This will overwrite Target Database, are you sure you want to continue? [y/N] ${RESET}" PROMPT

if ! [ "${PROMPT^^}" == "Y" ]
then
  echo "${YELLOW}Aborting database migration... Goodbye.${RESET}"
  exit 0
fi

if [[ -d "$OUTPUT" ]]
then
  echo "${YELLOW}Output directory already exists, deleting before continuing...${RESET}"
  rm -R "$OUTPUT"
  echo "${GREEN}Output directory cleared, ready to continue.${RESET}"
fi

echo "${YELLOW}Dumping source database data from '$SOURCE_URL' to '$OUTPUT'...${RESET}"
# clean (drop) database objects before creation but only if exists
# no owner, no grant privileges, includes blobs, use directory format, jobs for parallel tasks
pg_dump -v --clean --if-exists --no-owner --no-privileges --blobs --format d --jobs "$JOBS" -f "$OUTPUT" "$SOURCE_URL"

if ! [ "$?" == "0" ]
then
  echo "${RED}Database dump failure, stopping migration.${RESET}"
  exit 1
fi

echo "${GREEN}Source database dump to '$OUTPUT' successful.${RESET}"
echo "${YELLOW}Restoring target database with data from '$OUTPUT' to '$TARGET_URL'...${RESET}"

# creates database before restore, no ownership, use directory format, jobs for parallel tasks
pg_restore -v --clean --if-exists --no-owner --no-privileges --jobs "$JOBS" --dbname "$TARGET_URL" "$OUTPUT"

if ! [ "$?" == "0" ]
then
  echo "${RED}Database restore failure, stopping migration.${RESET}"
  exit 1
fi

echo "${GREEN}Target database restore from '$OUTPUT' successful.${RESET}"
echo "${GREEN}Database migration complete!${RESET}"
