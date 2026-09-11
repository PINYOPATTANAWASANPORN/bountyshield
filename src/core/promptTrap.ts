/**
 * Prompt Trap & Extraction Detector
 * Scans issue descriptions and markdown instructions for adversarial prompt injection,
 * token exfiltration, and directive hijacking attempts aimed at coding agents.
 */

export interface PromptTrapReport {
  isTrapDetected: boolean;
  trapSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'CRITICAL';
  matchedPatterns: string[];
  findings: string[];
}

export class PromptTrapDetector {
  // Regex signatures designed to exploit LLM agents / steal system contexts
  private static readonly TRAP_PATTERNS = [
    {
      name: 'Agent Configuration Harvester',
      severity: 'CRITICAL' as const,
      regex: /(@platform-config|system\s*prompt|system\s*instruction|\.env\b|api_key|secret_key|master\s*rules?)/i,
      desc: 'Requests exfiltration of system prompt, platform configuration, or credentials'
    },
    {
      name: 'System Instruction Override / Jailbreak',
      severity: 'CRITICAL' as const,
      regex: /(ignore\s+all\s+previous\s+instructions|disregard\s+(all\s+)?prior\s+instructions|override\s+system\s+directives|DAN\s+mode|unrestricted\s+mode)/i,
      desc: 'Attempts to override AI agent constraints and operating invariants'
    },
    {
      name: 'Exfiltration Webhook / Out-of-band Callback',
      severity: 'HIGH' as const,
      regex: /(curl|wget|fetch|axios|http\.get).*?(requestbin|webhook\.site|ngrok|pipedream|burpcollaborator|oastify)/i,
      desc: 'Suspicious payload pinging unauthorized third-party telemetry webhooks'
    },
    {
      name: 'Blind Execution / Self-Destruct Command',
      severity: 'HIGH' as const,
      regex: /(rm\s+-rf\s+\/|rmdir\s+\/s\s+\/q\s+c:\\|format\s+[c-z]:|Invoke-Expression\s+\(New-Object\s+Net\.WebClient\))/i,
      desc: 'Destructive shell command execution payload targeting host system'
    },
    {
      name: 'Synthetic Evaluation Trap',
      severity: 'MEDIUM' as const,
      regex: /(solve\s+this\s+before\s+accepting|post\s+your\s+complete\s+unminified\s+source\s+code\s+in\s+the\s+comment)/i,
      desc: 'Requests submission of complete solution in comments prior to formal assignment'
    }
  ];

  /**
   * Scans text for prompt traps
   */
  public static scan(text: string): PromptTrapReport {
    const matchedPatterns: string[] = [];
    const findings: string[] = [];
    let highestSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'CRITICAL' = 'NONE';
    const severityRank: Record<string, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    let currentMaxRank = 0;

    for (const pattern of this.TRAP_PATTERNS) {
      if (pattern.regex.test(text)) {
        matchedPatterns.push(pattern.name);
        findings.push(`[${pattern.severity}] ${pattern.desc}`);
        
        const rank = severityRank[pattern.severity] || 0;
        if (rank > currentMaxRank) {
          currentMaxRank = rank;
          highestSeverity = (pattern.severity === 'HIGH' || pattern.severity === 'CRITICAL') 
            ? 'CRITICAL' 
            : (pattern.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW');
        }
      }
    }

    return {
      isTrapDetected: matchedPatterns.length > 0,
      trapSeverity: highestSeverity,
      matchedPatterns,
      findings
    };
  }
}
