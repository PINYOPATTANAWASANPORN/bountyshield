/**
 * API Key & Rate Limit Authentication Guard
 * Manages Free Tier (IP-based) and Pro Tier (API Key based)
 */

import { Request, Response, NextFunction } from 'express';

export interface ClientTierInfo {
  tier: 'FREE' | 'PRO';
  scansRemaining: number;
  maxDailyScans: number;
}

export class AuthGuard {
  // Free tier daily limit per IP
  private static readonly FREE_DAILY_LIMIT = 15;
  // In-memory tracker: IP -> { count, resetAt }
  private static ipScanTracker = new Map<string, { count: number; resetAt: number }>();

  // Valid Pro API Keys (Can be extended via database or Polar webhooks)
  // Format: bs_live_xxxxxxxx
  private static validProKeys = new Set<string>([
    'bs_live_master_demo_key_2026',
    'bs_live_founder_access_vip'
  ]);

  public static authenticateRequest(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';

    // 1. Check if user provided a Pro API Key
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7).trim();
      if (AuthGuard.validProKeys.has(apiKey)) {
        (req as any).tierInfo = {
          tier: 'PRO',
          scansRemaining: 999999,
          maxDailyScans: 999999
        };
        return next();
      } else {
        res.status(401).json({
          success: false,
          error: 'Invalid API Key. Upgrade to Pro at Polar.sh to get an active key.',
          upgradeUrl: 'https://buy.polar.sh/polar_cl_VRzIQO3ntnXCuc29kpklptOmhL9opNgRyJ1R3Jeodd'
        });
        return;
      }
    }

    // 2. Free Tier: IP-based rate limiting
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let tracker = AuthGuard.ipScanTracker.get(ip);

    if (!tracker || now > tracker.resetAt) {
      tracker = { count: 0, resetAt: now + oneDayMs };
      AuthGuard.ipScanTracker.set(ip, tracker);
    }

    if (tracker.count >= AuthGuard.FREE_DAILY_LIMIT) {
      res.status(429).json({
        success: false,
        error: `Daily free tier limit (${AuthGuard.FREE_DAILY_LIMIT} scans) reached. Upgrade to Pro for unlimited scans.`,
        tier: 'FREE',
        upgradeUrl: 'https://buy.polar.sh/polar_cl_VRzIQO3ntnXCuc29kpklptOmhL9opNgRyJ1R3Jeodd'
      });
      return;
    }

    tracker.count++;
    (req as any).tierInfo = {
      tier: 'FREE',
      scansRemaining: AuthGuard.FREE_DAILY_LIMIT - tracker.count,
      maxDailyScans: AuthGuard.FREE_DAILY_LIMIT
    };

    next();
  }

  public static addProKey(key: string): void {
    AuthGuard.validProKeys.add(key);
  }
}
