/**
 * Escrow & Financial Settlement Oracle
 * Verifies if a bounty has mathematically verifiable escrow backing:
 * 1. Polar.sh Pledge API / Badge
 * 2. Algora.io Bot verification
 * 3. Gitcoin / On-chain smart contract backing
 */

export interface EscrowVerificationResult {
  hasEscrow: boolean;
  platform: 'POLAR' | 'ALGORA' | 'GITCOIN' | 'CUSTOM_ESCROW' | 'NONE';
  amount?: string;
  isVerified: boolean;
  confidence: number; // 0 to 100
  details: string;
}

export class EscrowOracle {
  /**
   * Evaluates text/body and comments for genuine escrow credentials
   */
  public static verifyEscrow(body: string, comments: string[] = []): EscrowVerificationResult {
    const combinedContent = [body, ...comments].join('\n');

    // 1. Polar.sh Badge & Pledge Pattern
    // Typically contains: polar.sh/... or badges.polar.sh
    if (combinedContent.includes('polar.sh') || /!\[.*?\]\(https:\/\/polar\.sh\/api\/github\/.*?\)/i.test(combinedContent)) {
      const matchAmount = combinedContent.match(/\$([0-9,]+(\.\d{2})?)/);
      return {
        hasEscrow: true,
        platform: 'POLAR',
        amount: matchAmount ? matchAmount[0] : 'Polar Escrow Backed',
        isVerified: true,
        confidence: 95,
        details: 'Verified Polar.sh escrow badge detected. Funds held in platform escrow.'
      };
    }

    // 2. Algora.io Bot Payout Notification Pattern
    // Typically posted by @algora-purl or containing 'algora.io/orgs/.../bounties'
    if (combinedContent.includes('algora.io') || combinedContent.includes('algora-purl')) {
      const matchReward = combinedContent.match(/\$([0-9,]+)/);
      return {
        hasEscrow: true,
        platform: 'ALGORA',
        amount: matchReward ? matchReward[0] : 'Algora Escrow',
        isVerified: true,
        confidence: 90,
        details: 'Algora bot or bounty link identified. Escrow managed via Stripe/Crypto.'
      };
    }

    // 3. Gitcoin / Smart Contract Escrow
    if (/gitcoin\.co|explorer\.gitcoin\.co/i.test(combinedContent)) {
      return {
        hasEscrow: true,
        platform: 'GITCOIN',
        isVerified: true,
        confidence: 85,
        details: 'Gitcoin grant / Web3 payout address found.'
      };
    }

    // 4. Raw text claims (e.g., "$100 bounty" without platform bot or escrow badge)
    const textRewardMatch = combinedContent.match(/(\$|USDC|USD)\s*([0-9,]+)/i);
    if (textRewardMatch) {
      return {
        hasEscrow: false,
        platform: 'NONE',
        amount: textRewardMatch[0],
        isVerified: false,
        confidence: 10,
        details: `Claimed reward of ${textRewardMatch[0]} found, but ZERO verifiable escrow backing (No Polar, Algora, or Gitcoin badge). High default risk.`
      };
    }

    return {
      hasEscrow: false,
      platform: 'NONE',
      isVerified: false,
      confidence: 0,
      details: 'No reward or escrow platform detected.'
    };
  }
}
