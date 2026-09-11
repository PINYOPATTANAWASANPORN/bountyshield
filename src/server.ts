/**
 * BountyShield REST API Server & Static Web Host
 * Provides:
 * - Web UI at http://localhost:3000
 * - REST API: POST /api/scan { url: string }
 */

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as https from 'https';
import { BountyShieldScanner, BountyScanTarget } from './core/scanner';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// LRU In-Memory Cache (TTL: 1 Hour)
interface CacheEntry {
  report: any;
  timestamp: number;
}
const scanCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', engine: 'BountyShield 2.0', cachedEntries: scanCache.size, uptime: process.uptime() });
});

// REST API: POST /api/scan
app.post('/api/scan', async (req, res) => {
  const { url, githubToken } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid GitHub issue URL required.' });
  }

  // Check cache first
  const cacheKey = url.toLowerCase().trim();
  const cached = scanCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return res.json({ success: true, report: cached.report, cached: true });
  }

  const match = url.match(/https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/issues\/(\d+)/);
  if (!match) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid GitHub issue URL format. Must match https://github.com/:owner/:repo/issues/:id' 
    });
  }

  const owner = match[1];
  const repo = match[2];
  const issueNumber = match[3];

  try {
    const [issueData, comments] = await Promise.all([
      fetchGitHubIssue(owner, repo, issueNumber, githubToken),
      fetchGitHubComments(owner, repo, issueNumber, githubToken)
    ]);

    const scanTarget: BountyScanTarget = {
      url,
      title: issueData.title || '',
      body: issueData.body || '',
      author: issueData.user?.login || 'unknown',
      comments: comments.map((c: any) => c.body || ''),
      openPRCount: 0
    };

    const report = await BountyShieldScanner.scan(scanTarget);
    scanCache.set(cacheKey, { report, timestamp: Date.now() });

    return res.json({ success: true, report, cached: false });

  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function fetchGitHubIssue(owner: string, repo: string, issueNumber: string, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'BountyShield-WebAPI-2.0',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token && token.trim()) {
      headers['Authorization'] = `token ${token.trim()}`;
    }

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/issues/${issueNumber}`,
      method: 'GET',
      headers
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

function fetchGitHubComments(owner: string, repo: string, issueNumber: string, token?: string): Promise<any[]> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {
      'User-Agent': 'BountyShield-WebAPI-2.0',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token && token.trim()) {
      headers['Authorization'] = `token ${token.trim()}`;
    }

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=30`,
      method: 'GET',
      headers
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

app.listen(PORT, () => {
  console.log(`🛡️ BountyShield Web Dashboard active on http://localhost:${PORT}`);
});
