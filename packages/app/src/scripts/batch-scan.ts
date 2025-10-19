/* Batch scan with backend + cancel/resume support */
import { ApiClient } from './api-client';
import { sanitizeHtml, sanitizeAttribute, sanitizeGitHubUrl, containsXssAttempt } from '../shared/sanitize';

interface BatchProgressEntry {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  timestamp: string;
  result?: any;
  error?: string;
}

const DB_NAME = 'BatchScanDB';
const STORE = 'batchProgress';
let db: IDBDatabase | null = null;

function notify() {
  return (window as any).NotificationSystem || (window as any).Notifications;
}
function showInfo(t: string, m: string) {
  const n = notify();
  if (n?.showInfo) n.showInfo(t, m, 4000);
  else console.log(t + ': ' + m);
}
function showError(t: string, m: string) {
  const n = notify();
  if (n?.showError) n.showError(t, m, 8000);
  else console.error(t + ': ' + m);
}
function showWarning(t: string, m: string) {
  const n = notify();
  if (n?.showWarning) n.showWarning(t, m, 5000);
  else console.warn(t + ': ' + m);
}
function showSuccess(t: string, m: string) {
  const n = notify();
  if (n?.showSuccess) n.showSuccess(t, m, 3000);
  else console.log(t + ': ' + m);
}

let currentBatch: string | null = null;
let isCancelled = false;
let isProcessing = false;
let resumeMode = false;

const batchButtonId = 'batch-scan-button';
const progressBarId = 'batch-progress-bar';
const progressTextId = 'batch-progress-text';
const batchItemsId = 'batch-items';
const batchCancelId = 'batch-cancel-btn';

function $(id: string) {
  return document.getElementById(id);
}

// --- IndexedDB Helpers ----------------------------------------------------
async function openDB(): Promise<IDBDatabase> {
  if (db) return db;
  db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(new Error('DB open failed'));
    req.onupgradeneeded = (e) => {
      const d = (e.target as any).result as IDBDatabase;
      if (!d.objectStoreNames.contains(STORE)) {
        const store = d.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('url', 'url', { unique: true });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve((e.target as any).result as IDBDatabase);
  });
  return db;
}

async function putProgress(entry: BatchProgressEntry) {
  const d = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = d.transaction([STORE], 'readwrite');
    const store = tx.objectStore(STORE);
    store.put(entry);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error || new Error('put failed'));
  });
}

async function getAllProgress(): Promise<BatchProgressEntry[]> {
  const d = await openDB();
  return await new Promise((res, rej) => {
    const tx = d.transaction([STORE], 'readonly');
    const store = tx.objectStore(STORE);
    const r = store.getAll();
    r.onsuccess = () => res(r.result as BatchProgressEntry[]);
    r.onerror = () => rej(r.error || new Error('getAll failed'));
  });
}

async function clearProgress() {
  const d = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = d.transaction([STORE], 'readwrite');
    const store = tx.objectStore(STORE);
    const r = store.clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error || new Error('clear failed'));
  });
}

function wireUI() {
  const btn = $(batchButtonId);
  if (btn && !btn.getAttribute('data-wired')) {
    btn.setAttribute('data-wired', '1');
    btn.addEventListener('click', () => {
      const ta = document.getElementById('batch-urls') as HTMLTextAreaElement | null;
      if (!ta) return;
      
      // Reset border
      ta.style.border = '';
      
      const lines = ta.value
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      
      if (!lines.length) {
        ta.style.border = '2px solid #dc3545';
        showError('Batch Scan', 'Enter at least one repository URL');
        return;
      }
      
      // Check for XSS attempts first
      const hasXss = lines.some(line => containsXssAttempt(line));
      if (hasXss) {
        ta.style.border = '2px solid #dc3545';
        showError('Invalid Input', "Oops! That's not allowed!");
        return;
      }
      
      // Validate and sanitize GitHub URLs
      const repos = lines
        .map((url) => {
          const sanitized = sanitizeGitHubUrl(url);
          if (!sanitized) {
            ta.style.border = '2px solid #dc3545';
            showError('Invalid URL', `Invalid URL: ${sanitizeHtml(url)}`);
            return null;
          }
          return sanitized;
        })
        .filter((url): url is string => url !== null);
        
      if (!repos.length) {
        ta.style.border = '2px solid #dc3545';
        showError('Batch Scan', 'No valid repository URLs found');
        return;
      }
      
      // Reset border on success
      ta.style.border = '';
      startBatch(repos);
    });
  }
  // Event listeners removed - batch scan is now fully self-contained
  document.addEventListener('batch-started', () => {
    const cancel = $(batchCancelId);
    if (cancel) {
      cancel.parentElement && (cancel.parentElement.style.display = 'block');
      cancel.onclick = () => cancelBatch();
    }
  });
  document.addEventListener('batch-finished', () => {
    const cancel = $(batchCancelId);
    if (cancel) {
      cancel.parentElement && (cancel.parentElement.style.display = 'none');
    }
  });
  document.addEventListener('batch-cancelled', () => {
    const cancel = $(batchCancelId) as HTMLButtonElement | null;
    if (cancel) {
      cancel.disabled = true;
      cancel.textContent = 'Cancelled';
      setTimeout(() => {
        if (cancel.parentElement) cancel.parentElement.style.display = 'none';
      }, 1200);
    }
    showInfo('Batch Scan Cancelled', 'Processing stopped');
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    wireUI();
  } else {
    document.addEventListener('DOMContentLoaded', wireUI);
  }
}

export async function startBatch(repos: string[]) {
  if (isProcessing) {
    showWarning('Batch Already Running', 'A batch scan is already in progress');
    return;
  }

  if (repos.length === 0) {
    showWarning('No URLs Found', 'Please enter at least one repository URL');
    return;
  }

  try {
    await openDB();
    const existing = await getAllProgress();
    resumeMode = false;

    // Check for existing progress
    if (existing.length) {
      const existingUrls = existing.map((p) => p.url);
      const matching = repos.filter((u) => existingUrls.includes(u));
      if (matching.length) {
        // Ask user about resuming using notification system
        const n = notify();
        if (n?.confirm) {
          await new Promise<void>((resolve) => {
            n.confirm(
              'Resume Batch Scan',
              `Found ${matching.length} previously scanned repositories. Resume and skip successful scans?`,
              {
                confirmLabel: 'Resume',
                cancelLabel: 'Start Fresh',
                onConfirm: () => {
                  resumeMode = true;
                  resolve();
                },
                onCancel: () => {
                  clearProgress().finally(() => resolve());
                },
              }
            );
          });
        } else {
          // Fallback if notification system not available
          resumeMode = true;
          await clearProgress();
        }
      } else {
        await clearProgress();
      }
    }

    isProcessing = true;
    isCancelled = false;
    currentBatch = `batch-${Date.now()}`;

    // Initialize UI
    const container = $(batchItemsId);
    if (container) container.innerHTML = '';
    if ($(progressBarId)) ($(progressBarId) as HTMLElement).style.width = '0%';
    if ($(progressTextId))
      ($(progressTextId) as HTMLElement).textContent = `0/${repos.length} Completed`;

    // Show batch results container
    const batchResults = document.getElementById('batch-results');
    if (batchResults) batchResults.classList.add('active');

    // Show cancel button
    const cancelBtn = $(batchCancelId) as HTMLButtonElement | null;
    if (cancelBtn?.parentElement) cancelBtn.parentElement.style.display = 'block';

    document.dispatchEvent(new CustomEvent('batch-started'));
    showInfo('Batch Started', `Processing ${repos.length} repositories`);

    // Load existing progress if resuming
    let existingMap: Record<string, BatchProgressEntry> = {};
    let processedCount = 0;
    if (resumeMode) {
      const existingProgress = await getAllProgress();
      existingMap = Object.fromEntries(existingProgress.map((p) => [p.url, p]));
      processedCount = existingProgress.filter((p) => p.status === 'success').length;
    }

    // Create UI items for all repos
    repos.forEach((url, idx) => {
      createBatchItem(url, idx, existingMap[url]);
    });

    // Process repos one by one
    for (let i = 0; i < repos.length; i++) {
      if (isCancelled) break;
      await processOneRepo(repos[i], i, existingMap[repos[i]]);
      processedCount++;
      updateProgress(processedCount, repos.length);
    }

    finalizeBatch(repos.length, processedCount);
  } catch (e: any) {
    showError('Batch Start Failed', e.message || String(e));
    isProcessing = false;
  }
}

function createBatchItem(url: string, index: number, existing?: BatchProgressEntry) {
  const container = $(batchItemsId);
  if (!container) return;

  const item = document.createElement('div');
  item.id = `batch-item-${index}`;

  let status = 'Pending';
  let message = 'Waiting to be processed...';
  let className = 'batch-item pending';
  let viewDisabled = true;
  let saveDisabled = true;

  if (resumeMode && existing?.status === 'success') {
    status = 'Completed';
    const issues = existing.result?.compliance?.issues?.length ?? '?';
    const passed = existing.result?.compliance?.compliant?.length ?? '?';
    message = `Analysis complete: ${issues} issues, ${passed} passed`;
    className = 'batch-item success';
    viewDisabled = false;
    saveDisabled = false;
  }

  const repoName = url.includes('github.com/') ? url.split('github.com/')[1] : url;
  const safeRepoName = sanitizeHtml(repoName);
  const safeRepoNameAttr = sanitizeAttribute(repoName);

  item.className = className;
  item.innerHTML = `
    <div class="batch-item-header">
      <div class="batch-item-title" title="${safeRepoNameAttr}">${safeRepoName}</div>
      <div class="batch-item-status">${status}</div>
    </div>
    <div class="batch-item-message">${message}</div>
    <div class="batch-item-actions">
      <button class="view-btn" ${viewDisabled ? 'disabled' : ''}>View Report</button>
      <button class="save-btn" ${saveDisabled ? 'disabled' : ''}>Save Analysis</button>
      <button class="retry-btn" disabled>Retry</button>
    </div>`;

  container.appendChild(item);

  // Wire up buttons for existing successful scans
  if (resumeMode && existing?.status === 'success' && existing.result) {
    const viewBtn = item.querySelector('.view-btn');
    const saveBtn = item.querySelector('.save-btn');
    if (viewBtn) viewBtn.addEventListener('click', () => displayResult(existing.result));
    if (saveBtn) saveBtn.addEventListener('click', () => saveAnalysis(existing.result, url));
  }
}

async function processOneRepo(url: string, index: number, existing?: BatchProgressEntry) {
  const item = $(`batch-item-${index}`);
  if (!item) return;

  // Skip if already successful in resume mode
  if (resumeMode && existing?.status === 'success') {
    return;
  }

  // Update UI to processing
  item.className = 'batch-item processing';
  item.querySelector('.batch-item-status')!.textContent = 'Processing';
  item.querySelector('.batch-item-message')!.textContent = 'Analyzing repository...';

  try {
    // Call analyzer (client-side for now, can switch to backend later)
    const analyzer = (window as any).TemplateAnalyzer;
    if (!analyzer) throw new Error('Analyzer unavailable');

    const result = await analyzer.analyzeTemplate(url, 'dod');

    // Success
    item.className = 'batch-item success';
    item.querySelector('.batch-item-status')!.textContent = 'Completed';
    const issues = result.compliance?.issues?.length ?? 0;
    const passed = result.compliance?.compliant?.length ?? 0;
    item.querySelector('.batch-item-message')!.textContent =
      `Analysis complete: ${issues} issues, ${passed} passed`;

    // Enable buttons
    const viewBtn = item.querySelector('.view-btn') as HTMLButtonElement;
    const saveBtn = item.querySelector('.save-btn') as HTMLButtonElement;
    const retryBtn = item.querySelector('.retry-btn') as HTMLButtonElement;

    if (viewBtn) {
      viewBtn.disabled = false;
      viewBtn.addEventListener('click', () => displayResult(result));
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.addEventListener('click', () => saveAnalysis(result, url));
    }
    if (retryBtn) retryBtn.disabled = true;

    // Save to IndexedDB
    await putProgress({
      id: `repo-${index}`,
      url,
      status: 'success',
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err: any) {
    // Error
    item.className = 'batch-item error';
    item.querySelector('.batch-item-status')!.textContent = 'Error';
    item.querySelector('.batch-item-message')!.textContent = err.message || 'Analysis failed';

    // Enable retry button
    const retryBtn = item.querySelector('.retry-btn') as HTMLButtonElement;
    if (retryBtn) {
      retryBtn.disabled = false;
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        await processOneRepo(url, index); // Retry
      });
    }

    // Save error to IndexedDB
    await putProgress({
      id: `repo-${index}`,
      url,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err.message || 'Analysis failed',
    });
  }
}

function updateProgress(processed: number, total: number) {
  const pct = Math.round((processed / total) * 100);
  const bar = $(progressBarId);
  const txt = $(progressTextId);

  if (bar) (bar as HTMLElement).style.width = `${pct}%`;
  if (txt) txt.textContent = `${processed}/${total} Completed`;
}

function finalizeBatch(total: number, processed: number) {
  isProcessing = false;

  // Hide cancel button
  const cancelBtn = $(batchCancelId);
  if (cancelBtn?.parentElement) cancelBtn.parentElement.style.display = 'none';

  document.dispatchEvent(new CustomEvent('batch-finished'));

  if (isCancelled) {
    showInfo('Batch Cancelled', `Processed ${processed}/${total} repositories before cancellation`);
  } else {
    showSuccess('Batch Complete', `Successfully processed ${processed}/${total} repositories`);
  }

  // Show "Save All" button if there are successful scans
  const container = $(batchItemsId);
  if (container) {
    const successItems = container.querySelectorAll('.batch-item.success');
    if (successItems.length > 0) {
      showSaveAllButton(successItems.length);
    }
  }
}

function showSaveAllButton(count: number) {
  // Save All functionality removed - analyses are automatically saved to database
  // Legacy file-based save workflow has been deprecated
}

function displayResult(result: any) {
  const analysisSection = document.getElementById('analysis-section');
  const resultsContainer = document.getElementById('results-container');
  const loadingContainer = document.getElementById('loading-container');
  const errorSection = document.getElementById('error-section');

  if (!analysisSection || !resultsContainer) return;

  document.getElementById('search-section')!.style.display = 'none';
  analysisSection.style.display = 'block';
  resultsContainer.style.display = 'block';
  if (loadingContainer) loadingContainer.style.display = 'none';
  if (errorSection) errorSection.style.display = 'none';

  const repoName = result.repoUrl?.split('github.com/')[1] || result.repoUrl || 'Repository';
  const safeRepoName = sanitizeHtml(repoName);
  const safeRepoUrl = sanitizeHtml(result.repoUrl || '');
  
  const rnEl = document.getElementById('repo-name');
  if (rnEl) rnEl.textContent = safeRepoName;
  const ruEl = document.getElementById('repo-url');
  if (ruEl) ruEl.textContent = safeRepoUrl;

  try {
    const dash = (window as any).DashboardRenderer;
    if (dash) {
      dash.render(result, resultsContainer);
    } else {
      resultsContainer.textContent = 'Dashboard renderer unavailable';
    }
    analysisSection.scrollIntoView({ behavior: 'smooth' });
  } catch (e: any) {
    showError('Display Error', e.message || 'Failed to display results');
  }
}

export function cancelBatch() {
  if (!isProcessing) {
    showWarning('No Active Batch', 'No batch scan is currently running');
    return;
  }

  isCancelled = true;
  showInfo('Cancelling...', 'Batch scan will stop after current repository');

  const cancelBtn = $(batchCancelId) as HTMLButtonElement | null;
  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Cancelling...';
  }
}

// Expose globally for legacy bridging
(window as any).TemplateDoctorBatchScan = { startBatch, cancelBatch };
