import { FileSystemManager } from '../core/fileSystemManager.js';
import { getAppConfig, getIconForFileType } from '../core/utils.js';
import { WindowManager } from '../managers/windowManager.js'; // For closing properties dialog

export const recycleBinAppConfig = {
    name:'Recycle Bin', icon:'🗑️', width:400, height:300, allowMultiple:false,
    launch: (windowId, contentArea) => {
        if(!contentArea) return;
        contentArea.innerHTML = `
            <div style="padding:20px;text-align:center;">
                <h2>Recycle Bin</h2>
                <p>This is a dummy Recycle Bin.</p>
                <p style="font-size:3rem;margin-top:20px;">🗑️</p>
                <p style="margin-top:20px;font-style:italic;">(Functionality not implemented)</p>
            </div>`;
    }
};

export const aboutAppConfig = {
    name:'About Web Desktop', icon:'💡', width:480, height:420, allowMultiple:false,
    launch: (windowId, contentArea) => {
        if(!contentArea) return;
        contentArea.innerHTML = `
            <div style="padding:15px;">
                <h2 style="color:var(--accent-color); margin-bottom:10px;">Web Desktop Environment 5.0.2</h2>
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
    }
};

export const errorAppConfig = {
    name:'App Error', icon:'⚠️', width:400, height:200, allowMultiple:true,
    launch: (windowId, contentArea, params) => {
        if(!contentArea) return;
        const erroredAppId = params && params.erroredAppId ? params.erroredAppId : 'unknown';
        contentArea.innerHTML = `
            <div style="padding:20px;">
                <h2 style="color:#d9534f;margin-bottom:10px;">⚠️ App Error</h2>
                <p>The application "<strong>${erroredAppId}</strong>" could not be launched.</p>
                <p>This might be due to a configuration issue or an internal error.</p>
            </div>`;
    }
};

export const propertiesDialogAppConfig = {
    name:'Properties', icon:'ℹ️', width:380, height:320, allowMultiple:false, isModal:true, autoFocusContent:false,
    launch: async (windowId, contentArea, params) => {
        if(!contentArea) return;
        let name = params.targetId || "N/A";
        let type = params.targetType || "Unknown";
        let icon = "ℹ️";
        let location = "N/A";
        let size = "N/A";
        let created = "N/A";
        let modified = "N/A";
        let filePath = params.filePath;

        if (type === 'app' && params.appId) { // For app shortcuts on desktop
            const appConfig = getAppConfig(params.appId); // Use utility function
            name = appConfig.name;
            icon = appConfig.icon;
            type = "Application Shortcut";
            location = "Desktop"; // Or Start Menu if applicable
        } else if (filePath && (type === 'file' || type === 'folder')) { // For FSM items
            try {
                const item = await FileSystemManager.getItem(filePath);
                if (item) {
                    name = item.name;
                    type = item.type.charAt(0).toUpperCase() + item.type.slice(1);
                    icon = item.type === 'folder' ? '📁' : getIconForFileType(item.name);
                    location = FileSystemManager._getPathInfo(item.path).parentPath || "/";
                    created = new Date(item.created).toLocaleString();
                    modified = new Date(item.modified).toLocaleString();
                    if (item.type === 'file' && item.size !== undefined) {
                        size = `${item.size} bytes`;
                    }
                } else {
                    name = "Error: Item not found";
                }
            } catch (err) {
                console.error("PropertiesDialog: Error fetching item properties:", err);
                name = "Error loading properties";
            }
        }

        const winEl = contentArea.closest('.app-window');
        if (winEl) { // Update window title and icon
            const titleSpan = winEl.querySelector('.title-bar .title');
            if (titleSpan) titleSpan.textContent = `${name} Properties`;
            const iconSpan = winEl.querySelector('.title-bar .app-icon');
            if (iconSpan) iconSpan.innerHTML = icon;
        }

        contentArea.innerHTML = `
            <div class="properties-dialog-content">
                <div id="properties-header-${windowId}" style="display:flex; align-items:center; margin-bottom:15px;">
                    <span id="properties-icon-${windowId}" style="font-size:2rem; margin-right:10px;"></span>
                    <strong id="properties-name-${windowId}" style="font-size:1.1rem;"></strong>
                </div>
                <hr style="margin-bottom:10px;">
                <p><strong>Type:</strong> <span id="properties-type-${windowId}"></span></p>
                <p><strong>Location:</strong> <span id="properties-location-${windowId}"></span></p>
                ${size !== "N/A" ? `<p><strong>Size:</strong> <span id="properties-size-${windowId}"></span></p>` : ''}
                <p><strong>Created:</strong> <span id="properties-created-${windowId}"></span></p>
                <p><strong>Modified:</strong> <span id="properties-modified-${windowId}"></span></p>
                <hr style="margin: 15px 0 10px 0;">
                <div style="text-align:right;">
                    <button id="props-ok-${params.targetId ? params.targetId.replace(/[^a-zA-Z0-9]/g,'') : 'generic'}" class="properties-ok-button">OK</button>
                </div>
            </div>`;

        // Now populate dynamic parts safely
        const iconSpan = contentArea.querySelector(`#properties-icon-${windowId}`);
        const nameStrong = contentArea.querySelector(`#properties-name-${windowId}`);
        const typeSpan = contentArea.querySelector(`#properties-type-${windowId}`);
        const locationSpan = contentArea.querySelector(`#properties-location-${windowId}`);
        const createdSpan = contentArea.querySelector(`#properties-created-${windowId}`);
        const modifiedSpan = contentArea.querySelector(`#properties-modified-${windowId}`);

        if (iconSpan) iconSpan.innerHTML = icon; // Icon might be HTML (emoji or other simple HTML), ensure it's safe. If it's just text/emoji, textContent is safer. Given current usage of emojis, .innerHTML is likely fine for icon.
        if (nameStrong) nameStrong.textContent = name;
        if (typeSpan) typeSpan.textContent = type;
        if (locationSpan) locationSpan.textContent = location;
        if (createdSpan) createdSpan.textContent = created;
        if (modifiedSpan) modifiedSpan.textContent = modified;

        if (size !== "N/A") {
            const sizeSpan = contentArea.querySelector(`#properties-size-${windowId}`);
            if (sizeSpan) sizeSpan.textContent = size;
        }

        const okButton = contentArea.querySelector('.properties-ok-button');
        if (okButton && winEl) {
            okButton.onclick = () => WindowManager.closeWindow(winEl.id);
            setTimeout(() => okButton.focus(), 50); // Focus OK button
        }
    }
};