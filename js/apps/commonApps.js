import { FileSystemManager } from '../core/fileSystemManager.js';
import { getAppConfig, getIconForFileType } from '../core/utils.js';
import { WindowManager } from '../managers/windowManager.js'; // For closing properties dialog

import { AppRegistry } from './appRegistry.js'; // Import AppRegistry to launch fileExplorer

export const recycleBinAppConfig = {
    name:'Recycle Bin', icon:'🗑️', width:750, height:550, allowMultiple:false,
    launch: (windowId, contentArea, params) => {
        // Instead of rendering a dummy UI, launch the File Explorer app
        // with the initial path set to the Recycle Bin directory.
        // We need to ensure AppRegistry is imported for this.
        // Note: AppRegistry is imported at the top of commonApps.js
        // but we need to make sure it's not a circular dependency.
        // For now, assuming AppRegistry is available.
        AppRegistry.launchApp('fileExplorer', { initialPath: '/Recycle Bin/' });
        // Return a dummy appInstance, as the actual work is done by launching fileExplorer.
        // The WindowManager will handle closing this dummy window if it's not needed.
        return {}; 
    }
};

export const aboutAppConfig = {
    name:'About Web Desktop', icon:'💡', width:480, height:420, allowMultiple:false,
    launch: (windowId, contentArea) => {
        if(!contentArea) return null;
        contentArea.innerHTML = `
            <div style="padding:15px;">
                <h2 style="color:var(--accent-color); margin-bottom:10px;">Web Desktop Environment 0.01</h2>
                <p><strong>WebDEX</strong></p>
                <p style="margin-top:5px;">This version includes a persistent file system using IndexedDB,
                allowing File Explorer and Notepad to work with basic text files. Desktop icons can represent these files.
                A simple Web Browser application is also included.</p>
                <strong style="display:block; margin-top:15px; margin-bottom:5px;">Key Features:</strong>
                <ul style="margin-left:20px; list-style-type: disc;">
                    <li>Persistent File System (IndexedDB)</li>
                    <li>Functional File Explorer & Notepad (for .txt files)</li>
                    <li>Desktop File Icons (e.g., .txt files on Desktop)</li>
                    <li>Simple Web Browser App</li>
                    <li>Draggable & Resizable Windows with Edge Snapping</li>
                    <li>Taskbar with Running Apps & System Tray</li>
                    <li>Start Menu with Application Search</li>
                    <li>Context Menus (Desktop, Icons, File Explorer Items)</li>
                    <li>Theming (Light/Dark) & Customizable Wallpapers</li>
                    <li>Other Apps: Image Viewer, Calculator, Settings</li>
                </ul>
            </div>`;
        return {}; // Return a dummy appInstance
    }
};

export const errorAppConfig = {
    name:'App Error', icon:'⚠️', width:400, height:200, allowMultiple:true,
    launch: (windowId, contentArea, params) => {
        if(!contentArea) return null; // Should not happen for error app, but good practice
        const erroredAppId = params && params.erroredAppId ? params.erroredAppId : 'unknown';
        contentArea.innerHTML = `
            <div style="padding:20px;">
                <h2 style="color:#d9534f;margin-bottom:10px;">⚠️ App Error</h2>
                <p>The application "<strong>${erroredAppId}</strong>" could not be launched.</p>
                <p>This might be due to a configuration issue or an internal error.</p>
            </div>`;
        return {}; // CRITICAL: Return a dummy appInstance to break the loop
    }
};

export const propertiesDialogAppConfig = {
    name:'Properties', icon:'ℹ️', width:380, height:320, allowMultiple:false, isModal:true, autoFocusContent:false,
    launch: async (windowId, contentArea, params) => {
        if(!contentArea) return null;
        let name = params.targetId || "N/A";
        let type = params.targetType || "Unknown";
        let icon = "ℹ️"; // Default icon for properties dialog
        let location = "N/A";
        let size = "N/A";
        let created = "N/A";
        let modified = "N/A";
        let filePath = params.filePath;

        if (type === 'app' && params.appId) { 
            const appConfig = getAppConfig(params.appId); 
            name = appConfig.name;
            icon = appConfig.icon; // Icon of the app being propertied
            type = "Application Shortcut";
            location = "Desktop"; 
        } else if (filePath && (type === 'file' || type === 'folder')) { 
            try {
                const item = await FileSystemManager.getItem(filePath);
                if (item) {
                    name = item.name;
                    type = item.type.charAt(0).toUpperCase() + item.type.slice(1);
                    icon = item.type === 'folder' ? '📁' : getIconForFileType(item.name); // Icon of the file/folder
                    location = FileSystemManager._getPathInfo(item.path).parentPath || "/";
                    created = new Date(item.created).toLocaleString();
                    modified = new Date(item.modified).toLocaleString();
                    if (item.type === 'file' && item.size !== undefined) {
                        size = `${item.size} bytes`;
                    }
                } else {
                    name = "Error: Item not found";
                    type = "Unknown";
                }
            } catch (err) {
                console.error("PropertiesDialog: Error fetching item properties:", err);
                name = "Error loading properties";
                type = "Unknown";
            }
        }

        const winEl = contentArea.closest('.app-window');
        if (winEl) { 
            const titleSpan = winEl.querySelector('.title-bar .title');
            if (titleSpan) titleSpan.textContent = `${name} Properties`; // Set window title
            const iconSpanTitleBar = winEl.querySelector('.title-bar .app-icon'); // Update window icon
            if (iconSpanTitleBar) iconSpanTitleBar.innerHTML = propertiesDialogAppConfig.icon; // Use properties dialog's own icon for title bar
        }

        contentArea.innerHTML = `
            <div class="properties-dialog-content">
                <div id="properties-header-${windowId}" style="display:flex; align-items:center; margin-bottom:15px;">
                    <span id="properties-icon-${windowId}" style="font-size:2rem; margin-right:10px;">${icon}</span>
                    <strong id="properties-name-${windowId}" style="font-size:1.1rem;">${name}</strong>
                </div>
                <hr style="margin-bottom:10px;">
                <p><strong>Type:</strong> <span id="properties-type-${windowId}">${type}</span></p>
                <p><strong>Location:</strong> <span id="properties-location-${windowId}">${location}</span></p>
                ${size !== "N/A" ? `<p><strong>Size:</strong> <span id="properties-size-${windowId}">${size}</span></p>` : ''}
                <p><strong>Created:</strong> <span id="properties-created-${windowId}">${created}</span></p>
                <p><strong>Modified:</strong> <span id="properties-modified-${windowId}">${modified}</span></p>
                <hr style="margin: 15px 0 10px 0;">
                <div style="text-align:right;">
                    <button id="props-ok-${params.targetId ? params.targetId.replace(/[^a-zA-Z0-9]/g,'') : 'generic'}" class="properties-ok-button">OK</button>
                </div>
            </div>`;
        // Note: Content is set directly with values now, no need for querySelector to populate them again unless they are dynamic after this point.

        const okButton = contentArea.querySelector('.properties-ok-button');
        if (okButton && winEl) {
            okButton.onclick = () => WindowManager.closeWindow(winEl.id);
            setTimeout(() => okButton.focus(), 50);
        }
        return {}; // Return a dummy appInstance
    }
};
