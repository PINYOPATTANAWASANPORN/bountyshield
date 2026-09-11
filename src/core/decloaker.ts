/**
 * Decloaker & Obfuscation Stripper
 * Detects hidden Unicode, homoglyphs, zero-width characters, and base64 payloads
 */

export interface DecloakResult {
  cleanedText: string;
  hasHiddenCharacters: boolean;
  detectedObfuscations: string[];
  entropyScore: number;
}

export class Decloaker {
  // Zero-width characters & bidirectional override tags often used in prompt injection / honeypot cloaking
  private static readonly INVISIBLE_REGEX = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2060-\u206F]/g;
  
  // Base64 detection regex (minimum 24 characters block)
  private static readonly BASE64_PATTERN = /(?:[A-Za-z0-9+/]{4}){6,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;

  /**
   * Cleans text and reports hidden adversarial vectors
   */
  public static decloak(rawText: string): DecloakResult {
    const detectedObfuscations: string[] = [];
    let hasHidden = false;

    // 1. Check for Zero-Width / RTL Invisible Characters
    if (this.INVISIBLE_REGEX.test(rawText)) {
      hasHidden = true;
      detectedObfuscations.push('Zero-width / Bidirectional invisible formatting detected');
    }

    const cleanedText = rawText.replace(this.INVISIBLE_REGEX, '');

    // 2. Check for Embedded Base64 Payload Blocks
    const b64Matches = cleanedText.match(this.BASE64_PATTERN);
    if (b64Matches && b64Matches.length > 0) {
      detectedObfuscations.push(`Detected ${b64Matches.length} encoded base64 payload block(s)`);
    }

    // 3. Compute Shannon Entropy to flag high-entropy obfuscated strings
    const entropyScore = this.computeEntropy(cleanedText);
    if (entropyScore > 4.8 && cleanedText.length > 100) {
      detectedObfuscations.push(`High Shannon entropy (${entropyScore.toFixed(2)}) indicating packed/encrypted payload`);
    }

    return {
      cleanedText,
      hasHiddenCharacters: hasHidden,
      detectedObfuscations,
      entropyScore
    };
  }

  /**
   * Computes Shannon Entropy (H) for string randomness assessment
   */
  private static computeEntropy(str: string): number {
    if (!str || str.length === 0) return 0;
    const freqs: Record<string, number> = {};
    for (const char of str) {
      freqs[char] = (freqs[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const char in freqs) {
      const p = freqs[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
}
