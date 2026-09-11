/**
 * Decloaker & Obfuscation Stripper
 * Detects hidden Unicode, homoglyphs, zero-width characters, and base64 payloads
 */

export interface DecloakResult {
  cleanedText: string;
  hasHiddenCharacters: boolean;
  detectedObfuscations: string[];
  extractedHiddenPayloads: string[];
  entropyScore: number;
}

export class Decloaker {
  // Zero-width characters & bidirectional override tags
  private static readonly INVISIBLE_REGEX = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2060-\u206F]/g;
  
  // Base64 detection regex (minimum 24 characters block)
  private static readonly BASE64_PATTERN = /(?:[A-Za-z0-9+/]{4}){6,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;

  // HTML Comments pattern: <!-- secret directive -->
  private static readonly HTML_COMMENT_PATTERN = /<!--([\s\S]*?)-->/g;

  // Markdown Image Alt Text pattern: ![secret directive](https://...)
  private static readonly IMAGE_ALT_PATTERN = /!\[([^\]]+)\]\(([^)]+)\)/g;

  /**
   * Cleans text and reports hidden adversarial vectors
   */
  public static decloak(rawText: string): DecloakResult {
    const detectedObfuscations: string[] = [];
    const extractedHiddenPayloads: string[] = [];
    let hasHidden = false;

    // 1. Extract hidden HTML comments
    let commentMatch;
    while ((commentMatch = this.HTML_COMMENT_PATTERN.exec(rawText)) !== null) {
      const hiddenContent = commentMatch[1].trim();
      if (hiddenContent.length > 5) {
        hasHidden = true;
        detectedObfuscations.push('Hidden HTML comment block detected (invisible to humans, visible to LLMs)');
        extractedHiddenPayloads.push(hiddenContent);
      }
    }

    // 2. Extract hidden Markdown Image Alt Text
    let altMatch;
    while ((altMatch = this.IMAGE_ALT_PATTERN.exec(rawText)) !== null) {
      const altText = altMatch[1].trim();
      if (altText.length > 15 && /(@platform|ignore|instruction|prompt|system|secret)/i.test(altText)) {
        hasHidden = true;
        detectedObfuscations.push('Adversarial prompt hiding inside Markdown Image Alt text');
        extractedHiddenPayloads.push(altText);
      }
    }

    // 3. Check for Zero-Width / RTL Invisible Characters
    if (this.INVISIBLE_REGEX.test(rawText)) {
      hasHidden = true;
      detectedObfuscations.push('Zero-width / Bidirectional invisible formatting detected');
    }

    let cleanedText = rawText.replace(this.INVISIBLE_REGEX, '');
    // Append hidden payloads so downstream prompt trap scanner inspects them too
    if (extractedHiddenPayloads.length > 0) {
      cleanedText += '\n\n' + extractedHiddenPayloads.join('\n');
    }

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
      extractedHiddenPayloads,
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
