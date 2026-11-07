/**
 * CharaROM Downloads Page
 * Fetches build metadata from CharaOTA and renders device cards
 */
(() => {
  'use strict';

  // Configuration
  const repoApi = 'https://api.github.com/repos/CharaROMAndroid/android_vendor_CharaOTA/contents';
  const grid = document.querySelector('#devices');
  const status = document.querySelector('#status');

  // Known install guides (codename -> has guide)
  const knownGuides = ['tanzanite'];

  // Android SDK to version mapping
  const sdkToAndroid = {
    36: '16',
    35: '15',
    34: '14',
    33: '13',
    32: '12L',
    31: '12',
    30: '11'
  };

  /**
   * Escape HTML special characters
   */
  function escapeHTML(value) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    return String(value ?? '').replace(/[&<>'"]/g, c => escapeMap[c]);
  }

  /**
   * Format bytes to human-readable size
   */
  function formatBytes(value) {
    if (!Number.isFinite(Number(value))) {
      return 'Unknown size';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let n = Number(value);
    let i = 0;

    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }

    return `${n.toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
  }

  /**
   * Generate a button link
   */
  function link(url, label, primary = false) {
    if (!url) return '';
    const className = primary ? 'button primary' : 'button';
    return `<a class="${className}" href="${escapeHTML(url)}">${label}</a>`;
  }

  /**
   * Generate install guide link if available
   */
  function guideLink(codename) {
    if (knownGuides.includes(codename)) {
      return `<a class="button" href="guides/${codename}.html">Install guide</a>`;
    }
    return '';
  }

  /**
   * Render a device card from build metadata
   */
  function render(build) {
    const codename = (build.filename || '')
      .replace(/\.zip$/, '')
      .split('-')
      .pop() || 'device';

    const androidVer = sdkToAndroid[build.os_sdk_level] || build.os_sdk_level || '16';

    return `
      <article class="device-card">
        <p class="kicker">${escapeHTML(build.oem || 'Android')} · ${escapeHTML(codename)}</p>
        <h2>${escapeHTML(build.device || codename)}</h2>
        <p>Maintained by ${escapeHTML(build.maintainer || 'the CharaROM team')}</p>

        <div class="device-meta">
          <span class="chip">Android ${escapeHTML(androidVer)}</span>
          <span class="chip">v${escapeHTML(build.version || '?')}</span>
          <span class="chip">${escapeHTML(build.buildtype || 'Release')}</span>
          <span class="chip">${formatBytes(build.size)}</span>
        </div>

        <dl>
          <dt>Patch level</dt>
          <dd>${escapeHTML(build.os_patch_level || 'Not listed')}</dd>
          <dt>File</dt>
          <dd>${escapeHTML(build.filename || 'Not listed')}</dd>
          <dt>SHA-256</dt>
          <dd>${escapeHTML(build.sha256 || 'Not listed')}</dd>
        </dl>

        <div class="device-links">
          ${link(build.download, 'Download', true)}
          ${guideLink(codename)}
          ${link(build.recovery, 'Recovery')}
          ${link(build.telegram, 'Support')}
          ${link(build.dt, 'Device tree')}
          ${link(build.kernel, 'Kernel')}
        </div>
      </article>
    `;
  }

  /**
   * Render "coming soon" placeholder cards
   */
  function renderComingSoon() {
    return `
      <article class="device-card coming-soon">
        <p class="kicker">Motorola · mona</p>
        <h2>Moto G Stylus 5G (2025)</h2>
        <p>Waiting for upstream LineageOS device tree</p>

        <div class="device-meta">
          <span class="chip">Planned</span>
        </div>

        <p class="coming-soon-note">
          CharaROM support is planned once LineageOS trees are available.
        </p>

        <div class="device-links">
          <a class="button" href="https://ntfy.sh/mona_on_lineage" target="_blank" rel="noopener">
            Watch status on ntfy.sh
          </a>
        </div>
      </article>
    `;
  }

  /**
   * Load and display all builds
   */
  async function load() {
    try {
      // Fetch repository listing
      const listingResponse = await fetch(repoApi, {
        headers: { Accept: 'application/vnd.github+json' }
      });

      if (!listingResponse.ok) {
        throw new Error('Repository listing unavailable');
      }

      const listing = await listingResponse.json();

      // Filter JSON files only
      const files = listing.filter(
        file => file.type === 'file' && file.name.endsWith('.json')
      );

      // Fetch all build metadata in parallel
      const payloads = await Promise.all(
        files.map(async file => {
          try {
            const response = await fetch(file.download_url);
            return response.ok ? response.json() : null;
          } catch {
            return null;
          }
        })
      );

      // Extract and sort builds
      const builds = payloads
        .flatMap(data => (data && Array.isArray(data.response) ? data.response : []))
        .filter(Boolean)
        .sort((a, b) => String(a.device).localeCompare(String(b.device)));

      if (!builds.length) {
        throw new Error('No builds found');
      }

      // Render all cards
      grid.innerHTML = builds.map(render).join('') + renderComingSoon();
      status.textContent = `${builds.length} current build${builds.length === 1 ? '' : 's'} · live from CharaOTA`;

    } catch (error) {
      grid.innerHTML = `
        <div class="empty">
          Build metadata could not be loaded right now. 
          Browse the <a href="https://github.com/CharaROMAndroid/android_vendor_CharaOTA">CharaOTA repository</a> 
          or try again later.
        </div>
      `;
      status.textContent = 'Build service unavailable';
    }
  }

  // Initialize
  load();
})();
