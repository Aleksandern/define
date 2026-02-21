#!/bin/bash
cd ../

pm2 stop all
yarn chore:rm-dists
yarn nx reset
yarn api:build
pm2 reload ecosystem.prod.config.js --env production
