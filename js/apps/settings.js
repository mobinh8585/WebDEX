import { state } from '../core/state.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { ThemeManager } from '../core/themeManager.js';
import { DesktopManager } from '../managers/desktopManager.js'; // For setBackground

export const settingsAppConfig = {
    name:'Settings', icon:'⚙️', width:500, height:420, allowMultiple:false,
    launch: (windowId, contentArea) => {
        if(!contentArea) return;
        contentArea.classList.add('settings-app-content');
        // contentArea.id = `settings-content-${windowId}`; // For specific styling

        const currentWallpaperLight = localStorage.getItem('desktop-wallpaper-light') || '';
        const currentWallpaperDark = localStorage.getItem('desktop-wallpaper-dark') || '';

        contentArea.innerHTML = `
            <div class="setting-item">
                <label for="wallpaper-url-light-${windowId}">Light Theme Wallpaper URL:</label>
                <input type="url" id="wallpaper-url-light-${windowId}" value="${currentWallpaperLight}" placeholder="Leave empty for default">
                <button id="apply-wallpaper-light-${windowId}">Apply</button>
                <button id="reset-wallpaper-light-${windowId}">Reset</button>
            </div>
            <div class="setting-item">
                <label for="wallpaper-url-dark-${windowId}">Dark Theme Wallpaper URL:</label>
                <input type="url" id="wallpaper-url-dark-${windowId}" value="${currentWallpaperDark}" placeholder="Leave empty for default">
                <button id="apply-wallpaper-dark-${windowId}">Apply</button>
                <button id="reset-wallpaper-dark-${windowId}">Reset</button>
            </div>
            <div class="setting-item">
                <label>Theme:</label>
                <button id="toggle-theme-btn-${windowId}">Toggle Theme</button>
                <span>Current: <span id="current-theme-label-${windowId}">${state.currentTheme}</span></span>
                <span class="theme-preview" id="theme-preview-${windowId}"
                      style="background-color:${state.currentTheme === 'light' ? 'var(--window-bg-light)' : 'var(--window-bg-dark)'}"></span>
            </div>`;

        const updateThemeDisplay = () => {
            const themeLabel = contentArea.querySelector(`#current-theme-label-${windowId}`);
            const themePreview = contentArea.querySelector(`#theme-preview-${windowId}`);
            if (themeLabel) themeLabel.textContent = state.currentTheme;
            if (themePreview) {
                themePreview.style.backgroundColor = state.currentTheme === 'light' ?
                    getComputedStyle(document.documentElement).getPropertyValue('--window-bg-light') :
                    getComputedStyle(document.documentElement).getPropertyValue('--window-bg-dark');
            }
        };
        updateThemeDisplay(); // Initial display

        const setupWallpaperControls = (themeType) => {
            const urlInput = contentArea.querySelector(`#wallpaper-url-${themeType}-${windowId}`);
            const applyButton = contentArea.querySelector(`#apply-wallpaper-${themeType}-${windowId}`);
            const resetButton = contentArea.querySelector(`#reset-wallpaper-${themeType}-${windowId}`);

            if (!urlInput || !applyButton || !resetButton) return;

            applyButton.onclick = () => {
                const url = urlInput.value.trim();
                // Saving directly to localStorage here is fine as DesktopManager.setBackground also does this
                localStorage.setItem(`desktop-wallpaper-${themeType}`, url);
                if (state.currentTheme === themeType && DesktopManager) { // Apply if current theme matches
                    DesktopManager.setBackground(url);
                }
                SoundPlayer.playSound('click');
            };
            resetButton.onclick = () => {
                localStorage.setItem(`desktop-wallpaper-${themeType}`, ''); // Empty string for default
                urlInput.value = '';
                if (state.currentTheme === themeType && DesktopManager) {
                    DesktopManager.setBackground(''); // Triggers default
                }
                SoundPlayer.playSound('click');
            };
        };
        setupWallpaperControls('light');
        setupWallpaperControls('dark');

        const toggleThemeButton = contentArea.querySelector(`#toggle-theme-btn-${windowId}`);
        if (toggleThemeButton) {
            toggleThemeButton.onclick = () => {
                ThemeManager.toggleTheme();
                updateThemeDisplay(); // Update labels/preview after toggle
                SoundPlayer.playSound('click');
            };
        }
    }
};