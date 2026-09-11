/**
 * Terminal UI Reporter
 * Renders audit findings in Obsidian / Cyber-Glass aesthetic
 * strictly compliant with non-defamatory, objective technical facts.
 */

import chalk from 'chalk';
import { BountyShieldReport } from '../core/scanner';

export class Reporter {
  public static printReport(report: BountyShieldReport): void {
    console.log('\n' + chalk.bold.cyan('━'.repeat(60)));
    console.log(chalk.bold.magenta('🛡️  BOUNTYSHIELD 2.0 // PRE-FLIGHT AUDIT VERDICT'));
    console.log(chalk.bold.cyan('━'.repeat(60)));

    console.log(`${chalk.gray('Target:')} ${chalk.underline(report.targetUrl)}`);

    // Risk Score Badge
    let scoreBadge = '';
    if (report.riskScore >= 80) {
      scoreBadge = chalk.bgRed.black.bold(` SCAM RISK: ${report.riskScore}/100 [CRITICAL] `);
    } else if (report.riskScore >= 50) {
      scoreBadge = chalk.bgYellow.black.bold(` SCAM RISK: ${report.riskScore}/100 [HIGH] `);
    } else if (report.riskScore >= 25) {
      scoreBadge = chalk.bgBlue.black.bold(` SCAM RISK: ${report.riskScore}/100 [MODERATE] `);
    } else {
      scoreBadge = chalk.bgGreen.black.bold(` SCAM RISK: ${report.riskScore}/100 [SAFE] `);
    }
    console.log(`\n${scoreBadge}  Verdict: ${chalk.bold(report.verdict)}`);

    // Recommendation
    let recText = '';
    if (report.recommendation === 'REJECT_AND_AVOID') {
      recText = chalk.red.bold('⛔ REJECT AND AVOID (Zero-payout or adversarial exploitation risk)');
    } else if (report.recommendation === 'MANUAL_AUDIT_REQUIRED') {
      recText = chalk.yellow.bold('⚠️  MANUAL AUDIT REQUIRED (Proceed only with milestones/pre-payment)');
    } else {
      recText = chalk.green.bold('✅ PROCEED SAFELY (Verified genuine bounty issue)');
    }
    console.log(`${chalk.gray('Action Recommendation:')} ${recText}`);

    // Section 1: Escrow
    console.log(`\n${chalk.bold.white('1. ESCROW & FINANCIAL SETTLEMENT:')}`);
    if (report.escrow.isVerified) {
      console.log(`   ${chalk.green('✔')} Platform: ${chalk.bold(report.escrow.platform)} (${report.escrow.amount || 'Funded'})`);
      console.log(`   ${chalk.gray(report.escrow.details)}`);
    } else {
      console.log(`   ${chalk.red('✖')} Escrow Backing: ${chalk.bold('NONE DETECTED')}`);
      console.log(`   ${chalk.yellow(report.escrow.details)}`);
    }

    // Section 2: Upstream Provenance
    console.log(`\n${chalk.bold.white('2. UPSTREAM SOURCE PROVENANCE:')}`);
    if (report.upstream.hasUpstreamReference) {
      if (report.upstream.isUpstreamValid) {
        console.log(`   ${chalk.green('✔')} Referenced Upstream: ${chalk.cyan(report.upstream.upstreamUrl)} (Status 200 OK)`);
      } else {
        console.log(`   ${chalk.red('✖')} Upstream Reference FAILED: ${chalk.red.bold(report.upstream.reason)}`);
      }
    } else {
      console.log(`   ${chalk.gray('ℹ')} Native issue (No external upstream reference claimed).`);
    }

    // Section 3: Adversarial Trap & Cloaking Check
    console.log(`\n${chalk.bold.white('3. ADVERSARIAL TRAP & PROMPT EXFILTRATION:')}`);
    if (report.promptTrap.isTrapDetected) {
      console.log(`   ${chalk.red('✖')} Trap Severity: ${chalk.red.bold(report.promptTrap.trapSeverity)}`);
      report.promptTrap.findings.forEach(f => console.log(`     - ${chalk.yellow(f)}`));
    } else {
      console.log(`   ${chalk.green('✔')} Clean: No prompt injections, harvester triggers, or malicious commands.`);
    }

    // Section 4: Risk Factors Summary
    if (report.riskFactors.length > 0) {
      console.log(`\n${chalk.bold.white('4. DETECTED STRUCTURAL RED FLAGS:')}`);
      report.riskFactors.forEach(rf => console.log(`   • ${chalk.yellow(rf)}`));
    }

    console.log(chalk.bold.cyan('━'.repeat(60)) + '\n');
  }
}
