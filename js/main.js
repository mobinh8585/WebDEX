import { CONSTANTS } from './core/constants.js';
import { state, loadInitialStateFromLocalStorage } from './core/state.js';
import { ThemeManager } from './core/themeManager.js';
import { SoundPlayer } from './core/soundPlayer.js';
import { FileSystemManager } from './core/fileSystemManager.js';
import { DesktopManager } from './managers/desktopManager.js';
import { Taskbar } from './managers/taskbar.js';
import { StartMenu } from './managers/startMenu.js';
import { ContextMenu } from './managers/contextMenu.js';
import { WindowManager } from './managers/windowManager.js';
import { NotificationManager } from './managers/notificationManager.js'; // Import NotificationManager
import { AppRegistry } from './apps/appRegistry.js'; // Ensure AppRegistry is imported for dynamic app loading
import { showInAppAlert } from './core/utils.js'; // Import showInAppAlert

// ~~~~~~~~~~~~~~~~~~ DOM Element References (Initialized in DOMContentLoaded) ~~~~~~~~~~~~~~~~~~
export const domElements = {
    desktopElement: null,
    taskbarElement: null,
    startButton: null,
    runningAppsContainer: null,
    systemTrayElement: null,
    clockElement: null,
    startMenuElement: null,
    startMenuAppsList: null,
    startMenuSearchInput: null,
    contextMenuElement: null,
    snapPreviewElement: null,
};

function initializeDOMReferences() {
    domElements.desktopElement = document.getElementById('desktop');
    domElements.taskbarElement = document.getElementById('taskbar');
    domElements.startButton = document.getElementById('start-button');
    domElements.runningAppsContainer = document.getElementById('running-apps');
    domElements.systemTrayElement = document.getElementById('system-tray');
    domElements.clockElement = document.getElementById('clock');
    domElements.startMenuElement = document.getElementById('start-menu');
    domElements.startMenuAppsList = document.getElementById('start-menu-apps');
    domElements.startMenuSearchInput = document.querySelector('#start-menu-search input');
    domElements.contextMenuElement = document.getElementById('context-menu');
    domElements.snapPreviewElement = document.getElementById('snap-preview');
    domElements.customCursor = document.getElementById('custom-cursor');
}


// ~~~~~~~~~~~~~~~~~~ Initialization (DOMContentLoaded) ~~~~~~~~~~~~~~~~~~
document.addEventListener('DOMContentLoaded', async () => {
    initializeDOMReferences();
    loadInitialStateFromLocalStorage(); // Load theme & icon positions
    initializeCustomCursor(); // Initialize custom cursor logic

    // Initialize CONSTANTS that depend on CSS
    try {
        CONSTANTS.TASKBAR_HEIGHT = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-height-val')) || 44;
    } catch(e) {
        console.warn("Failed to read --taskbar-height-val from CSS, using default.", e);
    }

    try {
        ThemeManager.applyTheme(state.currentTheme); // Apply theme early
        SoundPlayer.init();

        await FileSystemManager.init();

        if (!state.fileSystemReady) {
            throw new Error("File System Manager failed to initialize. Desktop cannot load fully.");
        }

        // Load dynamically created user apps from file system
        await loadUserApps();
        // The alert for imported apps is now handled by AppRegistry.registerDynamicApp
        // and should only show when an app is newly imported, not on every page load.

        // Initialize UI Managers - Order can be important
        await DesktopManager.init(); // This now uses rAF for renderIcons
        Taskbar.init();
        StartMenu.init();
        ContextMenu.init();
        WindowManager.init(); // Init WindowManager after other UI elements are somewhat ready
        NotificationManager.init(); // Initialize NotificationManager

        // Global click listener to hide menus or clear active states (moved from DesktopManager)
        document.addEventListener('click', (e) => {
            if (domElements.startMenuElement && domElements.startMenuElement.classList.contains('visible') &&
                !e.target.closest('#start-menu') && !e.target.closest('#start-button')) {
                StartMenu.hide();
            }
            if (domElements.contextMenuElement && domElements.contextMenuElement.classList.contains('visible') &&
                !e.target.closest('#context-menu')) {
                ContextMenu.hide();
            }
            if (!e.target.closest('.desktop-icon') && !e.target.closest('#context-menu')) {
                DesktopManager.clearActiveIcon();
            }
        }, true); // Use capture phase


        console.log("Web Desktop Environment 0.01 Initialized successfully.");

    } catch (error) {
        console.error("FATAL ERROR during initialization:", error);
        document.body.innerHTML = `
            <div style="color:white; background-color:#333; padding:20px; font-family:sans-serif; text-align:center; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <h1>Oops! Something went wrong.</h1>
                <p>The Web Desktop Environment could not start.</p>
                <p>Please open the browser's developer console (F12 or Ctrl+Shift+I) for more details.</p>
                <p style="margin-top:10px; font-style:italic;">Error: ${error.message}</p>
                ${error.stack ? `<pre style="margin-top:10px; text-align:left; font-size:0.8em; background:#444; padding:10px; border-radius:5px; max-width:80vw; overflow:auto;">${error.stack}</pre>` : ''}
            </div>`;
    }
});

/** Loads user-created apps from the virtual file system and registers them. */
async function loadUserApps() {
    if (!state.fileSystemReady) {
        console.warn("main.js: File system not ready, cannot load user apps.");
        return;
    }
    try {
        const userAppDirs = await FileSystemManager.listDirectory('/user_apps/');
        for (const appDir of userAppDirs) {
            if (appDir.type === 'folder') {
                const configPath = `${appDir.path}config.json`;
                const htmlPath = `${appDir.path}index.html`;
                const iconPath = `${appDir.path}icon.png`; // Assuming png for now, could be dynamic

                const appConfigItem = await FileSystemManager.getItem(configPath);
                const htmlContentItem = await FileSystemManager.getItem(htmlPath);
                const iconItem = await FileSystemManager.getItem(iconPath).catch(() => null); // Icon is optional

                if (appConfigItem && htmlContentItem) {
                    const appConfig = JSON.parse(appConfigItem.content);
                    const htmlContent = htmlContentItem.content;
                    const iconDataUrl = iconItem ? iconItem.content : appConfig.icon; // Use stored icon or config icon

                    // Re-create the launch function as it's not serializable in JSON
                    appConfig.launch = (windowId, contentArea) => {
                        contentArea.innerHTML = `<iframe srcdoc="${escapeHtml(htmlContent)}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" style="width:100%; height:100%; border:none;"></iframe>`;
                        return {}; // Return an empty object as the app instance
                    };
                    // Ensure the icon is correctly set if it was a data URL
                    appConfig.icon = iconDataUrl;

                    AppRegistry.registerDynamicApp(appConfig.appId, appConfig, htmlContent, iconDataUrl);
                } else {
                    console.warn(`main.js: Incomplete user app found in ${appDir.path}. Skipping.`);
                }
            }
        }
        console.log("main.js: User apps loaded and registered.");
    } catch (error) {
        console.error("main.js: Error loading user apps:", error);
    }
}

// Helper function to escape HTML for srcdoc (copied from appImporter.js)
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "") // Corrected as per user instruction
        .replace(/'/g, "&#039;");
}


// Global event listeners for specific behaviors
document.addEventListener('contextmenu', event => {
    // Check if the right-click was on a text input element
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        event.preventDefault(); // Prevent default browser context menu
        // Ensure the element has an ID, assign one if not (though most should have one)
        if (!target.id) {
            target.id = `auto-generated-input-id-${Math.random().toString(36).substr(2, 9)}`;
        }
        ContextMenu.showForTextInput(event, target.id);
    } else {
        event.preventDefault(); // Prevent default browser context menu for other elements
    }
});

// Clear long press timer on touch end/cancel/move to prevent false positives
const clearLongPress = () => clearTimeout(state.longPressTimer);
document.addEventListener('touchmove', clearLongPress, { passive: true });
document.addEventListener('touchend', clearLongPress, { passive: true });
document.addEventListener('touchcancel', clearLongPress, { passive: true });

/**
 * Initializes the custom cursor functionality.
 * Attaches event listeners to track mouse movement and update cursor appearance.
 */
function initializeCustomCursor() {
    const cursor = domElements.customCursor;
    if (!cursor) {
        console.warn("Custom cursor element not found. Custom cursor will not be active.");
        return;
    }

    let rAF;
    let mouseX = 0;
    let mouseY = 0;

    function updateCursorPosition() {
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        rAF = requestAnimationFrame(updateCursorPosition);
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!rAF) {
            rAF = requestAnimationFrame(updateCursorPosition);
        }
    });

    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = '0';
        if (rAF) {
            cancelAnimationFrame(rAF);
            rAF = null;
        }
    });

    document.addEventListener('mouseenter', () => {
        cursor.style.opacity = '1';
        if (!rAF) {
            rAF = requestAnimationFrame(updateCursorPosition);
        }
    });

    // Handle cursor states for different elements
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.closest('a, button, .desktop-icon, .taskbar-app-button, .tray-icon, .start-menu-apps li, .window-controls button, .dialog-button')) {
            document.body.classList.add('cursor-hover');
        } else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            document.body.classList.add('cursor-text');
        } else {
            document.body.classList.remove('cursor-hover', 'cursor-text');
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (!e.relatedTarget || !e.relatedTarget.closest('a, button, .desktop-icon, .taskbar-app-button, .tray-icon, .start-menu-apps li, .window-controls button, .dialog-button')) {
            document.body.classList.remove('cursor-hover');
        }
        if (!e.relatedTarget || (e.relatedTarget.tagName !== 'INPUT' && e.relatedTarget.tagName !== 'TEXTAREA')) {
            document.body.classList.remove('cursor-text');
        }
    });

}
