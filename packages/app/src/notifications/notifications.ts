// Full TypeScript implementation of the notification system
// Creates and manages notification UI with proper positioning

export interface NotificationAction {
  label: string;
  onClick?: () => void;
  primary?: boolean;
}

export interface ShowOptions {
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number; // ms (0 = persistent)
  actions?: NotificationAction[];
}

export interface LoadingController {
  id: string;
  update: (newTitle?: string, newMessage?: string) => void;
  success: (title?: string, message?: string) => void;
  error: (title?: string, message?: string) => void;
  close: () => void;
}

let container: HTMLElement | null = null;
let notificationCounter = 0;

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.getElementById('notification-container') as HTMLElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

function createNotification(opts: ShowOptions): HTMLElement {
  const { title, message = '', type = 'info', duration = 5000, actions = [] } = opts;
  const id = `notification-${++notificationCounter}`;

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.id = id;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');

  // Header with title and close button
  const header = document.createElement('div');
  header.className = 'notification-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'notification-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.onclick = () => removeNotification(notification);

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  notification.appendChild(header);

  // Message content
  if (message) {
    const content = document.createElement('div');
    content.className = 'notification-content';
    content.innerHTML = message; // Allow HTML for links
    notification.appendChild(content);
  }

  // Action buttons
  if (actions.length > 0) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'notification-actions';

    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = `notification-action ${action.primary ? 'primary' : 'secondary'}`;
      btn.textContent = action.label;
      btn.onclick = () => {
        action.onClick?.();
        removeNotification(notification);
      };
      actionsContainer.appendChild(btn);
    });

    notification.appendChild(actionsContainer);
  }

  // Progress bar for timed notifications
  if (duration > 0) {
    const progress = document.createElement('div');
    progress.className = 'notification-progress';
    const progressBar = document.createElement('div');
    progressBar.className = 'notification-progress-bar';
    progressBar.style.width = '0%'; // Start at 0
    progress.appendChild(progressBar);
    notification.appendChild(progress);

    // Animate progress bar
    setTimeout(() => {
      progressBar.style.transition = `width ${duration}ms linear`;
      progressBar.style.width = '100%';
    }, 50);

    // Auto-remove
    setTimeout(() => removeNotification(notification), duration);
  }

  return notification;
}

function removeNotification(notification: HTMLElement) {
  notification.classList.remove('show');
  setTimeout(() => notification.remove(), 500);
}

function show(opts: ShowOptions): string {
  const container = ensureContainer();
  const notification = createNotification(opts);
  container.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);

  return notification.id;
}

function info(title: string, message?: string, duration?: number): string {
  return show({ title, message, type: 'info', duration });
}

function success(title: string, message?: string, duration?: number): string {
  return show({ title, message, type: 'success', duration });
}

function warning(title: string, message?: string, duration?: number): string {
  return show({ title, message, type: 'warning', duration });
}

function error(title: string, message?: string, duration?: number): string {
  return show({ title, message, type: 'error', duration });
}

function loading(title: string = 'Loading...', message?: string): LoadingController {
  const id = show({ title, message, type: 'info', duration: 0 });
  const notification = document.getElementById(id);

  return {
    id,
    update(newTitle?: string, newMessage?: string) {
      if (notification) {
        if (newTitle) {
          const titleEl = notification.querySelector('.notification-title');
          if (titleEl) titleEl.textContent = newTitle;
        }
        if (newMessage) {
          const contentEl = notification.querySelector('.notification-content');
          if (contentEl) contentEl.innerHTML = newMessage;
        }
      }
    },
    success(successTitle?: string, successMessage?: string) {
      if (notification) removeNotification(notification);
      success(successTitle || 'Success!', successMessage, 5000);
    },
    error(errorTitle?: string, errorMessage?: string) {
      if (notification) removeNotification(notification);
      error(errorTitle || 'Error', errorMessage, 8000);
    },
    close() {
      if (notification) removeNotification(notification);
    },
  };
}

function confirm(
  title: string,
  message: string,
  opts?: {
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  },
): string {
  return show({
    title,
    message,
    type: 'warning',
    duration: 0,
    actions: [
      {
        label: opts?.confirmLabel || 'Confirm',
        primary: true,
        onClick: opts?.onConfirm,
      },
      {
        label: opts?.cancelLabel || 'Cancel',
        primary: false,
        onClick: opts?.onCancel,
      },
    ],
  });
}

export const Notifications = {
  show,
  info,
  success,
  warning,
  error,
  loading,
  confirm,
};

// Expose global API for legacy compatibility
(window as any).NotificationSystem = Notifications;
(window as any).Notifications = Notifications;

console.debug('[TemplateDoctor] TypeScript notification system initialized');
