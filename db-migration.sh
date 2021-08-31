#!/usr/bin/env bash

## COLORS
BOLD=$(tput bold)
RED=$(tput setaf 1)
GREEN=$(tput setaf 2)
YELLOW=$(tput setaf 3)
RESET=$(tput sgr0)

## VARS
OUTPUT="/tmp/db-migration-$(date +"%s").dir" # where we save the dump, we use timestamp for uniqueness
JOBS=1 # Defaults to 1 job for Mac
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  JOBS=$(($(nproc --all)-2)) # Number of cpu cores minus 2 to do parallel restore jobs
fi
SOURCE_URL="$1"
TARGET_URL="$2"

function show_help {
    echo "${BOLD}Atlassian DB Migration Script${RESET}"
    echo ""
    echo "You must have postgresql-client and curl installed first."
    echo ""
    echo "Basic usage: ./$(basename $0) [source-db-url] [target-db-url]"
    echo "Example: ./$(basename $0) postgres://postgres:postgres@localhost:5432/source-db postgres://postgres:postgres@localhost:5432/target-db"
    echo ""
    echo "${BOLD}Options${RESET}:"
    echo " ${BOLD}-h${RESET}: Help - Show me this helpful message."
}

# Check if we can connect to DB
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

# Gather options from flags.
while getopts "h:help:?" opt; do
    case "$opt" in
    h)
        show_help
        exit 0
        ;;
    help)
        show_help
        exit 0
        ;;
    \?)
        show_help
        exit 0
        ;;
    esac
done

# Check to see if postgresql-client is installed on the system
if ! [ -x "$(command -v pg_isready)" ]; then
  echo "${RED}postgresql-client is not installed, please install it first.${RESET}"
  exit 1
fi

# VPN Connection check - URL is only accessible internally in VPN
echo "${YELLOW}Checking VPN connection...${RESET}"
curl -s -m 5 https://statlas.prod.atl-paas.net/ > /dev/null
if ! [ "$?" == "0" ]
then
  echo "${RED}Not connected to Atlassian VPN.  Please connect to it first before continuing.${RESET}"
  exit 1
fi
echo "${GREEN}Connected to Atlassian VPN.${RESET}"

# Enter source url if it wasn't added as a parameter
if [ -z "$SOURCE_URL" ]
then
  read -p "Enter the Source Database URL: " SOURCE_URL
fi
check_db $SOURCE_URL "Source"

# Enter target url if it wasn't added as a parameter
if [ -z "$TARGET_URL" ]
then
  read -p "Enter the Target Database URL: " TARGET_URL
fi
check_db $TARGET_URL "Target"

echo "Databases ready for migration from '$SOURCE_URL' to '$TARGET_URL'."

# Confirm that the user wants to continue
read -p "${YELLOW}${BOLD}This will overwrite Target Database, are you sure you want to continue? [y/N] ${RESET}" PROMPT
# Uppercase prompt
PROMPT=$(echo "$PROMPT" |  tr '[:lower:]' '[:upper:]')
# exit if not yes
if ! [ "$PROMPT" == "Y" ]
then
  echo "${YELLOW}Aborting database migration... Goodbye.${RESET}"
  exit 0
fi

# Clears the output directory in case it already exists, just in case
if [[ -d "$OUTPUT" ]]
then
  echo "${YELLOW}Output directory already exists, deleting before continuing...${RESET}"
  rm -R "$OUTPUT"
  echo "${GREEN}Output directory cleared, ready to continue.${RESET}"
fi

echo "${YELLOW}Dumping source database data from '$SOURCE_URL' to '$OUTPUT'...${RESET}"
# clean (drop) database objects before creation but only if exists
# no owner, no grant privileges, no comment extensions, includes blobs, use directory format, jobs for parallel tasks
pg_dump -v --clean --if-exists --no-owner --no-privileges --no-comments --blobs --format d --jobs "$JOBS" -f "$OUTPUT" "$SOURCE_URL"

if ! [ "$?" == "0" ]
then
  echo "${RED}Database dump failure, stopping migration.${RESET}"
  exit 1
fi

echo "${GREEN}Source database dump to '$OUTPUT' successful.${RESET}"
echo "${YELLOW}Restoring target database with data from '$OUTPUT' to '$TARGET_URL'...${RESET}"

# creates database before restore, no ownership, no privileges, only restore public schema and analytics, use directory format, jobs for parallel tasks
pg_restore -v --clean --if-exists --no-owner --no-privileges -n public -n analytics --jobs "$JOBS" --dbname "$TARGET_URL" "$OUTPUT"

EXIT_CODE=$?
if [ "$EXIT_CODE" == "0" ]
then
  echo "${GREEN}Target database restore from '$OUTPUT' successful.${RESET}"
  echo "${GREEN}Database migration complete!${RESET}"
else
  echo "${RED}Database restore failure, stopping migration.${RESET}"
fi

echo "${YELLOW}Deleting temporary data folder '$OUTPUT'.${RESET}"
rm -R "$OUTPUT"
echo "${GREEN}Temporary data folder '$OUTPUT' deleted.${RESET}"
exit $EXIT_CODE
