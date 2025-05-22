import { state } from '../core/state.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { getIconForFileType, getFileExtension } from '../core/utils.js';
import { ContextMenu } from '../managers/contextMenu.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from './appRegistry.js'; // For launching apps for files

export const FileExplorerApp = { // Exporting the object directly for ContextMenu to use
    handleItemAction: (windowId, itemName, itemType, action, itemPath) => {
        SoundPlayer.playSound('click');
        if (action === 'open') {
            const feWindowData = state.openWindows[windowId];
            if (feWindowData && feWindowData.appInstance && typeof feWindowData.appInstance.refresh === 'function') {
                if (itemType === 'folder') {
                    feWindowData.appInstance.refresh(itemPath); // Navigate to new path
                } else { // It's a file
                    if (getFileExtension(itemName) === 'txt') {
                        AppRegistry.launchApp('notepad', { filePath: itemPath });
                    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(getFileExtension(itemName))) {
                        AppRegistry.launchApp('imageViewer', { initialUrl: `file://${itemPath}` });
                    }
                    else {
                        alert(`Opening file: "${itemName}" (Generic file open for this type is not fully implemented yet)`);
                    }
                }
            }
        }
    }
};

export const fileExplorerAppConfig = {
    name: 'File Explorer', icon: '📁', width: 750, height: 550, allowMultiple: true, autoFocusContent: false,
    launch: (windowId, contentArea, params) => {
        if (!contentArea) { console.error("FE: Content area not found for", windowId); return; }
        contentArea.classList.add('file-explorer-app-content');
        // contentArea.id = `file-explorer-content-${windowId}`; // For specific styling

        let currentExplorerPath = params.initialPath ? params.initialPath : '/';
        if (currentExplorerPath !== '/' && !currentExplorerPath.endsWith('/')) currentExplorerPath += '/';

        contentArea.innerHTML = `
            <div class="fe-path-bar">
                <button id="fe-back-${windowId}" title="Back (Not Implemented)" aria-label="Go back" disabled>⬅️</button>
                <button id="fe-up-${windowId}" title="Up one level" aria-label="Go up one level">⬆️</button>
                <input type="text" id="fe-path-input-${windowId}" readonly aria-label="Current path" value="${currentExplorerPath}">
            </div>
            <div class="fe-item-grid" id="fe-grid-${windowId}" tabindex="-1"></div>`;

        const pathInput = contentArea.querySelector(`#fe-path-input-${windowId}`);
        const gridContainer = contentArea.querySelector(`#fe-grid-${windowId}`);
        const upButton = contentArea.querySelector(`#fe-up-${windowId}`);

        const renderPath = async (pathToRender) => {
            // console.log(`FE: Rendering path: ${pathToRender}`); // Dev Log
            pathInput.value = pathToRender;
            gridContainer.innerHTML = '<p style="padding:15px;opacity:0.7;text-align:center;">Loading...</p>';
            try {
                const items = await FileSystemManager.listDirectory(pathToRender);
                // console.log(`FE: Items for ${pathToRender}:`, items); // Dev Log
                gridContainer.innerHTML = ''; // Clear loading message

                if (!items || items.length === 0) {
                    gridContainer.innerHTML = `<p style="padding:15px;opacity:0.7;text-align:center;">This folder is empty.</p>`;
                } else {
                    items.sort((a, b) => { // Sort folders first, then by name
                        if (a.type === 'folder' && b.type !== 'folder') return -1;
                        if (a.type !== 'folder' && b.type === 'folder') return 1;
                        return a.name.localeCompare(b.name);
                    }).forEach(item => {
                        const itemElement = document.createElement('div');
                        itemElement.className = 'fe-item';
                        itemElement.title = item.name;
                        itemElement.tabIndex = 0;
                        itemElement.dataset.itemName = item.name;
                        itemElement.dataset.itemType = item.type;
                        itemElement.dataset.itemPath = item.path; // Full path
                        const itemIcon = item.type === 'folder' ? '📁' : getIconForFileType(item.name);
                        itemElement.innerHTML = `<span class="icon">${itemIcon}</span><span class="name">${item.name}</span>`;

                        itemElement.addEventListener('dblclick', () => FileExplorerApp.handleItemAction(windowId, item.name, item.type, 'open', item.path));
                        itemElement.addEventListener('keydown', e => {
                            if (e.key === 'Enter') { e.preventDefault(); FileExplorerApp.handleItemAction(windowId, item.name, item.type, 'open', item.path); }
                        });
                        itemElement.addEventListener('contextmenu', e => ContextMenu.showForFileExplorerItem(e, item.name, item.type, item.path, windowId));
                        gridContainer.appendChild(itemElement);
                    });
                }
            } catch (err) {
                console.error(`FE: Error listing directory '${pathToRender}':`, err);
                gridContainer.innerHTML = `<p style="padding:15px;color:red;text-align:center;">Error loading folder content. Check console.</p>`;
            }
            upButton.disabled = (pathToRender === '/');
        };

        upButton.onclick = () => {
            if (currentExplorerPath === '/') return;
            let parentInfo = FileSystemManager._getPathInfo(currentExplorerPath);
            currentExplorerPath = parentInfo.parentPath;
            if (!currentExplorerPath) currentExplorerPath = '/'; // Should always resolve to /
            renderPath(currentExplorerPath);
        };

        renderPath(currentExplorerPath); // Initial render

        const win = state.openWindows[windowId];
        if (win) {
            win.appInstance = {
                refresh: (newPath) => { // Method to refresh or navigate the explorer
                    currentExplorerPath = newPath || currentExplorerPath; // Use newPath if provided
                    if (currentExplorerPath !== '/' && !currentExplorerPath.endsWith('/')) {
                        currentExplorerPath += '/';
                    }
                    renderPath(currentExplorerPath);
                }
            };
        }
    }
};