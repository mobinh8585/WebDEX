import { WindowManager } from '../managers/windowManager.js';
import { AppRegistry } from './appRegistry.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { showInAppAlert } from '../core/utils.js';

export const appImporterAppConfig = {
    appId: 'appImporter',
    name: 'App Importer',
    icon: '📦', // Using an emoji as per user feedback
    title: 'App Importer', // Added title property
    width: 500,
    height: 400,
    canResize: false,
    canMaximize: false,
    canMinimize: true,
    is: 'app-importer-window',
    launch: (windowId, contentArea) => { // This is the actual launch function for the app importer window
        contentArea.innerHTML = `
            <div class="app-importer-container">
                <h2>Create New App</h2>
                <div class="form-group">
                    <label for="appName">App Name:</label>
                    <input type="text" id="appName" placeholder="e.g., My Custom App">
                </div>
                <div class="form-group">
                    <label for="appIcon">App Icon (Emoji):</label>
                    <input type="text" id="appIcon" placeholder="e.g., 🚀" maxlength="2">
                    <p class="help-text">Enter a single emoji character for the app icon.</p>
                </div>
                <div class="form-group">
                    <label for="appHtmlFile">Upload Custom HTML App:</label>
                    <input type="file" id="appHtmlFile" accept=".html">
                    <p class="help-text">Upload an HTML file. It can contain CSS and client-side JavaScript. This will run in a secure sandbox.</p>
                </div>
                <button id="createAppBtn">Create App</button>
            </div>
        `;

        const appNameInput = contentArea.querySelector('#appName');
        const appIconInput = contentArea.querySelector('#appIcon');
        const appHtmlFileInput = contentArea.querySelector('#appHtmlFile');
        const createAppBtn = contentArea.querySelector('#createAppBtn');

        createAppBtn.onclick = async () => {
            const appName = appNameInput.value.trim();
            const appHtmlFile = appHtmlFileInput.files[0];
            const customAppIcon = appIconInput.value.trim();

            if (!appName || !appHtmlFile) {
                showInAppAlert("Please provide an app name and upload an HTML file.");
                return;
            }

            try {
                const appId = appName.toLowerCase().replace(/\s/g, '');
                const htmlContent = await appHtmlFile.text();
                const appIcon = customAppIcon || '📄'; // Default emoji icon

                const newAppConfig = {
                    appId: appId,
                    name: appName,
                    icon: appIcon,
                    // This 'launch' function is for the *newly created* custom HTML app
                    launch: () => {
                        WindowManager.createWindow(appId, {
                            title: appName,
                            width: 800,
                            height: 600,
                            content: `<iframe srcdoc="${escapeHtml(htmlContent)}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" style="width:100%; height:100%; border:none;"></iframe>`,
                            is: 'custom-html-app-window'
                        });
                    }
                };

                // Register and persist the app
                await AppRegistry.registerDynamicApp(appId, newAppConfig, htmlContent);
                WindowManager.closeWindow(windowId); // Close importer window after creation
            } catch (error) {
                console.error("Error creating app:", error);
                showInAppAlert("Failed to create app. See console for details.");
            }
        };
        return {}; // Return an empty object as the app instance
    }
};

// Helper function to escape HTML for srcdoc
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "") // Corrected as per user instruction
        .replace(/'/g, "&#039;");
}
