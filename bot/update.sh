#!/bin/bash
cd "$(dirname "$0")"
git pull
npx forever restart bot.js
