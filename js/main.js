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
// AppRegistry is not directly used in main.js for init, but other modules depend on it being available.
// Its definition (which imports app configs) ensures apps are "known".

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
}


// ~~~~~~~~~~~~~~~~~~ Initialization (DOMContentLoaded) ~~~~~~~~~~~~~~~~~~
document.addEventListener('DOMContentLoaded', async () => {
    // console.log("DOM fully loaded and parsed."); // Dev Log

    initializeDOMReferences();
    loadInitialStateFromLocalStorage(); // Load theme & icon positions

    // Initialize CONSTANTS that depend on CSS
    try {
        CONSTANTS.TASKBAR_HEIGHT = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-height-val')) || 44;
    } catch(e) {
        console.warn("Failed to read --taskbar-height-val from CSS, using default.", e);
        // CONSTANTS.TASKBAR_HEIGHT is already defaulted in constants.js
    }


    try {
        ThemeManager.applyTheme(state.currentTheme); // Apply theme early
        SoundPlayer.init();

        // console.log("DOMContentLoaded: Awaiting FileSystemManager.init()..."); // Dev log
        await FileSystemManager.init();
        // console.log("DOMContentLoaded: FileSystemManager.init() complete. FS Ready:", state.fileSystemReady); // Dev log

        if (!state.fileSystemReady) {
            throw new Error("File System Manager failed to initialize. Desktop cannot load fully.");
        }

        // Initialize UI Managers - Order can be important
        // DesktopManager needs FSM and its own init for icon grid calculations
        await DesktopManager.init(); // This now uses rAF for renderIcons
        Taskbar.init();
        StartMenu.init();
        ContextMenu.init();
        WindowManager.init(); // Init WindowManager after other UI elements are somewhat ready

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


        console.log("Web Desktop Environment 5.0.2 Initialized successfully.");

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

// Global event listeners for specific behaviors
document.addEventListener('contextmenu', event => event.preventDefault()); // Prevent default browser context menu

// Clear long press timer on touch end/cancel/move to prevent false positives
const clearLongPress = () => clearTimeout(state.longPressTimer);
document.addEventListener('touchmove', clearLongPress, { passive: true });
document.addEventListener('touchend', clearLongPress, { passive: true });
document.addEventListener('touchcancel', clearLongPress, { passive: true });