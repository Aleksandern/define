#!/bin/bash

# Use tput to get bold and green text styles
bold=$(tput bold)
green=$(tput setaf 2)
red=$(tput setaf 1)
yellow=$(tput setaf 6)
reset=$(tput sgr0)

# Get the current date and time
datetime=$(date +"%Y-%m-%d-%H-%M-%S")
# Set the output folder name with date and time appended

# Set the default environment file
envFile="environment.dev.ts"
envStatus="Dev"
envColor=${green}

collection=""
isProd=false

# Function to display usage
usage() {
  echo "Usage: $0 [--collection=value] [--isProd]"
  exit 1
}


# Parse the command-line arguments
for arg in "$@"; do
  case $arg in
    --collection=*)
      collection="${arg#*=}"
      ;;
    --isProd)
      isProd=true
      ;;
    *)
      usage
      ;;
  esac
done

if [ "$isProd" = true ]; then
  envFile="environment.prod.ts"
  envStatus="Prod"
  envColor=${red}
fi

# Extract the mongoUri value from the file
mongoUri=$(grep "mongoUri:" "./apps/api/src/environments/$envFile" | sed -E "s/.*mongoUri: '(.*)',/\1/")
dbname=$(echo "$mongoUri" | sed -E 's#.*/([^/?]+)(\?.*)?#\1#')

# Check if dbname contains only letters and dashes
if [[ ! "$dbname" =~ ^[a-zA-Z-]+$ ]]; then
  echo "Error: ${red}Invalid database name: $dbname. The database name should contain only letters and dashes.${reset}"
  exit 1  # Exit with an error code if the database name is not valid
fi

# Set the base directory for the backup
baseDir="$(dirname "$0")/../../backup"
# Ensure the backup directory exists
mkdir -p "$baseDir"
outputFolder="$(cd "$baseDir" && pwd)/pupisland-$envStatus-$datetime"

echo "Env: ${bold}${envColor}$envStatus${reset}"
echo "MongoURI: ${bold}${envColor}$mongoUri${reset}"
echo "Database name: ${bold}${envColor}${dbname}${reset}"
echo "Output folder: ${bold}${yellow}${outputFolder}${reset}"

# Pause and prompt the user to press "Enter" to continue or "Ctrl+C" to stop
read -p "Press ${green}Enter${reset} to continue or ${red}Ctrl+C${reset} to stop the script."
echo "Start..."

# create the output folder
mkdir -p "$outputFolder"

# mongo cmd START
archiveFile="$outputFolder/${dbname}-$envStatus-$datetime.gz"
mongoCmd=""

if [ -n "$collection" ]; then
  archiveFile="$outputFolder/${dbname}-$envStatus-$collection-$datetime.gz"

  mongoCmd=" --uri=$mongoUri --collection=$collection --archive="$archiveFile" --gzip"
else
  mongoCmd=" --uri=$mongoUri --archive="$archiveFile" --gzip"
fi
# mongo cmd END

# run backup
mongodump $mongoCmd

# Copy the output folder path to the clipboard using pbcopy
echo "$archiveFile" | pbcopy

echo "Backup stored in: ${bold}${yellow}${outputFolder}${reset}"
echo "Archive file: ${bold}${yellow}${archiveFile}${reset}"
echo "Archive file copied to clipboard!"
