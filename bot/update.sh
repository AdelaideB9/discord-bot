#!/bin/bash
cd "$(dirname "$0")"
git pull
npm install
npx forever restart bot.js
