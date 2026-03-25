#!/bin/bash
set -e

echo "pulling latest changes"
git pull

echo "installing dependencies part 1"
npm ci

echo "Building part 1"
npm run build:clean

echo "installing dependencies part 2"
cd dashboard/
npm ci

echo "Building part 2"
npm run build
cd ..

echo "restarting"
npm run pm2:stop 2>/dev/null || true

if [ "${SHARDED:-false}" = "true" ]; then
  echo "starting in sharded mode"
  npm run pm2:start:sharded
else
  npm run pm2:start
fi

echo "deploy complete"
echo ""
echo "Run 'pm2 monit' to monitor."
