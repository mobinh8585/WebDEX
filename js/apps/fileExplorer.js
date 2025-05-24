import { state } from '../core/state.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { getIconForFileType, getFileExtension, sanitizeFilename } from '../core/utils.js';
import { ContextMenu } from '../managers/contextMenu.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from './appRegistry.js';
import { DesktopManager } from '../managers/desktopManager.js';
import { NotificationManager } from '../managers/notificationManager.js'; // Added for consistency

export const FileExplorerApp = {
    handleItemAction: (windowId, itemName, itemType, action, itemPath) => {
        SoundPlayer.playSound('click');
        const feWindowData = state.openWindows[windowId];
        if (!feWindowData) {
            console.error('FE: Window data not found for windowId:', windowId);
            return;
        }

        if (action === 'open') {
            if (itemType === 'folder') {
                const newPath = itemPath.endsWith('/') ? itemPath : `${itemPath}/`;
                if (feWindowData.appInstance && typeof feWindowData.appInstance.refresh === 'function') {
                    feWindowData.appInstance.refresh(newPath);
                } else {
                    console.error('FE: appInstance.refresh is not a function or appInstance is missing. AppInstance:', feWindowData.appInstance);
                }
            } else { // It's a file
                const fileExtension = getFileExtension(itemName).toLowerCase();
                const textFileExtensions = ['txt', 'js', 'css', 'html', 'json', 'md', 'xml', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rb', 'sh', 'sql', 'yaml', 'yml', 'ts'];
                const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

                if (imageExtensions.includes(fileExtension)) {
                    AppRegistry.launchApp('imageViewer', { filePath: itemPath });
                } else if (textFileExtensions.includes(fileExtension)) {
                    AppRegistry.launchApp('notepad', { filePath: itemPath });
                } else {
                    NotificationManager.show('Open File', `Opening "${itemName}" (Handler for this type is not fully implemented).`, { type: 'info' });
                }
            }
        }
    },

    startRenameInline: (windowId, currentName, filePath) => {
        const itemElement = document.querySelector(`#fe-grid-${windowId} .fe-item[data-path="${filePath}"]`);
        if (!itemElement) return;

        const labelSpan = itemElement.querySelector('.fe-item-label');
        if (!labelSpan) return;

        labelSpan.dataset.originalName = currentName;
        labelSpan.dataset.filePath = filePath;
        labelSpan.dataset.windowId = windowId; // Store windowId for context

        labelSpan.contentEditable = 'true';
        labelSpan.focus();
        document.execCommand('selectAll', false, null);

        const handleBlur = async () => {
            labelSpan.contentEditable = 'false';
            labelSpan.removeEventListener('blur', handleBlur);
            labelSpan.removeEventListener('keydown', handleKeyDown);
            await FileExplorerApp._saveRename(labelSpan);
        };

        const handleKeyDown = async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                labelSpan.blur(); // Triggers blur, which handles save
            } else if (e.key === 'Escape') {
                e.preventDefault();
                labelSpan.textContent = labelSpan.dataset.originalName;
                labelSpan.contentEditable = 'false';
                labelSpan.removeEventListener('blur', handleBlur);
                labelSpan.removeEventListener('keydown', handleKeyDown);
                itemElement.focus(); // Return focus to the item
            }
        };

        labelSpan.addEventListener('blur', handleBlur);
        labelSpan.addEventListener('keydown', handleKeyDown);
    },

    _saveRename: async (labelSpan) => {
        const newName = labelSpan.textContent.trim();
        const originalName = labelSpan.dataset.originalName;
        const originalFilePath = labelSpan.dataset.filePath;
        // const windowId = labelSpan.dataset.windowId; // Not directly needed for FSM op

        const itemElement = labelSpan.closest('.fe-item');
        if (!itemElement) return;
        const itemType = itemElement.dataset.type; // Get type from the item element

        if (newName === '' || newName === originalName) {
            labelSpan.textContent = originalName;
            return;
        }

        const sanitizedNewName = sanitizeFilename(newName);
        if (sanitizedNewName !== newName) {
            NotificationManager.show('Rename Info', `Invalid characters in name. Renamed to: "${sanitizedNewName}"`, { type: 'info' });
            labelSpan.textContent = sanitizedNewName;
        }

        try {
            const { parentPath } = FileSystemManager._getPathInfo(originalFilePath);
            let newPath = `${parentPath}${sanitizedNewName}`;
            if (itemType === 'folder' && !newPath.endsWith('/')) {
                newPath += '/';
            }

            const existing = await FileSystemManager.getItem(newPath);
            if (existing && existing.path !== originalFilePath) {
                NotificationManager.show('Rename Error', `An item named "${sanitizedNewName}" already exists.`, { type: 'error' });
                labelSpan.textContent = originalName;
                return;
            }

            await FileSystemManager.renameItem(originalFilePath, newPath);
            SoundPlayer.playSound('click');

            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function') {
                    win.appInstance.refresh(); // Refresh using its current path
                }
            });
            if (originalFilePath.startsWith('/Desktop/') || newPath.startsWith('/Desktop/')) {
                await DesktopManager.renderIcons();
            }
            NotificationManager.show('Renamed', `"${originalName}" renamed to "${sanitizedNewName}".`, { type: 'success' });

        } catch (err) {
            console.error("FE: Error saving inline rename:", err);
            NotificationManager.show('Rename Error', `Failed to rename item: ${err.message}`, { type: 'error' });
            labelSpan.textContent = originalName;
        }
    },
    handleFeDragStart: (event, filePath, itemType) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({ filePath, itemType, source: 'fileExplorer' }));
        event.dataTransfer.effectAllowed = 'move';
        const targetItem = event.target.closest('.fe-item');
        if (targetItem) targetItem.classList.add('dragging');
        SoundPlayer.playSound('click');
    },
    handleFeDragOver: (event) => {
        event.preventDefault(); 
        const targetElement = event.target.closest('.fe-item');
        const isFolder = targetElement && targetElement.dataset.type === 'folder';
        const isGrid = event.target.classList.contains('fe-item-grid');

        if (isFolder || isGrid) {
            event.dataTransfer.dropEffect = 'move'; 
            if (isFolder) targetElement.classList.add('drag-over');
            else if (isGrid) event.target.classList.add('drag-over'); // Add class to grid for visual feedback
        } else {
            event.dataTransfer.dropEffect = 'none';
        }
    },
    handleFeDragLeave: (event) => {
        const targetElement = event.target.closest('.fe-item');
        if (targetElement && targetElement.dataset.type === 'folder') {
            targetElement.classList.remove('drag-over');
        } else if (event.target.classList.contains('fe-item-grid')) {
            event.target.classList.remove('drag-over'); // Remove class from grid
        }
    },
    handleFeDrop: async (event, windowId) => {
        event.preventDefault();
        const targetElement = event.target.closest('.fe-item');
        const isFolderTarget = targetElement && targetElement.dataset.type === 'folder';
        const isGridTarget = event.target.classList.contains('fe-item-grid');

        if (targetElement && isFolderTarget) targetElement.classList.remove('drag-over');
        else if (isGridTarget) event.target.classList.remove('drag-over');
        
        // Remove 'dragging' class from any item being dragged from FE
        document.querySelectorAll('.fe-item.dragging').forEach(el => el.classList.remove('dragging'));


        if (!isFolderTarget && !isGridTarget) return; // Not a valid drop target

        try {
            const dataString = event.dataTransfer.getData('text/plain');
            if (!dataString) {
                console.warn("FE: Drop event missing dataTransfer data."); return;
            }
            const data = JSON.parse(dataString);
            const { filePath: sourcePath, itemType: sourceItemType, source } = data;

            if (!sourcePath || !sourceItemType) {
                console.warn("FE: Drop event missing filePath or itemType.", data); return;
            }

            let destinationDir; // This will be the directory path (ending with '/')
            const feWindowData = state.openWindows[windowId];

            if (isFolderTarget) { // Dropped ON a folder item
                destinationDir = targetElement.dataset.path; // path of the target folder
                if (!destinationDir.endsWith('/')) destinationDir += '/';
            } else if (isGridTarget) { // Dropped ON the grid background
                if (feWindowData && feWindowData.appInstance && typeof feWindowData.appInstance.getCurrentPath === 'function') {
                    destinationDir = feWindowData.appInstance.getCurrentPath();
                } else {
                    console.error("FE: Could not determine destination path for drop on grid."); return;
                }
            } else { return; } // Should not happen due to initial check


            const { name: itemName } = FileSystemManager._getPathInfo(sourcePath);
            let newPath = `${destinationDir}${itemName}`; // Full path for the new item
            if (sourceItemType === 'folder' && !newPath.endsWith('/')) {
                newPath += '/';
            }

            // Prevent moving/dropping into itself or to the same location
            if (sourcePath === newPath || (sourceItemType === 'folder' && newPath.startsWith(sourcePath))) {
                 console.log("FE: Item dropped in same location or into itself, no move needed.");
                 return;
            }


            const existing = await FileSystemManager.getItem(newPath);
            if (existing && existing.path !== sourcePath) { // Ensure it's not just the item itself if paths are subtly different
                if (!(await showInAppConfirm(`An item named "${itemName}" already exists in this location. Overwrite?`))) {
                    return;
                }
                await FileSystemManager.deleteItem(newPath);
            }
            
            await FileSystemManager.renameItem(sourcePath, newPath); // renameItem acts as move
            SoundPlayer.playSound('click');
            NotificationManager.show('Move Success', `Moved "${itemName}" to "${destinationDir}".`, { type: 'success' });


            // Refresh all affected File Explorer windows and Desktop
            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function') {
                    win.appInstance.refresh();
                }
            });
            // If source or destination involves Desktop, refresh desktop icons
            if (sourcePath.startsWith('/Desktop/') || destinationDir.startsWith('/Desktop/')) {
                 await DesktopManager.renderIcons();
            }


        } catch (error) {
            console.error("FE: Error handling drop:", error);
            NotificationManager.show('Move Error', `Failed to move item: ${error.message}`, { type: 'error' });
        }
    }
};

export const fileExplorerAppConfig = {
    name: 'File Explorer', icon: '📁', width: 750, height: 550, allowMultiple: true, autoFocusContent: false,
    launch: (windowId, contentArea, params) => {
        if (!contentArea) { console.error("FE: Content area not found for", windowId); return null; }
        contentArea.classList.add('file-explorer-app-content');

        const initialPath = (params && params.initialPath) || '/';
        // WindowManager ensures state.openWindows[windowId] and appState exist.
        // We just need to set the currentPath in appState.
        if (state.openWindows[windowId] && state.openWindows[windowId].appState) {
             state.openWindows[windowId].appState.currentPath = initialPath.endsWith('/') ? initialPath : `${initialPath}/`;
        } else {
            // Fallback if WindowManager didn't initialize appState (shouldn't happen)
            state.openWindows[windowId] = state.openWindows[windowId] || {}; // Ensure window entry exists
            state.openWindows[windowId].appState = {
                currentPath: initialPath.endsWith('/') ? initialPath : `${initialPath}/`
            };
        }
        
        const currentPathForLaunch = state.openWindows[windowId].appState.currentPath;

        contentArea.innerHTML = `
            <div class="fe-path-bar">
                <button id="fe-back-${windowId}" title="Back" aria-label="Go back">⬅️</button>
                <input type="text" id="fe-path-input-${windowId}" readonly aria-label="Current path" value="${currentPathForLaunch}">
            </div>
            <div class="fe-item-grid" id="fe-grid-${windowId}" tabindex="-1"></div>`;

        const pathInput = contentArea.querySelector(`#fe-path-input-${windowId}`);
        const gridContainer = contentArea.querySelector(`#fe-grid-${windowId}`);
        const backButton = contentArea.querySelector(`#fe-back-${windowId}`);

        const renderPath = async (pathToRender) => {
            const currentWin = state.openWindows[windowId];
            if (!currentWin || !currentWin.appState) {
                console.error("FE: Window or appState not found for", windowId, "during renderPath.");
                gridContainer.innerHTML = `<p style="color:red;padding:15px;">Error: Window state missing.</p>`;
                return;
            }
            currentWin.appState.currentPath = pathToRender.endsWith('/') ? pathToRender : `${pathToRender}/`; // Ensure trailing slash for dirs
            pathInput.value = currentWin.appState.currentPath;
            gridContainer.innerHTML = '<p style="padding:15px;opacity:0.7;text-align:center;">Loading...</p>';
            try {
                const items = await FileSystemManager.listDirectory(currentWin.appState.currentPath);
                gridContainer.innerHTML = ''; 

                if (!items || items.length === 0) {
                    gridContainer.innerHTML = '<p style="padding:15px;opacity:0.7;text-align:center;">This folder is empty.</p>';
                } else {
                    items.sort((a, b) => {
                        if (a.type === 'folder' && b.type !== 'folder') return -1;
                        if (a.type !== 'folder' && b.type === 'folder') return 1;
                        return a.name.localeCompare(b.name);
                    }).forEach(item => {
                        const itemElement = document.createElement('div');
                        itemElement.className = 'fe-item';
                        itemElement.draggable = true;
                        itemElement.setAttribute('data-path', item.path);
                        itemElement.setAttribute('data-type', item.type);
                        itemElement.setAttribute('data-name', item.name); // Used for context menu and actions
                        itemElement.tabIndex = 0; // For keyboard navigation

                        const iconSpan = document.createElement('span');
                        iconSpan.className = 'fe-item-icon icon'; // Ensure .icon class for styling
                        iconSpan.textContent = getIconForFileType(item.name, item.type);
                        
                        const labelSpan = document.createElement('span');
                        labelSpan.className = 'fe-item-label name'; // Ensure .name class for styling
                        labelSpan.textContent = item.name;
                        
                        itemElement.appendChild(iconSpan);
                        itemElement.appendChild(labelSpan);
                        
                        itemElement.addEventListener('dblclick', () => {
                            FileExplorerApp.handleItemAction(windowId, item.name, item.type, 'open', item.path);
                        });
                        
                        itemElement.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            ContextMenu.showForFileExplorerItem(e, item.name, item.type, item.path, windowId.replace('window-',''));
                        });
                        
                        itemElement.addEventListener('dragstart', (e) => FileExplorerApp.handleFeDragStart(e, item.path, item.type));
                        // Drag over/leave/drop for folder targets
                        if (item.type === 'folder') {
                            itemElement.addEventListener('dragover', FileExplorerApp.handleFeDragOver);
                            itemElement.addEventListener('dragleave', FileExplorerApp.handleFeDragLeave);
                            itemElement.addEventListener('drop', (e) => FileExplorerApp.handleFeDrop(e, windowId));
                        }
                        
                        gridContainer.appendChild(itemElement);
                    });
                }
            } catch (error) {
                console.error('FE: Error rendering path:', error);
                gridContainer.innerHTML = `<p style="color:red;padding:15px;">Error loading directory: ${error.message}</p>`;
            }
        };
        
        const appInstance = {
            refresh: async (newPathToRender) => {
                const currentWin = state.openWindows[windowId];
                 if (!currentWin || !currentWin.appState) {
                     console.warn("FE Refresh: appState not found for window", windowId);
                     return;
                 }
                const path = newPathToRender || currentWin.appState.currentPath;
                await renderPath(path);
            },
            getCurrentPath: () => {
                const currentWin = state.openWindows[windowId];
                return (currentWin && currentWin.appState) ? currentWin.appState.currentPath : '/';
            }
        };
        
        backButton.onclick = async () => {
            let currentPath = appInstance.getCurrentPath();
            if (currentPath === '/') return;
            let parentInfo = FileSystemManager._getPathInfo(currentPath);
            let newParentPath = parentInfo.parentPath;
            if (!newParentPath || newParentPath === currentPath) newParentPath = '/'; // Go to root if parent is same or null
            await appInstance.refresh(newParentPath);
        };

        // Drag and drop listeners for the grid container itself (for dropping into current folder)
        gridContainer.addEventListener('dragover', FileExplorerApp.handleFeDragOver);
        gridContainer.addEventListener('dragleave', FileExplorerApp.handleFeDragLeave);
        gridContainer.addEventListener('drop', (e) => FileExplorerApp.handleFeDrop(e, windowId));
        
        // Context menu for FE background
        gridContainer.addEventListener('contextmenu', (e) => {
            if (e.target === gridContainer) { // Ensure click is on background, not an item
                e.preventDefault();
                e.stopPropagation();
                const currentPath = appInstance.getCurrentPath();
                ContextMenu.showForFileExplorerBackground(e, currentPath, windowId.replace('window-',''));
            }
        });


        appInstance.refresh(currentPathForLaunch); // Initial render
        
        return appInstance; // Return the appInstance for WindowManager
    }
};
