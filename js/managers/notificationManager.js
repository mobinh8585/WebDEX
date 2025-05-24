import { state } from '../core/state.js';
import { SoundPlayer } from '../core/soundPlayer.js';

export const NotificationManager = {
    _notificationContainer: null,
    _notifications: [],
    _notificationIdCounter: 0,

    init: () => {
        // Ensure init is idempotent or called only once
        if (NotificationManager._notificationContainer) return;

        NotificationManager._notificationContainer = document.createElement('div');
        NotificationManager._notificationContainer.id = 'notification-container';
        document.body.appendChild(NotificationManager._notificationContainer);
    },

    /**
     * Shows a toast notification.
     * @param {string} title - The title of the notification.
     * @param {string} message - The message content of the notification.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.duration=5000] - Duration in milliseconds before auto-dismissal. Set to 0 for persistent.
     * @param {string} [options.type='info'] - Type of notification ('info', 'success', 'warning', 'error').
     * @param {boolean} [options.dismissible=true] - Whether the notification can be manually dismissed.
     * @param {string} [options.icon=''] - Custom icon HTML/text. Default icons based on type.
     */
    show: (title, message, options = {}) => {
        if (!NotificationManager._notificationContainer) {
            console.warn("NotificationManager not initialized. Call init() first.");
            // Attempt to initialize now if called before DOMContentLoaded
            if (document.body) NotificationManager.init();
            else { // Defer if body not ready
                document.addEventListener('DOMContentLoaded', () => NotificationManager.show(title, message, options));
                return;
            }
        }


        const id = `notification-${NotificationManager._notificationIdCounter++}`;
        const {
            duration = 5000,
            type = 'info', // 'info', 'success', 'warning', 'error'
            dismissible = true,
        } = options;
        
        let icon = options.icon;
        if (!icon) {
            switch (type) {
                case 'success': icon = '✔️'; break;
                case 'warning': icon = '⚠️'; break;
                case 'error':   icon = '❌'; break;
                case 'info':    // fall-through
                default:        icon = 'ℹ️'; break;
            }
        }


        const notificationEl = document.createElement('div');
        notificationEl.id = id;
        notificationEl.className = `notification-toast ${type}`; // Add type as class for styling
        notificationEl.setAttribute('role', 'alert');
        notificationEl.setAttribute('aria-live', 'assertive');
        notificationEl.setAttribute('aria-atomic', 'true');

        notificationEl.innerHTML = `
            <div class="notification-header">
                ${icon ? `<span class="notification-icon">${icon}</span>` : ''}
                <span class="notification-title">${title}</span>
                ${dismissible ? `<button class="notification-dismiss" aria-label="Dismiss notification">✕</button>` : ''}
            </div>
            <div class="notification-body">${message}</div>
        `;

        NotificationManager._notificationContainer.appendChild(notificationEl);
        SoundPlayer.playSound('click'); // Use a defined sound like 'click'

        const notification = { id, el: notificationEl, timeout: null };
        NotificationManager._notifications.push(notification);

        if (duration > 0) {
            notification.timeout = setTimeout(() => {
                NotificationManager.remove(id);
            }, duration);
        }

        if (dismissible) {
            notificationEl.querySelector('.notification-dismiss').addEventListener('click', () => {
                NotificationManager.remove(id);
            });
        }

        // Trigger reflow to ensure animation plays
        void notificationEl.offsetWidth;
        notificationEl.classList.add('show');
    },

    remove: (id) => {
        const index = NotificationManager._notifications.findIndex(n => n.id === id);
        if (index > -1) {
            const notification = NotificationManager._notifications[index];
            
            if (notification.timeout) {
                clearTimeout(notification.timeout);
            }

            notification.el.classList.remove('show');
            notification.el.classList.add('hide');

            // Remove after animation. Use transitionend.
            notification.el.addEventListener('transitionend', () => {
                if (notification.el.parentNode) { // Check if still in DOM
                    notification.el.remove();
                }
                // Remove from array after DOM removal is certain
                const newIndex = NotificationManager._notifications.findIndex(n => n.id === id);
                if (newIndex > -1) {
                    NotificationManager._notifications.splice(newIndex, 1);
                }
            }, { once: true });


        }
    },

    clearAll: () => {
        [...NotificationManager._notifications].forEach(notification => {
            NotificationManager.remove(notification.id);
        });
    }
};

// Initialize the notification container when the script loads or DOM is ready
// This is already handled in main.js to ensure it's called after body exists.
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', NotificationManager.init);
// } else {
//     NotificationManager.init();
// }