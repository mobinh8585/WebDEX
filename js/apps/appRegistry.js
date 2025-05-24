import { state } from '../core/state.js';
import { WindowManager } from '../managers/windowManager.js';
import { notepadAppConfig } from './notepad.js';
import { fileExplorerAppConfig } from './fileExplorer.js';
import { imageViewerAppConfig } from './imageViewer.js';
import { webBrowserAppConfig } from './webBrowser.js';
import { settingsAppConfig } from './settings.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { showInAppAlert } from '../core/utils.js';
import { calculatorAppConfig } from './calculator.js';
import { recycleBinAppConfig, aboutAppConfig, errorAppConfig, propertiesDialogAppConfig } from './commonApps.js';
import { appImporterAppConfig } from './appImporter.js';

export const AppRegistry = {
    apps: {
        'notepad': notepadAppConfig,
        'fileExplorer': fileExplorerAppConfig,
        'imageViewer': imageViewerAppConfig,
        'webBrowser': webBrowserAppConfig,
        'settings': settingsAppConfig,
        'calculator': calculatorAppConfig,
        'recycleBin': recycleBinAppConfig,
        'about': aboutAppConfig,
        'errorApp': errorAppConfig,
        'propertiesDialog': propertiesDialogAppConfig,
        'appImporter': appImporterAppConfig,
    },

    /** Launches an application by its ID. */
    launchApp: async (appId, params = {}) => {
        if (appId && AppRegistry.apps[appId]) {
            // Check if file system is required and ready
            if (!state.fileSystemReady && (appId === 'fileExplorer' || appId === 'notepad' || (appId === 'propertiesDialog' && params.filePath))) {
                await showInAppAlert("File system is not yet ready. Please wait a moment and try again.");
                console.warn(`AppRegistry: Attempted to launch file-dependent app '${appId}' before FSM ready.`);
                return;
            }
            WindowManager.createWindow(appId, params);
        } else {
            console.warn(`AppRegistry: Attempted to launch unknown or misconfigured app: ${appId}`);
            WindowManager.createWindow('errorApp', { erroredAppId: appId });
        }
    },

    /** Registers a new application dynamically. */
    registerDynamicApp: async (appId, appConfig, htmlContent = null, iconDataUrl = null) => {
        if (AppRegistry.apps[appId]) {
            console.warn(`AppRegistry: App with ID '${appId}' already exists. Overwriting.`);
        }
        AppRegistry.apps[appId] = appConfig;
        console.log(`AppRegistry: Dynamically registered app: ${appId}`);

        // Persist the app configuration and content
        if (state.fileSystemReady) {
            const appDir = `/user_apps/${appId}`;
            await FileSystemManager.createFolder(appDir); // Changed to createFolder
            await FileSystemManager.createFile(`${appDir}/config.json`, JSON.stringify(appConfig), true); // Use createFile with overwrite true
            if (htmlContent) {
                await FileSystemManager.createFile(`${appDir}/index.html`, htmlContent, true); // Use createFile with overwrite true
            }
            if (iconDataUrl && iconDataUrl.startsWith('data:')) {
                // Save custom icon if it's a data URL
                const iconExtension = iconDataUrl.substring(iconDataUrl.indexOf('/') + 1, iconDataUrl.indexOf(';'));
                await FileSystemManager.createFile(`${appDir}/icon.${iconExtension}`, iconDataUrl, true); // Use createFile with overwrite true
            }
            console.log(`AppRegistry: Persisted app '${appId}' to file system.`);
            // Re-render desktop icons to show the new app after a short delay to prevent loop/crash.
            const { DesktopManager } = await import('../managers/desktopManager.js');
            if (DesktopManager && typeof DesktopManager.renderIcons === 'function') {
                setTimeout(async () => {
                    await DesktopManager.renderIcons();
                    // The alert for app loading will now be handled by main.js after all apps are loaded.
                }, 100); // Small delay to allow current operations to complete
            }
        } else {
            console.warn(`AppRegistry: File system not ready, app '${appId}' will not be persisted.`);
        }
    }
};
