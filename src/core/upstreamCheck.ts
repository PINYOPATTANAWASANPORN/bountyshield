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

  // Shortener domains often used to conceal target 404 links or phishing sites
  private static readonly SHORTENER_REGEX = /https?:\/\/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly)\/[a-zA-Z0-9_-]+/g;

  /**
   * Extracts and verifies whether upstream references actually exist,
   * unmasking shortened URLs if present.
   */
  public static async verifyUpstreamReference(body: string, currentUrl?: string): Promise<UpstreamAuditResult> {
    let targetText = body;

    // 1. Expand shortened URLs if present
    const shortenerMatches = body.match(this.SHORTENER_REGEX);
    if (shortenerMatches && shortenerMatches.length > 0) {
      for (const shortUrl of shortenerMatches) {
        const expanded = await this.resolveRedirect(shortUrl);
        if (expanded) {
          targetText += '\n' + expanded;
        }
      }
    }

    const match = targetText.match(this.GITHUB_ISSUE_REGEX);
    if (!match) {
      return {
        hasUpstreamReference: false,
        isUpstreamValid: true
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

      if (res.status === 403) {
        // Unauthenticated rate limit reached
        return {
          hasUpstreamReference: true,
          upstreamUrl: targetUrl,
          isUpstreamValid: false,
          statusCode: 403,
          reason: `Upstream GitHub API rate-limited (403). Could not verify existence of external reference.`
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

  private static resolveRedirect(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(url);
        const req = https.request({
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: 'HEAD',
          headers: { 'User-Agent': 'BountyShield-Unshortener-2.0' }
        }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve(res.headers.location);
          } else {
            resolve(null);
          }
        });
        req.on('error', () => resolve(null));
        req.setTimeout(4000, () => { req.destroy(); resolve(null); });
        req.end();
      } catch {
        resolve(null);
      }
    });
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
