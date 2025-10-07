// Unified notification system migrated from legacy implementation
import { Notifications } from './notifications.js';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

export interface NotificationAPI {
  showSuccess(title: string, message: string, duration?: number): string;
  showError(title: string, message: string, duration?: number): string;
  showWarning(title: string, message: string, duration?: number): string;
  showInfo(title: string, message: string, duration?: number): string;
  showLoading(title?: string, message?: string): any;
  hideLoading(): void;
  confirm(
    title: string,
    message: string,
    opts?: {
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
    },
  ): string;
}

let currentLoadingController: any = null;

export const NotificationSystem: NotificationAPI = {
  showSuccess(title: string, message: string, duration = 5000): string {
    return Notifications.success(title, message, duration);
  },

  showError(title: string, message: string, duration = 8000): string {
    return Notifications.error(title, message, duration);
  },

  showWarning(title: string, message: string, duration = 6000): string {
    return Notifications.warning(title, message, duration);
  },

  showInfo(title: string, message: string, duration = 5000): string {
    return Notifications.info(title, message, duration);
  },

  showLoading(title = 'Loading...', message?: string): any {
    currentLoadingController = Notifications.loading(title, message);
    return currentLoadingController;
  },

  hideLoading(): void {
    if (currentLoadingController) {
      currentLoadingController.close();
      currentLoadingController = null;
    }
  },

  confirm(
    title: string,
    message: string,
    opts?: {
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
    },
  ): string {
    return Notifications.confirm(title, message, opts);
  },
};

(window as any).NotificationSystem = NotificationSystem;

console.debug('[TemplateDoctor] NotificationSystem API ready');
