import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { StartMenu } from './startMenu.js';
import { ContextMenu } from './contextMenu.js';
import { WindowManager } from './windowManager.js';
import { domElements } from '../main.js';
import { showInAppAlert } from '../core/utils.js';

export const Taskbar = {
    init: () => {
        if (!domElements.taskbarElement || !domElements.startButton || !domElements.runningAppsContainer || !domElements.clockElement || !domElements.systemTrayElement) {
            console.error("FATAL: One or more Taskbar elements are missing!");
            return;
        }

        domElements.startButton.addEventListener('click', (e) => {
            e.stopPropagation(); 
            SoundPlayer.playSound('click');
            StartMenu.toggle();
            if (ContextMenu && ContextMenu.isVisible()) ContextMenu.hide();
        });

        Taskbar.renderSystemTray();
        Taskbar.updateClock();
        setInterval(Taskbar.updateClock, 10000); 
    },

    renderSystemTray: () => {
        // ... (no changes in this method)
        if (!domElements.systemTrayElement) return;
        domElements.systemTrayElement.innerHTML = `
            <span class="tray-icon" id="tray-network" title="Network (Dummy)" aria-label="Network status" role="button" tabindex="0">📶</span>
            <span class="tray-icon" id="tray-volume" title="Volume" aria-label="Volume control" role="button" tabindex="0">🔊</span>`;

        const networkIcon = domElements.systemTrayElement.querySelector('#tray-network');
        if (networkIcon) {
            networkIcon.onclick = async (e) => { await showInAppAlert(`${e.currentTarget.title} clicked.`); SoundPlayer.playSound('click'); };
            networkIcon.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') networkIcon.click(); };
        }

        const volumeIcon = domElements.systemTrayElement.querySelector('#tray-volume');
        if (volumeIcon) {
            volumeIcon.onclick = (e) => { e.stopPropagation(); SoundPlayer.playSound('click'); Taskbar.toggleVolumePopup(); };
            volumeIcon.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') volumeIcon.click(); };
        }
    },

    toggleVolumePopup: () => {
        // ... (no changes in this method)
        let popup = document.getElementById('volume-popup-control');
        if (state.isVolumePopupOpen && popup) {
            // Hide with animation
            popup.classList.remove('show');
            popup.classList.add('hide');
            popup.addEventListener('transitionend', () => {
                if (popup.classList.contains('hide')) { // Ensure it's the hide transition
                    popup.remove();
                }
            }, { once: true });
            state.isVolumePopupOpen = false;
        } else {
            if (popup) popup.remove(); // Remove any existing popup instantly

            popup = document.createElement('div');
            popup.id = 'volume-popup-control';
            popup.className = 'volume-popup';
            popup.innerHTML = `<span>🔊</span> <input type="range" min="0" max="100" value="${state.masterVolume}" aria-label="Volume slider">`;
            popup.onclick = (e) => e.stopPropagation();

            document.body.appendChild(popup);

            // Trigger show animation
            requestAnimationFrame(() => {
                popup.classList.add('show');
            });

            const volumeSlider = popup.querySelector('input[type="range"]');
            if (volumeSlider) {
                volumeSlider.addEventListener('input', (e) => {
                    SoundPlayer.setMasterVolume(parseInt(e.target.value, 10));
                    // Update the CSS variable for track fill
                    volumeSlider.style.setProperty('--value', `${e.target.value}%`);
                });
                // Set initial value for CSS variable
                volumeSlider.style.setProperty('--value', `${state.masterVolume}%`);
            }

            const trayVolumeIcon = domElements.systemTrayElement.querySelector('#tray-volume');
            if (trayVolumeIcon) {
                const rect = trayVolumeIcon.getBoundingClientRect();
                popup.style.right = `${window.innerWidth - rect.right}px`;
                popup.style.bottom = `${CONSTANTS.TASKBAR_HEIGHT + 5}px`;
            }
            state.isVolumePopupOpen = true;
            if (volumeSlider) {
                volumeSlider.focus();
            }

            document.addEventListener('click', Taskbar.handleGlobalClickForVolume, { once: true, capture: true });
        }
    },

    handleGlobalClickForVolume: (event) => {
        const popup = document.getElementById('volume-popup-control');
        const volumeIcon = domElements.systemTrayElement.querySelector('#tray-volume');

        if (popup && !popup.contains(event.target) && (!volumeIcon || !volumeIcon.contains(event.target))) {
            // Trigger hide animation
            popup.classList.remove('show');
            popup.classList.add('hide');
            popup.addEventListener('transitionend', () => {
                if (popup.classList.contains('hide')) { // Ensure it's the hide transition
                    popup.remove();
                }
            }, { once: true });
            state.isVolumePopupOpen = false;
        } else if (popup) {
            document.addEventListener('click', Taskbar.handleGlobalClickForVolume, { once: true, capture: true });
        }
    },

    updateClock: () => {
        // ... (no changes in this method)
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
                    WindowManager.restoreWindow(windowId);
                } else {
                    WindowManager.focusWindow(windowId);
                }
            }
        });

        // Animation: Set initial state for animation
        button.style.opacity = '0';
        button.style.transform = 'scale(0.8) translateX(-10px)'; // Example initial transform

        domElements.runningAppsContainer.appendChild(button);
        if (state.openWindows[windowId]) {
            state.openWindows[windowId].taskbarButton = button;
        }

        // Trigger animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { // Double rAF for good measure to ensure transition triggers
                button.style.opacity = '1';
                button.style.transform = 'scale(1) translateX(0)';
            });
        });
    },

    removeApp: (windowId) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.taskbarButton) {
            // Optional: Add a fade-out animation before removing
            winData.taskbarButton.style.opacity = '0';
            winData.taskbarButton.style.transform = 'scale(0.8) translateX(-10px)';
            // Get transition duration from CSS, fallback to a default
            const duration = parseFloat(getComputedStyle(winData.taskbarButton).transitionDuration || '0.2s') * 1000;
            setTimeout(() => {
                if (winData.taskbarButton && winData.taskbarButton.parentNode) {
                    winData.taskbarButton.remove();
                }
            }, duration);
        }
    },

    setAppActive: (windowId, isActive, isMinimizedOverride) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.taskbarButton) { // Check if taskbarButton exists
            const isMinimized = typeof isMinimizedOverride === 'boolean' ? isMinimizedOverride : winData.isMinimized;

            if (isActive && !isMinimized) {
                const currentActiveButton = domElements.runningAppsContainer.querySelector('.taskbar-app-button.active');
                if (currentActiveButton && currentActiveButton !== winData.taskbarButton) {
                    currentActiveButton.classList.remove('active');
                    currentActiveButton.removeAttribute('aria-selected');
                }
                winData.taskbarButton.classList.add('active');
                winData.taskbarButton.setAttribute('aria-selected', 'true');
            } else {
                winData.taskbarButton.classList.remove('active');
                if(!isMinimized) winData.taskbarButton.removeAttribute('aria-selected');
            }
        }
    },

    setAppMinimized: (windowId, isMinimized) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.taskbarButton) { // Check if taskbarButton exists
            winData.taskbarButton.classList.toggle('minimized', isMinimized);
            if (isMinimized) { 
                winData.taskbarButton.classList.remove('active');
                winData.taskbarButton.setAttribute('aria-selected', 'false');
            }
        }
    }
};
