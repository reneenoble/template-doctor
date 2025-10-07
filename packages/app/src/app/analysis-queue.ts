// Analysis Queue Extraction (Phase 1 refactor)
// Handles queued analysis requests while core services initialize.
export interface QueuedAnalysis {
  args: any;
}
const queue: QueuedAnalysis[] = [];
let showingMessage = false;

export function enqueue(args: any) {
  queue.push({ args });
  maybeShowMessage();
}

function maybeShowMessage() {
  if (showingMessage || queue.length === 0) return;
  showingMessage = true;
  if (typeof document === 'undefined') return;
  const id = 'queue-message';
  if (document.getElementById(id)) return;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'alert alert-info';
  div.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:9999;padding:15px 20px;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
  div.innerHTML = `
    <strong>Services still starting up</strong>
    <p>Your request was queued and will run automatically.</p>
    <div class="progress" style="height:8px;margin-top:8px;">
      <div class="progress-bar progress-bar-striped progress-bar-animated" style="width:100%;height:8px;"></div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => {
    try {
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.5s ease';
      setTimeout(() => div.remove(), 500);
    } catch {}
  }, 15000);
}

export function drain(run: (qa: QueuedAnalysis) => void) {
  while (queue.length) {
    const item = queue.shift();
    if (item) run(item);
  }
  showingMessage = false;
}

export function size() {
  return queue.length;
}

// Expose for legacy JS consumption
if (typeof window !== 'undefined') {
  (window as any).TemplateDoctorAnalysisQueue = { enqueue, drain, size };
}
