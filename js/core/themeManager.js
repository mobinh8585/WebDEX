import { state } from './state.js';
import { DesktopManager } from '../managers/desktopManager.js'; 

export const ThemeManager = {
    applyTheme: (themeName) => {
        document.body.dataset.theme = themeName;
        state.currentTheme = themeName;
        try {
            localStorage.setItem('desktop-theme', themeName);
        } catch (e) {
            console.warn("ThemeManager: Error saving theme to localStorage:", e);
        }
        

        // Defer wallpaper loading slightly to ensure DesktopManager is fully initialized,
        // especially if applyTheme is called early during startup.
        // Optional chaining (?.) provides safety if DesktopManager or loadWallpaper isn't defined yet.
        if (typeof DesktopManager?.loadWallpaper === 'function') {
            Promise.resolve().then(() => {
                // Re-check in case DesktopManager was undefined initially and became available
                if (typeof DesktopManager?.loadWallpaper === 'function') {
                    DesktopManager.loadWallpaper();
                } else {
                     console.warn("ThemeManager.applyTheme: DesktopManager.loadWallpaper still not available after deferral.");
                }
            }).catch(e => console.error("Error during deferred wallpaper load:", e));
        } else if (DesktopManager === undefined) {
            console.warn("ThemeManager.applyTheme: DesktopManager module seems not yet loaded. Wallpaper might not update if this is an initial call.");
        }
    },

    toggleTheme: () => {
        ThemeManager.applyTheme(state.currentTheme === 'light' ? 'dark' : 'light');
    },

    // Added getCurrentTheme method
    getCurrentTheme: () => {
        return state.currentTheme;
    }
};