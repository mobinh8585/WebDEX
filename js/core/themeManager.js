import { state } from './state.js';
import { DesktopManager } from '../managers/desktopManager.js'; // For loadWallpaper

export const ThemeManager = {
    applyTheme: (themeName) => {
        document.body.dataset.theme = themeName;
        state.currentTheme = themeName;
        try {
            localStorage.setItem('desktop-theme', themeName);
        } catch (e) {
            console.warn("ThemeManager: Error saving theme to localStorage:", e);
        }
        // Reload wallpaper if DesktopManager is available (it might not be during initial theme set)
        if (DesktopManager && typeof DesktopManager.loadWallpaper === 'function') {
            DesktopManager.loadWallpaper();
        }
    },
    toggleTheme: () => {
        ThemeManager.applyTheme(state.currentTheme === 'light' ? 'dark' : 'light');
    }
};