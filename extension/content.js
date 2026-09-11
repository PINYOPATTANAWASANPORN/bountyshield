/**
 * BountyShield Chrome Extension Content Script
 * Automatically detects GitHub Issue URLs, pings local or hosted BountyShield API,
 * and renders a floating Cyber-Glass security pill badge on the page.
 */

(function () {
  const currentUrl = window.location.href;
  const match = currentUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) return;

  // Create Floating Sentinel Badge
  const badge = document.createElement('div');
  badge.id = 'bountyshield-sentinel-badge';
  badge.style.position = 'fixed';
  badge.style.bottom = '24px';
  badge.style.right = '24px';
  badge.style.zIndex = '999999';
  badge.style.padding = '12px 18px';
  badge.style.borderRadius = '12px';
  badge.style.background = 'rgba(15, 23, 42, 0.9)';
  badge.style.color = '#fff';
  badge.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  badge.style.fontSize = '13px';
  badge.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
  badge.style.border = '1px solid rgba(255,255,255,0.15)';
  badge.style.backdropFilter = 'blur(10px)';
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.gap = '10px';
  badge.style.cursor = 'pointer';
  badge.style.transition = 'all 0.3s ease';

  badge.innerHTML = `
    <div style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; animation: pulse 1.5s infinite;"></div>
    <span><b>BountyShield:</b> Auditing task security...</span>
  `;

  document.body.appendChild(badge);

  // Ping BountyShield local or hosted API
  fetch('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: currentUrl })
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        badge.innerHTML = `<span>⚠️ BountyShield: Failed to scan</span>`;
        return;
      }

      const report = data.report;
      if (report.riskScore >= 75) {
        badge.style.border = '1px solid #ef4444';
        badge.style.background = 'rgba(239, 68, 68, 0.2)';
        badge.innerHTML = `
          <div style="font-size: 16px;">⛔</div>
          <div>
            <div style="font-weight: bold; color: #f87171;">SCAM TRAP (${report.riskScore}/100)</div>
            <div style="font-size: 11px; color: #fca5a5;">${report.escrow.isVerified ? 'Escrow verified' : 'No Escrow'} | ${report.upstream.isUpstreamValid ? 'Upstream OK' : '404 Clone'}</div>
          </div>
        `;
      } else if (report.riskScore >= 35) {
        badge.style.border = '1px solid #f59e0b';
        badge.style.background = 'rgba(245, 158, 11, 0.2)';
        badge.innerHTML = `
          <div style="font-size: 16px;">⚠️</div>
          <div>
            <div style="font-weight: bold; color: #fbbf24;">HIGH RISK (${report.riskScore}/100)</div>
            <div style="font-size: 11px; color: #fde68a;">Manual check required</div>
          </div>
        `;
      } else {
        badge.style.border = '1px solid #10b981';
        badge.style.background = 'rgba(16, 185, 129, 0.2)';
        badge.innerHTML = `
          <div style="font-size: 16px;">✅</div>
          <div>
            <div style="font-weight: bold; color: #34d399;">SAFE BOUNTY (${report.riskScore}/100)</div>
            <div style="font-size: 11px; color: #a7f3d0;">${report.escrow.platform} Escrow Backed</div>
          </div>
        `;
      }

      badge.onclick = () => {
        window.open('http://localhost:3000', '_blank');
      };
    })
    .catch(() => {
      badge.innerHTML = `<span>🛡️ BountyShield: Standby (Start local server)</span>`;
      badge.onclick = () => window.open('http://localhost:3000', '_blank');
    });
})();
