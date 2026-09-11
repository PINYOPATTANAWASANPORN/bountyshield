#!/usr/bin/env node
/**
 * BountyShield CLI Entrypoint
 * Command: bountyshield scan <url>
 */

import { Command } from 'commander';
import * as https from 'https';
import ora from 'ora';
import chalk from 'chalk';
import { BountyShieldScanner, BountyScanTarget } from './core/scanner';
import { Reporter } from './ui/reporter';

const program = new Command();

program
  .name('bountyshield')
  .description('🛡️ Enterprise Anti-Honeypot, Prompt-Trap & Bounty Scam Defense Engine')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan a GitHub issue or bounty URL for scam risk, prompt traps, and escrow validation')
  .argument('<url>', 'GitHub issue URL (e.g. https://github.com/owner/repo/issues/123)')
  .action(async (url: string) => {
    const spinner = ora(chalk.cyan(`Connecting to GitHub and auditing target: ${url}...`)).start();

    try {
      // Parse GitHub URL
      const match = url.match(/https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/issues\/(\d+)/);
      if (!match) {
        spinner.fail(chalk.red('Invalid GitHub issue URL format. Must be https://github.com/:owner/:repo/issues/:id'));
        process.exit(1);
      }

      const owner = match[1];
      const repo = match[2];
      const issueNumber = match[3];

      // Fetch issue data from GitHub API
      const issueData = await fetchGitHubIssue(owner, repo, issueNumber);
      const comments = await fetchGitHubComments(owner, repo, issueNumber);

      spinner.succeed(chalk.green('Target fetched. Running 4-Stage Security Pipeline...'));

      const scanTarget: BountyScanTarget = {
        url,
        title: issueData.title || '',
        body: issueData.body || '',
        author: issueData.user?.login || 'unknown',
        comments: comments.map((c: any) => c.body || ''),
        openPRCount: 0
      };

      const report = await BountyShieldScanner.scan(scanTarget);
      Reporter.printReport(report);

    } catch (err: any) {
      spinner.fail(chalk.red(`Scan failed: ${err.message}`));
      process.exit(1);
    }
  });

function fetchGitHubIssue(owner: string, repo: string, issueNumber: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/issues/${issueNumber}`,
      method: 'GET',
      headers: {
        'User-Agent': 'BountyShield-CLI-2.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`GitHub API returned status ${res.statusCode}: ${rawData.slice(0, 100)}`));
        }
        try {
          resolve(JSON.parse(rawData));
        } catch (e: any) {
          reject(new Error(`Failed to parse GitHub response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });
    req.end();
  });
}

function fetchGitHubComments(owner: string, repo: string, issueNumber: string): Promise<any[]> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=30`,
      method: 'GET',
      headers: {
        'User-Agent': 'BountyShield-CLI-2.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.end();
  });
}

program.parse(process.argv);
