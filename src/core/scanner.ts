/**
 * BountyShield Core Scanner & Risk Scoring Engine
 * Synthesizes:
 * - Decloaking (Unicode, Zero-width, Base64)
 * - Prompt Injection / Trap Detection
 * - Upstream 404 / Synthetic Bridge Verification
 * - Escrow Backing Validation
 * - Past Repo Payout History & Contested PR Ratio
 */

import { Decloaker, DecloakResult } from './decloaker';
import { PromptTrapDetector, PromptTrapReport } from './promptTrap';
import { UpstreamVerifier, UpstreamAuditResult } from './upstreamCheck';
import { EscrowOracle, EscrowVerificationResult } from './escrowOracle';

export interface BountyScanTarget {
  url: string;
  title: string;
  body: string;
  author: string;
  comments?: string[];
  openPRCount?: number;
  authorAccountAgeDays?: number;
}

export interface BountyShieldReport {
  targetUrl: string;
  riskScore: number; // 0 (Safe) to 100 (Extreme Scam / Trap)
  verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'CRITICAL_TRAP';
  recommendation: 'PROCEED' | 'MANUAL_AUDIT_REQUIRED' | 'REJECT_AND_AVOID';
  decloak: DecloakResult;
  promptTrap: PromptTrapReport;
  upstream: UpstreamAuditResult;
  escrow: EscrowVerificationResult;
  riskFactors: string[];
}

export class BountyShieldScanner {
  public static async scan(target: BountyScanTarget): Promise<BountyShieldReport> {
    const riskFactors: string[] = [];
    let calculatedRisk = 0;

    // 1. Decloaking
    const decloak = Decloaker.decloak(target.body);
    if (decloak.hasHiddenCharacters) {
      calculatedRisk += 30;
      riskFactors.push('Invisible / Zero-width characters detected in task description');
    }
    if (decloak.detectedObfuscations.length > 0) {
      calculatedRisk += 20;
      decloak.detectedObfuscations.forEach(o => riskFactors.push(o));
    }

    // 2. Prompt Trap Detection
    const promptTrap = PromptTrapDetector.scan(decloak.cleanedText);
    if (promptTrap.isTrapDetected) {
      if (promptTrap.trapSeverity === 'CRITICAL') {
        calculatedRisk += 50;
      } else {
        calculatedRisk += 25;
      }
      promptTrap.findings.forEach(f => riskFactors.push(f));
    }

    // 3. Upstream Check (Detect 404 clone scams)
    const upstream = await UpstreamVerifier.verifyUpstreamReference(target.body, target.url);
    if (upstream.hasUpstreamReference && !upstream.isUpstreamValid) {
      calculatedRisk += 45;
      riskFactors.push(`Upstream Link Defect: ${upstream.reason}`);
    }

    // 4. Escrow Oracle
    const escrow = EscrowOracle.verifyEscrow(target.body, target.comments || []);
    if (!escrow.isVerified) {
      if (escrow.amount) {
        // Claimed reward but NO escrow
        calculatedRisk += 35;
        riskFactors.push(`Unbacked Bounty Claim: ${escrow.details}`);
      } else {
        calculatedRisk += 10;
        riskFactors.push('No recognized escrow platform found on task');
      }
    } else {
      // Has valid escrow, reduce risk
      calculatedRisk = Math.max(0, calculatedRisk - 25);
    }

    // 5. Contested PRs / Dilution Risk
    if (target.openPRCount && target.openPRCount >= 3) {
      calculatedRisk += 15;
      riskFactors.push(`High Competition Dilution: ${target.openPRCount} active PRs already competing`);
    }

    // Clamp score to [0, 100]
    const finalScore = Math.min(100, Math.max(0, calculatedRisk));

    // Determine Verdict
    let verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'CRITICAL_TRAP' = 'SAFE';
    let recommendation: 'PROCEED' | 'MANUAL_AUDIT_REQUIRED' | 'REJECT_AND_AVOID' = 'PROCEED';

    if (finalScore >= 80 || promptTrap.trapSeverity === 'CRITICAL') {
      verdict = 'CRITICAL_TRAP';
      recommendation = 'REJECT_AND_AVOID';
    } else if (finalScore >= 50) {
      verdict = 'HIGH_RISK';
      recommendation = 'REJECT_AND_AVOID';
    } else if (finalScore >= 25) {
      verdict = 'CAUTION';
      recommendation = 'MANUAL_AUDIT_REQUIRED';
    }

    return {
      targetUrl: target.url,
      riskScore: finalScore,
      verdict,
      recommendation,
      decloak,
      promptTrap,
      upstream,
      escrow,
      riskFactors
    };
  }
}
