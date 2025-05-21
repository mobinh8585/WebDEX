import { state } from '../core/state.js';
import { WindowManager } from '../managers/windowManager.js';
import { notepadAppConfig } from './notepad.js';
import { fileExplorerAppConfig } from './fileExplorer.js';
import { imageViewerAppConfig } from './imageViewer.js';
import { webBrowserAppConfig } from './webBrowser.js';
import { settingsAppConfig } from './settings.js';
import { calculatorAppConfig } from './calculator.js';
import { recycleBinAppConfig, aboutAppConfig, errorAppConfig, propertiesDialogAppConfig } from './commonApps.js';

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
    },

    /** Launches an application by its ID. */
    launchApp: (appId, params = {}) => {
        if (appId && AppRegistry.apps[appId]) {
            // Check if file system is required and ready
            if (!state.fileSystemReady && (appId === 'fileExplorer' || appId === 'notepad' || (appId === 'propertiesDialog' && params.filePath))) {
                alert("File system is not yet ready. Please wait a moment and try again.");
                console.warn(`AppRegistry: Attempted to launch file-dependent app '${appId}' before FSM ready.`);
                return;
            }
            WindowManager.createWindow(appId, params);
        } else {
            console.warn(`AppRegistry: Attempted to launch unknown or misconfigured app: ${appId}`);
            WindowManager.createWindow('errorApp', { erroredAppId: appId });
        }
    }
};