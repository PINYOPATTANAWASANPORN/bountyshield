/**
 * Upstream Issue & Repository Verifier
 * Audits referenced upstream issues/PRs to detect 404 ghost references,
 * synthetic bridge arbitrage farms, and unmerged payout history.
 */

import * as https from 'https';

export interface UpstreamAuditResult {
  hasUpstreamReference: boolean;
  upstreamUrl?: string;
  isUpstreamValid: boolean;
  statusCode?: number;
  reason?: string;
}

export class UpstreamVerifier {
  // Matches GitHub issue/PR URLs: https://github.com/owner/repo/issues/123
  private static readonly GITHUB_ISSUE_REGEX = /https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/(issues|pull)\/(\d+)/;

  /**
   * Extracts and verifies whether upstream references actually exist
   */
  public static async verifyUpstreamReference(body: string, currentUrl?: string): Promise<UpstreamAuditResult> {
    const match = body.match(this.GITHUB_ISSUE_REGEX);
    if (!match) {
      return {
        hasUpstreamReference: false,
        isUpstreamValid: true // No upstream claimed, valid by default
      };
    }

    const targetUrl = match[0];

    // If it points to itself, ignore
    if (currentUrl && targetUrl.toLowerCase() === currentUrl.toLowerCase()) {
      return {
        hasUpstreamReference: false,
        isUpstreamValid: true
      };
    }

    // Ping GitHub REST API or HEAD request to verify target existence
    const owner = match[1];
    const repo = match[2];
    const type = match[3];
    const number = match[4];

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/${type === 'issues' ? 'issues' : 'pulls'}/${number}`;
    
    try {
      const res = await this.fetchGithubApi(apiUrl);
      if (res.status === 404) {
        return {
          hasUpstreamReference: true,
          upstreamUrl: targetUrl,
          isUpstreamValid: false,
          statusCode: 404,
          reason: `Upstream target issue does not exist (HTTP 404). High indicator of synthetic task clone / phantom arbitrage.`
        };
      }

      if (res.status === 200) {
        return {
          hasUpstreamReference: true,
          upstreamUrl: targetUrl,
          isUpstreamValid: true,
          statusCode: 200,
          reason: `Upstream issue verified active.`
        };
      }

      return {
        hasUpstreamReference: true,
        upstreamUrl: targetUrl,
        isUpstreamValid: true,
        statusCode: res.status,
        reason: `GitHub returned status ${res.status}`
      };
    } catch (err: any) {
      return {
        hasUpstreamReference: true,
        upstreamUrl: targetUrl,
        isUpstreamValid: false,
        reason: `Failed to connect to upstream GitHub API: ${err.message}`
      };
    }
  }

  private static fetchGithubApi(url: string): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'GET',
        headers: {
          'User-Agent': 'BountyShield-Auditor-2.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(rawData);
          } catch {}
          resolve({ status: res.statusCode || 500, data: parsed });
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
}
