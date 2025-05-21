import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { StartMenu } from './startMenu.js';
import { ContextMenu } from './contextMenu.js';
import { WindowManager } from './windowManager.js';
import { domElements } from '../main.js'; // Shared DOM elements

export const Taskbar = {
    init: () => {
        // DOM elements are now in domElements from main.js
        if (!domElements.taskbarElement || !domElements.startButton || !domElements.runningAppsContainer || !domElements.clockElement || !domElements.systemTrayElement) {
            console.error("FATAL: One or more Taskbar elements are missing!");
            return;
        }

        domElements.startButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from closing Start Menu immediately if it's already open
            SoundPlayer.playSound('click');
            StartMenu.toggle();
            if (ContextMenu && ContextMenu.isVisible()) ContextMenu.hide(); // Hide context menu if open
        });

        Taskbar.renderSystemTray();
        Taskbar.updateClock();
        setInterval(Taskbar.updateClock, 10000); // Update clock every 10 seconds
    },

    renderSystemTray: () => {
        if (!domElements.systemTrayElement) return;
        domElements.systemTrayElement.innerHTML = `
            <span class="tray-icon" id="tray-network" title="Network (Dummy)" aria-label="Network status" role="button" tabindex="0">📶</span>
            <span class="tray-icon" id="tray-volume" title="Volume" aria-label="Volume control" role="button" tabindex="0">🔊</span>`;

        const networkIcon = domElements.systemTrayElement.querySelector('#tray-network');
        if (networkIcon) {
            networkIcon.onclick = (e) => { alert(`${e.currentTarget.title} clicked.`); SoundPlayer.playSound('click'); };
            networkIcon.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') networkIcon.click(); };
        }

        const volumeIcon = domElements.systemTrayElement.querySelector('#tray-volume');
        if (volumeIcon) {
            volumeIcon.onclick = (e) => { e.stopPropagation(); SoundPlayer.playSound('click'); Taskbar.toggleVolumePopup(); };
            volumeIcon.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') volumeIcon.click(); };
        }
    },

    toggleVolumePopup: () => {
        let popup = document.getElementById('volume-popup-control');
        if (state.isVolumePopupOpen && popup) {
            popup.remove();
            state.isVolumePopupOpen = false;
        } else {
            if (popup) popup.remove(); // Remove any existing one first

            popup = document.createElement('div');
            popup.id = 'volume-popup-control';
            popup.className = 'volume-popup';
            popup.innerHTML = `<span>🔊</span> <input type="range" min="0" max="100" value="75" aria-label="Volume slider">`;
            popup.onclick = (e) => e.stopPropagation(); // Prevent closing when clicking inside popup

            document.body.appendChild(popup);

            const trayVolumeIcon = domElements.systemTrayElement.querySelector('#tray-volume');
            if (trayVolumeIcon) { // Position popup relative to volume icon
                const rect = trayVolumeIcon.getBoundingClientRect();
                popup.style.right = `${window.innerWidth - rect.right}px`;
                popup.style.bottom = `${CONSTANTS.TASKBAR_HEIGHT + 5}px`; // 5px above taskbar
            }
            state.isVolumePopupOpen = true;
            popup.querySelector('input[type="range"]').focus();

            // Listener to close popup when clicking outside
            document.addEventListener('click', Taskbar.handleGlobalClickForVolume, { once: true, capture: true });
        }
    },

    handleGlobalClickForVolume: (event) => {
        const popup = document.getElementById('volume-popup-control');
        const volumeIcon = domElements.systemTrayElement.querySelector('#tray-volume');

        if (popup && !popup.contains(event.target) && (!volumeIcon || !volumeIcon.contains(event.target))) {
            popup.remove();
            state.isVolumePopupOpen = false;
        } else if (popup) {
            // If popup still exists (e.g., click was inside), re-add listener for next click
            document.addEventListener('click', Taskbar.handleGlobalClickForVolume, { once: true, capture: true });
        }
    },

    updateClock: () => {
        if (!domElements.clockElement) return;
        const now = new Date();
        domElements.clockElement.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    },

    addApp: (windowId, title, icon) => {
        if (!domElements.runningAppsContainer) return;
        const button = document.createElement('button');
        button.className = 'taskbar-app-button';
        button.dataset.windowId = windowId;
        button.innerHTML = `<span class="app-icon">${icon || '🚀'}</span> <span class="app-title">${title}</span>`;
        button.title = title;
        button.setAttribute('aria-label', `${title} application`);

        button.addEventListener('click', () => {
            SoundPlayer.playSound('click');
            const winData = state.openWindows[windowId];
            if (winData) {
                if (state.activeWindowId === windowId && !winData.isMinimized) {
                    WindowManager.minimizeWindow(windowId);
                } else if (winData.isMinimized) {
                    WindowManager.restoreWindow(windowId); // Will also focus
                } else {
                    WindowManager.focusWindow(windowId);
                }
            }
        });
        domElements.runningAppsContainer.appendChild(button);
        if (state.openWindows[windowId]) {
            state.openWindows[windowId].taskbarButton = button;
        }
    },

    removeApp: (windowId) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.taskbarButton) {
            winData.taskbarButton.remove();
        }
    },

    setAppActive: (windowId, isActive, isMinimizedOverride) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.taskbarButton) {
            const isMinimized = typeof isMinimizedOverride === 'boolean' ? isMinimizedOverride : winData.isMinimized;

            if (isActive && !isMinimized) {
                // Deactivate any other active taskbar button
                const currentActiveButton = domElements.runningAppsContainer.querySelector('.taskbar-app-button.active');
                if (currentActiveButton && currentActiveButton !== winData.taskbarButton) {
                    currentActiveButton.classList.remove('active');
                    currentActiveButton.removeAttribute('aria-selected');
                }
                winData.taskbarButton.classList.add('active');
                winData.taskbarButton.setAttribute('aria-selected', 'true');
            } else {
                winData.taskbarButton.classList.remove('active');
                if (!isMinimized) winData.taskbarButton.removeAttribute('aria-selected'); // only remove if not minimized and not active
            }
        }
    },

    setAppMinimized: (windowId, isMinimized) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.taskbarButton) {
            winData.taskbarButton.classList.toggle('minimized', isMinimized);
            if (isMinimized) { // Minimized apps are not "active" on taskbar in the same way
                winData.taskbarButton.classList.remove('active');
                winData.taskbarButton.setAttribute('aria-selected', 'false');
            }
        }
    }
};