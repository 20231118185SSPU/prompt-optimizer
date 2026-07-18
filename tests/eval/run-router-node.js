#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');

function runRouter(request) {
  try {
    // Try using Git Bash on Windows
    const result = execSync(
      `bash -c 'source "${process.cwd()}/core/host/align-route.sh" --classify "${request.replace(/"/g, '\\"')}"'`,
      {
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true
      }
    ).trim();
    return result;
  } catch (err) {
    // Fallback: try with wsl
    try {
      const result = execSync(
        `wsl bash -c 'source /mnt/c/Users/FUTIAN/Desktop/prompt-optimizer/core/host/align-route.sh --classify "${request.replace(/"/g, '\\"')}"'`,
        {
          encoding: 'utf8',
          timeout: 15000,
          windowsHide: true
        }
      ).trim();
      return result;
    } catch (err2) {
      return 'ERROR';
    }
  }
}

module.exports = { runRouter };
