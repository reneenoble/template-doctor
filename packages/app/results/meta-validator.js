// Lightweight validator & retention pass for dynamic Template Doctor scan meta entries.
// Loaded after index-data.js (include this script after meta files). It mutates window.templatesData in place.
(function(){
  const maxPerRepo = (window.TemplateDoctorConfig && window.TemplateDoctorConfig.maxScansPerRepo) || 8; // retention cap
  const requiredFields = ['timestamp','repoUrl','dashboardPath','dataPath','ruleSet','compliance','relativePath'];
  const seen = new Set();
  function iso(ts){ try { return new Date(ts).toISOString(); } catch(_) { return null; } }
  let list = Array.isArray(window.templatesData) ? window.templatesData : [];

  // Filter + normalize
  const valid = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    // basic field presence
    const missing = requiredFields.filter(f => !(f in entry));
    if (missing.length) { console.warn('[meta-validator] Dropping entry missing fields', missing, entry); continue; }
    // minimal compliance shape
    if (!entry.compliance || typeof entry.compliance !== 'object') { console.warn('[meta-validator] Bad compliance shape', entry); continue; }
    // dedupe key
    const key = `${entry.repoUrl}::${entry.dashboardPath}`;
    if (seen.has(key)) { continue; }
    seen.add(key);
    // normalize timestamp
    const normTs = iso(entry.timestamp);
    if (!normTs) { console.warn('[meta-validator] Invalid timestamp', entry.timestamp); continue; }
    entry.timestamp = normTs;
    valid.push(entry);
  }

  // Group by repoUrl for retention trimming
  const byRepo = valid.reduce((m,e)=>{ (m[e.repoUrl]=m[e.repoUrl]||[]).push(e); return m; }, {});
  const finalList = [];
  Object.keys(byRepo).forEach(repo => {
    const arr = byRepo[repo].sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
    if (arr.length > maxPerRepo) {
      const removed = arr.slice(maxPerRepo);
      console.log(`[meta-validator] Pruned ${removed.length} old scans for ${repo}`);
    }
    finalList.push(...arr.slice(0,maxPerRepo));
  });

  // Sort global list by timestamp desc
  finalList.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
  window.templatesData = finalList;
  window.__TD_META_VALIDATED = true;
  console.log('[meta-validator] Validation complete. Entries:', finalList.length);
})();
