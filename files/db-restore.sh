#!/bin/bash

# Use tput to get bold and green text styles
bold=$(tput bold)
green=$(tput setaf 2)
red=$(tput setaf 1)
yellow=$(tput setaf 6)
reset=$(tput sgr0)

# Set the default environment file
envFile="environment.dev.ts"
envStatus="Dev"
envColor=${green}

fileDump=""
collection=""
isLocal=false
canDrop=false


# Function to display usage
usage() {
  echo "Usage: $0 --fileDump=value [--collection=value] [--isLocal]"
  exit 1
}

# Check if at least one argument is provided
if [ $# -eq 0 ]; then
  usage
fi

# Parse the command-line arguments
for arg in "$@"; do
  case $arg in
    --fileDump=*)
      fileDump="${arg#*=}"
      ;;
    --collection=*)
      collection="${arg#*=}"
      ;;
    --isLocal)
      isLocal=true
      ;;
    --drop)
      canDrop=true
      ;;
    *)
      usage
      ;;
  esac
done

# Check if required arguments are provided
if [ -z "$fileDump" ]; then
  echo "Error: ${red}--fileDump argument is required.${reset}"
  exit 1
fi

mongoUri=$(grep "mongoUri:" "./apps/api/src/environments/$envFile" | sed -E "s/.*mongoUri: '(.*)',/\1/")

# Extract the database name from the backup file name
basename=$(basename "$fileDump")
dbnameRestore=$(echo "$basename" | sed -E 's/^([^-]+-[^-]+)-.*$/\1/')

# Check if dbnameRestore contains only letters and dashes
if [[ ! "$dbnameRestore" =~ ^[a-zA-Z-]+$ ]]; then
  echo "Error: ${red}Invalid database name: $dbnameRestore. The database name should contain only letters.${reset}"
  exit 1  # Exit with an error code if the database name is not valid
fi

if [ "$isLocal" = true ]; then
  mongoUri="mongodb://localhost:27017"
  envStatus="Local"
fi

# if [ -n "$collection" ]; then
#   # pathBackup="${pathBackup}/${collection}.bson"
# fi

echo "Env:${bold}${envColor} $envStatus ${reset}"
echo "MongoURI:${bold}${envColor} $mongoUri ${reset}"
echo "Database name from restore file:${envColor} $dbnameRestore ${reset}"
echo "File to restore:${bold}${yellow} $fileDump ${reset}"

if [ -n "$collection" ]; then
  echo "Collection: ${bold}${yellow}${collection}${reset}"
fi

# mongo cmd START
mongoCmd=""

if [ "$isLocal" = true ]; then
  collectionCmd="*"

  if [ -n "$collection" ]; then
    collectionCmd=$collection
  fi

  mongoCmd=" --uri=$mongoUri --nsInclude="${dbnameRestore}.${collectionCmd}" --nsFrom="${dbnameRestore}.${collectionCmd}" --nsTo="puppyisland-dev.${collectionCmd}" --archive=$fileDump --gzip"
else
  mongoCmd=" --uri=$mongoUri --archive=$fileDump --gzip"

  if [ -n "$collection" ]; then
    mongoCmd="${mongoCmd} --collection=${collection}"
  fi
fi

if [ "$canDrop" = true ]; then
  mongoCmd="$mongoCmd --drop"
fi

echo "mongorestore cmd:${yellow} $mongoCmd ${reset}"
# mongo cmd END

# Pause and prompt the user to press "Enter" to continue or "Ctrl+C" to stop
read -p "Press ${green}Enter${reset} to continue or ${red}Ctrl+C${reset} to stop the script."
echo "Start..."

# run restore
mongorestore $mongoCmd
