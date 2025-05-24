import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
import {
    CONTEXT_MENU_DESKTOP_CONFIG,
    CONTEXT_MENU_ICON_CONFIG,
    CONTEXT_MENU_FE_ITEM_CONFIG,
    CONTEXT_MENU_RECYCLE_BIN_BACKGROUND_CONFIG,
    CONTEXT_MENU_TEXT_INPUT_CONFIG
} from '../core/uiConfigs.js';
import { sanitizeFilename, getIconForFileType, getFileExtension, copyTextToClipboard, showInAppConfirm, showInAppPrompt } from '../core/utils.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from '../apps/appRegistry.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { DesktopManager } from './desktopManager.js';
import { ThemeManager } from '../core/themeManager.js';
import { FileExplorerApp } from '../apps/fileExplorer.js';
import { domElements } from '../main.js';
import { NotificationManager } from './notificationManager.js';


export const ContextMenu = {
    init: () => {
        if (!domElements.contextMenuElement) {
            console.error("FATAL: Context menu element missing!");
            return;
        }
        domElements.contextMenuElement.addEventListener('click', async (e) => {
            const listItem = e.target.closest('li[data-action]');
            if (listItem && !listItem.classList.contains('disabled')) {
                await ContextMenu._handleAction(listItem);
                ContextMenu.hide();
                e.stopPropagation();
            }
        });
        domElements.contextMenuElement.addEventListener('contextmenu', e => e.preventDefault());
    },

    _renderItems: (itemsConfig, dataContext = {}) => {
        if (!domElements.contextMenuElement) return;
        const ul = domElements.contextMenuElement.querySelector('ul') || document.createElement('ul');
        ul.innerHTML = ''; 

        dataContext.clipboardHasItems = state.clipboard && state.clipboard.items && state.clipboard.items.length > 0;

        itemsConfig.forEach(item => {
            if (item.type === 'separator') {
                ul.appendChild(document.createElement('hr'));
                return;
            }
            const li = document.createElement('li');
            li.dataset.action = item.action;

            // Standardize how data attributes are passed to the <li> for actions
            // Ensure dataset keys are lowercase as browsers convert them.
            for (const key in dataContext) {
                if (dataContext.hasOwnProperty(key) && dataContext[key] !== undefined && dataContext[key] !== null) {
                    // Convert common context keys to consistent lowercase dataset keys
                    let datasetKey = key.toLowerCase();
                    if (key === 'filePath') datasetKey = 'filepath';
                    else if (key === 'targetId' && (dataContext.context === 'desktop-icon' || dataContext.context === 'fe-item')) datasetKey = 'itemid'; // Store original ID if needed
                    else if (key === 'itemName' || (key === 'targetId' && dataContext.context === 'fe-item')) datasetKey = 'itemname';
                    else if (key === 'itemType' || key === 'iconType' || key === 'targetType') datasetKey = 'itemtype';
                    else if (key === 'windowId') datasetKey = 'windowid';
                    else if (key === 'appId') datasetKey = 'appid';
                    else if (key === 'targetElementId') datasetKey = 'targetelementid';
                    
                    li.dataset[datasetKey] = dataContext[key];
                }
            }
            // Ensure core data is present using standardized keys
            if(dataContext.filePath) li.dataset.filepath = dataContext.filePath;
            if(dataContext.itemName) li.dataset.itemname = dataContext.itemName;
            if(dataContext.itemType) li.dataset.itemtype = dataContext.itemType;
            if(dataContext.windowId) li.dataset.windowid = dataContext.windowId; // from FE context
            if(dataContext.appId) li.dataset.appid = dataContext.appId; // from Desktop app icon context
            if(dataContext.targetId) li.dataset.targetid = dataContext.targetId; // Original icon ID or FE item name
            // Ensure targetElementId is explicitly set for text input context
            if(dataContext.context === 'text-input' && dataContext.targetElementId) {
                li.dataset.targetelementid = dataContext.targetElementId;
            }


            let isDisabled = false;
            if (typeof item.disabled === 'function') {
                isDisabled = item.disabled(dataContext);
            } else if (item.disabled === true) {
                isDisabled = true;
            }
            // Explicitly disable paste if clipboard is empty
            if (item.action === 'paste-item' || item.action === 'fe-paste') {
                isDisabled = !dataContext.clipboardHasItems;
            }


            if (isDisabled) {
                li.classList.add('disabled');
                li.setAttribute('aria-disabled', 'true');
            } else {
                li.tabIndex = 0; 
                li.setAttribute('role', 'menuitem');
                li.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        await ContextMenu._handleAction(li);
                        ContextMenu.hide();
                    }
                });
            }

            li.innerHTML = `<span class="icon">${item.icon || ''}</span> ${item.label}`;
            ul.appendChild(li);
        });

        if (!domElements.contextMenuElement.contains(ul)) domElements.contextMenuElement.appendChild(ul);
        const firstItem = ul.querySelector('li[tabindex="0"]:not(.disabled)');
        if (firstItem) firstItem.focus();
    },
    
    _showAt: (x, y) => {
        if (!domElements.contextMenuElement) return;
        domElements.contextMenuElement.classList.add('visible');

        const menuWidth = domElements.contextMenuElement.offsetWidth;
        const menuHeight = domElements.contextMenuElement.offsetHeight;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 5;
        if (y + menuHeight > window.innerHeight - CONSTANTS.TASKBAR_HEIGHT) {
            y = window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - menuHeight - 5;
        }
        x = Math.max(5, x);
        y = Math.max(5, y);

        domElements.contextMenuElement.style.left = `${x}px`;
        domElements.contextMenuElement.style.top = `${y}px`;
    },

    showForDesktop: (event) => {
        ContextMenu._renderItems(CONTEXT_MENU_DESKTOP_CONFIG, { context: 'desktop' });
        ContextMenu._showAt(event.clientX, event.clientY);
    },

    showForIcon: (event, iconEl) => { // For Desktop Icons
        event.preventDefault();
        event.stopPropagation();
        const iconDataset = iconEl.dataset;
        const dataContext = {
            filePath: iconDataset.filePath, // data-file-path
            itemName: iconDataset.itemName, // data-item-name
            itemType: iconDataset.iconType, // data-icon-type
            appId: iconDataset.appId,       // data-app-id
            targetId: iconEl.id,            // The icon's actual DOM ID
            context: 'desktop-icon'
        };
        ContextMenu._renderItems(CONTEXT_MENU_ICON_CONFIG, dataContext);

        let x, y;
        if (event.pointerType === 'touch' || (event.clientX === 0 && event.clientY === 0)) {
            const rect = iconEl.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        } else {
            x = event.clientX;
            y = event.clientY;
        }
        ContextMenu._showAt(x, y);
    },

    showForFileExplorerItem: (event, itemName, itemType, itemPath, windowId) => { // For FE Items
        event.preventDefault();
        event.stopPropagation();
        
        const dataContext = {
            itemName: itemName,     // FE item name
            itemType: itemType,     // FE item type
            filePath: itemPath,     // FE item path
            windowId: windowId,     // Raw windowId number/string part
            context: 'fe-item'
        };

        let config;
        if (itemPath.startsWith('/Recycle Bin/')) {
            config = CONTEXT_MENU_FE_ITEM_CONFIG.recycledItem;
        } else if (itemType === 'folder') {
            config = CONTEXT_MENU_FE_ITEM_CONFIG.folder;
        } else {
            config = CONTEXT_MENU_FE_ITEM_CONFIG.file;
        }
        
        ContextMenu._renderItems(config, dataContext);
        ContextMenu._showAt(event.clientX, event.clientY);
    },
    
    showForTextInput: (event, targetElementId) => {
        event.preventDefault();
        event.stopPropagation();
        
        const dataContext = {
            targetElementId: targetElementId,
            context: 'text-input'
        };
        ContextMenu._renderItems(CONTEXT_MENU_TEXT_INPUT_CONFIG, dataContext);
        ContextMenu._showAt(event.clientX, event.clientY);
    },

    showForFileExplorerBackground: (event, currentPath, windowId) => {
        event.preventDefault();
        event.stopPropagation();
        
        const dataContext = {
            filePath: currentPath, 
            windowId: windowId,
            context: 'fe-background'
        };

        let config;
        if (currentPath === '/Recycle Bin/') {
            config = CONTEXT_MENU_RECYCLE_BIN_BACKGROUND_CONFIG;
        } else {
            config = [
                { label: 'New Text File', action: 'fe-new-text-file', icon: '📄+' },
                { label: 'New Folder', action: 'fe-new-folder', icon: '➕📁' },
                { type: 'separator' },
                { label: 'Paste', action: 'fe-paste', icon: '📋', disabled: (dataContext) => !dataContext.clipboardHasItems },
                { type: 'separator' },
                { label: 'Properties', action: 'fe-properties', icon: 'ℹ️' },
            ];
        }
        
        ContextMenu._renderItems(config, dataContext);
        ContextMenu._showAt(event.clientX, event.clientY);
    },


    hide: () => { 
        if (domElements.contextMenuElement) domElements.contextMenuElement.classList.remove('visible');
        clearTimeout(state.longPressTimer);
    },
    isVisible: () => { 
        return domElements.contextMenuElement && domElements.contextMenuElement.classList.contains('visible');
    },

    _handleAction: async (listItem) => {
        SoundPlayer.playSound('click');
        const action = listItem.dataset.action;
        // Dataset keys are auto-lowercased by browsers.
        // Standardize access to these dataset properties.
        const data = {
            action: action,
            filepath: listItem.dataset.filepath,
            itemname: listItem.dataset.itemname,
            itemtype: listItem.dataset.itemtype,
            windowid: listItem.dataset.windowid, // Might be undefined
            appid: listItem.dataset.appid,       // Might be undefined
            targetid: listItem.dataset.targetid, // Might be undefined (e.g. original icon ID)
            context: listItem.dataset.context, // Which context menu was it
            targetelementid: listItem.dataset.targetelementid // Add this line
        };

        switch (action) {
            case 'change-wallpaper':
            case 'display-settings':
                AppRegistry.launchApp('settings');
                break;
            case 'toggle-theme':
                ThemeManager.toggleTheme();
                break;
            case 'new-text-file': // Desktop context
                await ContextMenu._actionNewTextFile(data, '/Desktop/');
                break;
            case 'new-folder': // Desktop context
                await ContextMenu._actionNewFolder(data, '/Desktop/');
                break;
            case 'fe-new-text-file': // FE background context
                await ContextMenu._actionNewTextFile(data, data.filepath); // data.filepath is current FE dir
                break;
            case 'fe-new-folder': // FE background context
                await ContextMenu._actionNewFolder(data, data.filepath); // data.filepath is current FE dir
                break;    
            case 'open-item': // Desktop icon open
                ContextMenu._actionOpenItem(data);
                break;
            case 'delete-item': // Desktop icon delete
                await ContextMenu._actionDeleteItem(data);
                break;
            case 'fe-delete': // FE item delete (moves to recycle bin)
                await ContextMenu._actionDeleteItem(data);
                break;
            case 'fe-delete-permanently': // FE item delete (permanently)
                await ContextMenu._actionDeletePermanently(data);
                break;
            case 'fe-restore': // Restore item from recycle bin
                await ContextMenu._actionRestoreItem(data);
                break;
            case 'fe-empty-recycle-bin': // Empty recycle bin
                await ContextMenu._actionEmptyRecycleBin(data);
                break;
            case 'properties': // Desktop icon properties OR FE item/folder properties
            case 'fe-properties': 
                ContextMenu._actionProperties(data);
                break;
            case 'fe-open': // FE item open
                ContextMenu._actionFeOpen(data);
                break;
            case 'rename-item': // Desktop icon rename
                 // data.targetid here is the DOM ID of the icon
                DesktopManager.startRenameInline(data.targetid, data.itemname, data.filepath);
                break;
            case 'fe-rename': // FE item rename
                // data.windowid is the raw ID part, data.itemname is the name to rename, data.filepath is its path
                FileExplorerApp.startRenameInline(`window-${data.windowid}`, data.itemname, data.filepath);
                break;
            case 'copy-item': 
            case 'fe-copy':   
                await ContextMenu._actionCopyItem(data);
                break;
            case 'cut-item':  
            case 'fe-cut':    
                await ContextMenu._actionCutItem(data);
                break;
            case 'paste-item': 
            case 'fe-paste':   
                await ContextMenu._actionPasteItem(data);
                break;
            case 'text-cut':
                ContextMenu._actionTextCut(data);
                break;
            case 'text-copy':
                ContextMenu._actionTextCopy(data);
                break;
            case 'text-paste':
                ContextMenu._actionTextPaste(data);
                break;
            case 'text-select-all':
                ContextMenu._actionTextSelectAll(data);
                break;
            default:
                console.warn("ContextMenu: Unknown action:", action, data);
        }
    },
    _actionTextCut: (data) => {
        console.log("ContextMenu: _actionTextCut called with data:", data);
        const targetElement = document.getElementById(data.targetelementid);
        if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
            const start = targetElement.selectionStart;
            const end = targetElement.selectionEnd;
            const selectedText = targetElement.value.substring(start, end);
            console.log("ContextMenu: _actionTextCut - selectedText:", selectedText);
            if (selectedText) {
                copyTextToClipboard(selectedText);
                targetElement.value = targetElement.value.substring(0, start) + targetElement.value.substring(end);
                targetElement.selectionStart = targetElement.selectionEnd = start; // Keep cursor at the cut position
                NotificationManager.show('Clipboard', 'Text cut to clipboard.', { duration: 1500 });
            } else {
                NotificationManager.show('Clipboard', 'No text selected to cut.', { type: 'info', duration: 1500 });
            }
        } else {
            console.error("ContextMenu: _actionTextCut - targetElement not found or not a text input:", targetElement);
        }
    },
    _actionTextCopy: (data) => {
        console.log("ContextMenu: _actionTextCopy called with data:", data);
        const targetElement = document.getElementById(data.targetelementid);
        if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
            const selectedText = targetElement.value.substring(targetElement.selectionStart, targetElement.selectionEnd);
            console.log("ContextMenu: _actionTextCopy - selectedText:", selectedText);
            if (selectedText) {
                copyTextToClipboard(selectedText);
                NotificationManager.show('Clipboard', 'Text copied to clipboard.', { duration: 1500 });
            } else {
                NotificationManager.show('Clipboard', 'No text selected to copy.', { type: 'info', duration: 1500 });
            }
        } else {
            console.error("ContextMenu: _actionTextCopy - targetElement not found or not a text input:", targetElement);
        }
    },
    _actionTextPaste: async (data) => {
        console.log("ContextMenu: _actionTextPaste called with data:", data);
        const targetElement = document.getElementById(data.targetelementid);
        if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
            try {
                const text = await navigator.clipboard.readText();
                console.log("ContextMenu: _actionTextPaste - text from clipboard:", text);
                if (text) {
                    const start = targetElement.selectionStart;
                    const end = targetElement.selectionEnd;
                    targetElement.value = targetElement.value.substring(0, start) + text + targetElement.value.substring(end);
                    targetElement.selectionStart = targetElement.selectionEnd = start + text.length;
                    targetElement.focus();
                    NotificationManager.show('Clipboard', 'Text pasted.', { duration: 1500 });
                } else {
                    NotificationManager.show('Paste Info', 'Clipboard is empty or contains no text.', { type: 'info', duration: 1500 });
                }
            } catch (err) {
                console.error("ContextMenu: _actionTextPaste - Failed to read clipboard contents: ", err);
                NotificationManager.show('Paste Error', 'Failed to paste from clipboard. Ensure browser permissions are granted (e.g., by interacting with the page first).', { type: 'error' });
            }
        } else {
            console.error("ContextMenu: _actionTextPaste - targetElement not found or not a text input:", targetElement);
        }
    },
    _actionTextSelectAll: (data) => {
        console.log("ContextMenu: _actionTextSelectAll called with data:", data);
        const targetElement = document.getElementById(data.targetelementid);
        if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
            targetElement.select();
            NotificationManager.show('Selection', 'All text selected.', { duration: 1500 });
        } else {
            console.error("ContextMenu: _actionTextSelectAll - targetElement not found or not a text input:", targetElement);
        }
    },
    _actionNewTextFile: async (data, parentDir) => { // parentDir is where to create the file
        ContextMenu.hide(); // Hide context menu before showing prompt
        let newFileName = await showInAppPrompt("Enter name for new text file:", "New Text File.txt");
        if (newFileName) {
            newFileName = sanitizeFilename(newFileName);
            if (!newFileName.toLowerCase().endsWith('.txt')) newFileName += '.txt';
            
            const dir = parentDir.endsWith('/') ? parentDir : parentDir + '/';
            const newFilePath = `${dir}${newFileName}`;
            try {
                const existing = await FileSystemManager.getItem(newFilePath);
                if (existing) {
                    NotificationManager.show('Create Error', `File "${newFileName}" already exists in ${dir}.`, { type: 'error' });
                    return;
                }
                await FileSystemManager.createFile(newFilePath, "");
                if (dir === '/Desktop/') await DesktopManager.renderIcons();
                if (data.windowid) { // If action originated from FE window
                    const feWin = state.openWindows[`window-${data.windowid}`];
                    if (feWin && feWin.appInstance && typeof feWin.appInstance.refresh === 'function') {
                        feWin.appInstance.refresh(); // Refresh current FE view
                    }
                }
                 NotificationManager.show('Success', `Created ${newFileName}.`, { type: 'success' });
            } catch (err) {
                console.error("ContextMenu: Error creating new text file:", err);
                NotificationManager.show('Create Error', `Failed to create text file: ${err.message}`, { type: 'error' });
            }
        }
    },
    _actionNewFolder: async (data, parentDir) => {
        ContextMenu.hide(); // Hide context menu before showing prompt
        let newFolderName = await showInAppPrompt("Enter name for new folder:", "New Folder");
        if (newFolderName) {
            newFolderName = sanitizeFilename(newFolderName);
            const dir = parentDir.endsWith('/') ? parentDir : parentDir + '/';
            const newFolderPath = `${dir}${newFolderName}/`; // Folders end with /
            try {
                const existing = await FileSystemManager.getItem(newFolderPath);
                if (existing) {
                    NotificationManager.show('Create Error', `Folder "${newFolderName}" already exists in ${dir}.`, { type: 'error' });
                    return;
                }
                await FileSystemManager.createFolder(newFolderPath);
                if (dir === '/Desktop/') await DesktopManager.renderIcons();
                 if (data.windowid) { 
                    const feWin = state.openWindows[`window-${data.windowid}`];
                    if (feWin && feWin.appInstance && typeof feWin.appInstance.refresh === 'function') {
                        feWin.appInstance.refresh();
                    }
                }
                NotificationManager.show('Success', `Created folder ${newFolderName}.`, { type: 'success' });
            } catch (err) {
                console.error("ContextMenu: Error creating new folder:", err);
                NotificationManager.show('Create Error', `Failed to create folder: ${err.message}`, { type: 'error' });
            }
        }
    },
    _actionOpenItem: (data) => { // For Desktop Icons primarily
        const { itemtype, appid, filepath, itemname } = data;
        if (itemtype === 'app' && appid) {
            AppRegistry.launchApp(appid);
        } else if ((itemtype === 'file' || itemtype === 'folder') && filepath) {
            if (itemtype === 'folder') {
                 AppRegistry.launchApp('fileExplorer', { initialPath: filepath });
            } else { // File
                const ext = getFileExtension(itemname); // Use itemname for extension
                const textFileExtensions = ['txt', 'js', 'css', 'html', 'json', 'md', 'xml', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rb', 'sh', 'sql', 'yaml', 'yml', 'ts'];
                if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
                    AppRegistry.launchApp('imageViewer', { initialUrl: `file://${filepath}` });
                } else if (textFileExtensions.includes(ext)) {
                    AppRegistry.launchApp('notepad', { initialFilePath: filepath });
                } else {
                    NotificationManager.show('Open File', `Opening "${itemname}" (No specific app for this type).`, { type: 'info' });
                }
            }
        }
    },
    _actionDeleteItem: async (data) => {
        const { filepath, itemname, itemtype, windowid } = data;
        const nameToDelete = itemname || (filepath ? FileSystemManager._getPathInfo(filepath).name : "Unknown item");

        if (itemtype === 'app') { // Deleting app shortcuts from Desktop
            NotificationManager.show('Info', `Deleting app shortcuts from UI is not supported. App definitions are hardcoded.`, { type: 'info' });
            return;
        }

        if (!filepath) {
             NotificationManager.show('Delete Error', `Cannot delete: item path is missing.`, { type: 'error' });
             return;
        }

        ContextMenu.hide(); // Hide context menu before showing confirmation
        if (!(await showInAppConfirm(`Are you sure you want to move "${nameToDelete}" to the Recycle Bin?`))) return;

        try {
            await FileSystemManager.deleteItem(filepath); // This now moves to recycle bin
            NotificationManager.show('Moved to Recycle Bin', `"${nameToDelete}" was moved to the Recycle Bin.`, { type: 'success' });
            
            // Refresh Desktop if item was on Desktop
            if (filepath.startsWith('/Desktop/')) {
                await DesktopManager.renderIcons();
            }
            // Refresh relevant FE windows
            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function' && win.appInstance.getCurrentPath) {
                    const fePath = win.appInstance.getCurrentPath();
                    // Refresh if FE is showing the directory of the deleted item or its parent
                    if (FileSystemManager._getPathInfo(filepath).parentPath === fePath || filepath.startsWith(fePath) || fePath === '/Recycle Bin/') {
                         win.appInstance.refresh();
                    }
                }
            });
        } catch (err) {
            console.error("ContextMenu: Error deleting item:", err);
            NotificationManager.show('Delete Error', `Failed to move "${nameToDelete}" to Recycle Bin: ${err.message}`, { type: 'error' });
        }
    },

    _actionDeletePermanently: async (data) => {
        const { filepath, itemname, windowid } = data;
        const nameToDelete = itemname || (filepath ? FileSystemManager._getPathInfo(filepath).name : "Unknown item");

        if (!filepath) {
             NotificationManager.show('Delete Error', `Cannot delete: item path is missing.`, { type: 'error' });
             return;
        }

        ContextMenu.hide(); // Hide context menu before showing confirmation
        if (!(await showInAppConfirm(`Are you sure you want to PERMANENTLY delete "${nameToDelete}"? This action cannot be undone.`))) return;

        try {
            await FileSystemManager._permanentDeleteItem(filepath);
            NotificationManager.show('Permanently Deleted', `"${nameToDelete}" was permanently deleted.`, { type: 'success' });
            
            // Refresh Desktop if item was on Desktop (unlikely for permanent delete, but good to have)
            if (filepath.startsWith('/Desktop/')) {
                await DesktopManager.renderIcons();
            }
            // Refresh relevant FE windows, especially Recycle Bin
            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function' && win.appInstance.getCurrentPath) {
                    const fePath = win.appInstance.getCurrentPath();
                    if (fePath === '/Recycle Bin/' || FileSystemManager._getPathInfo(filepath).parentPath === fePath) {
                         win.appInstance.refresh();
                    }
                }
            });
        } catch (err) {
            console.error("ContextMenu: Error permanently deleting item:", err);
            NotificationManager.show('Delete Error', `Failed to permanently delete "${nameToDelete}": ${err.message}`, { type: 'error' });
        }
    },

    _actionRestoreItem: async (data) => {
        const { filepath, itemname, windowid } = data;
        const nameToRestore = itemname || (filepath ? FileSystemManager._getPathInfo(filepath).name : "Unknown item");

        if (!filepath) {
             NotificationManager.show('Restore Error', `Cannot restore: item path is missing.`, { type: 'error' });
             return;
        }

        try {
            const restoredItem = await FileSystemManager.restoreItem(filepath);
            NotificationManager.show('Restored', `"${nameToRestore}" was restored to "${restoredItem.parentPath}".`, { type: 'success' });
            
            // Refresh Desktop if item was restored to Desktop
            if (restoredItem.parentPath === '/Desktop/') {
                await DesktopManager.renderIcons();
            }
            // Refresh relevant FE windows, especially Recycle Bin and the destination folder
            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function' && win.appInstance.getCurrentPath) {
                    const fePath = win.appInstance.getCurrentPath();
                    if (fePath === '/Recycle Bin/' || fePath === restoredItem.parentPath) {
                         win.appInstance.refresh();
                    }
                }
            });
        } catch (err) {
            console.error("ContextMenu: Error restoring item:", err);
            NotificationManager.show('Restore Error', `Failed to restore "${nameToRestore}": ${err.message}`, { type: 'error' });
        }
    },

    _actionEmptyRecycleBin: async (data) => {
        ContextMenu.hide(); // Hide context menu before showing confirmation
        if (!(await showInAppConfirm("Are you sure you want to permanently delete ALL items in the Recycle Bin? This action cannot be undone."))) return;

        try {
            await FileSystemManager.emptyRecycleBin();
            NotificationManager.show('Recycle Bin Emptied', 'All items in the Recycle Bin have been permanently deleted.', { type: 'success' });
            
            // Refresh all FE windows that are currently showing the Recycle Bin
            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function' && win.appInstance.getCurrentPath) {
                    if (win.appInstance.getCurrentPath() === '/Recycle Bin/') {
                         win.appInstance.refresh();
                    }
                }
            });
        } catch (err) {
            console.error("ContextMenu: Error emptying recycle bin:", err);
            NotificationManager.show('Empty Recycle Bin Error', `Failed to empty Recycle Bin: ${err.message}`, { type: 'error' });
        }
    },

     _actionProperties: (data) => {
        const { itemname, itemtype, filepath, appid, windowid, context } = data;
        
        if (context === 'fe-background' && filepath && !itemname) { // Properties of the current FE folder itself
             AppRegistry.launchApp('propertiesDialog', {
                filePath: filepath, 
                targetType: 'folder', 
                targetId: FileSystemManager._getPathInfo(filepath).name || 'Current Folder',
                windowId: windowid ? `window-${windowid}` : undefined
            });
        } else { // Properties for a specific item (desktop or FE item)
            AppRegistry.launchApp('propertiesDialog', {
                targetId: itemname,
                targetType: itemtype,
                filePath: filepath,
                appId: appid, 
                windowId: windowid ? `window-${windowid}` : undefined
            });
        }
    },
    _actionFeOpen: (data) => { // For FE items
        const { windowid, itemname, itemtype, filepath } = data;
        if (windowid && itemname && itemtype && filepath && FileExplorerApp.handleItemAction) {
            FileExplorerApp.handleItemAction(`window-${windowid}`, itemname, itemtype, 'open', filepath);
        } else {
            console.error("FE Open: Missing data for action.", data);
            NotificationManager.show('Error', 'Could not open item: missing data.', { type: 'error' });
        }
    },

    _actionCopyItem: async (data) => {
        try {
            const { filepath, itemtype, itemname } = data;

            if (!filepath || !itemtype) {
                throw new Error("Item path or type is missing for copy operation.");
            }
            
            const item = await FileSystemManager.getItem(filepath);
            if (!item) {
                throw new Error(`Item at ${filepath} not found.`);
            }
            
            state.clipboard = {
                action: 'copy',
                items: [{
                    path: filepath,
                    name: itemname || item.name, 
                    type: itemtype // This is 'file' or 'folder'
                }]
            };
            SoundPlayer.playSound('click');
            NotificationManager.show('Clipboard', `"${itemname || item.name}" copied.`, { duration: 2000 });
            
        } catch (err) {
            console.error("Error in _actionCopyItem:", err);
            NotificationManager.show('Copy Error', `Failed to copy: ${err.message}`, { type: 'error' });
        }
    },

    _actionCutItem: async (data) => {
        try {
            const { filepath, itemtype, itemname } = data;

            if (!filepath || !itemtype) {
                throw new Error("Item path or type is missing for cut operation.");
            }
            
            const item = await FileSystemManager.getItem(filepath);
            if (!item) {
                throw new Error(`Item at ${filepath} not found.`);
            }
            
            state.clipboard = {
                action: 'cut',
                items: [{
                    path: filepath,
                    name: itemname || item.name,
                    type: itemtype // This is 'file' or 'folder'
                }]
            };
            SoundPlayer.playSound('click');
            NotificationManager.show('Clipboard', `"${itemname || item.name}" cut.`, { duration: 2000 });

        } catch (err) {
            console.error("Error in _actionCutItem:", err);
            NotificationManager.show('Cut Error', `Failed to cut: ${err.message}`, { type: 'error' });
        }
    },

    _actionPasteItem: async (data) => {
        try {
            const { windowid, filepath: contextFilePath, action: contextAction, context } = data;

            if (!state.clipboard || !state.clipboard.items || state.clipboard.items.length === 0) {
                NotificationManager.show('Paste Error', 'Clipboard is empty.', { type: 'warning' });
                return;
            }

            let destinationDir; // Should always end with a '/'

            if (context === 'desktop') { 
                destinationDir = '/Desktop/';
            } else if (context === 'fe-item' || context === 'fe-background') {
                const feContextPath = contextFilePath; // Path from dataset (item path or FE current dir)
                
                if (!feContextPath) {
                    NotificationManager.show('Paste Error', 'File Explorer paste context path is missing.', { type: 'error' });
                    return;
                }

                const targetItem = await FileSystemManager.getItem(feContextPath).catch(() => null);

                if (targetItem && targetItem.type === 'folder') { // Pasting ON a folder item OR in FE current dir if it's a folder
                    destinationDir = feContextPath.endsWith('/') ? feContextPath : `${feContextPath}/`;
                } else if (targetItem && targetItem.type === 'file') { // Pasting ON a file (paste in its parent)
                    destinationDir = FileSystemManager._getPathInfo(feContextPath).parentPath;
                } else if (!targetItem && feContextPath.endsWith('/')) { // Pasting on FE background (path is current dir, which should exist)
                     destinationDir = feContextPath;
                } else { // Path might be of a non-existent item if FE view is stale, or other ambiguous case
                    NotificationManager.show('Paste Error', 'Cannot determine File Explorer destination directory.', { type: 'error' });
                    return;
                }
            } else {
                NotificationManager.show('Paste Error', 'Unknown paste context.', { type: 'error' });
                return;
            }

            if (!destinationDir || !destinationDir.endsWith('/')) {
                NotificationManager.show('Paste Error', 'Invalid destination directory determined.', { type: 'error' });
                return;
            }

            let refreshDesktop = false;
            const feWindowsToRefresh = new Set(); // Store full window IDs (e.g., 'window-1')

            if (windowid) feWindowsToRefresh.add(`window-${windowid}`); // Current FE window if context is FE

            for (const clipItem of state.clipboard.items) {
                const sourcePath = clipItem.path;
                const itemName = clipItem.name || FileSystemManager._getPathInfo(sourcePath).name;
                let newPath = `${destinationDir}${itemName}`; // Full path for the new/moved item
                
                if (clipItem.type === 'folder' && !newPath.endsWith('/')) {
                    newPath += '/';
                }

                if (sourcePath === newPath || (clipItem.type === 'folder' && newPath.startsWith(sourcePath))) {
                    NotificationManager.show('Paste Info', `Cannot paste "${itemName}" into itself or its current location.`, { type: 'info' });
                    continue; 
                }

                const existing = await FileSystemManager.getItem(newPath).catch(() => null);
                if (existing) {
                    ContextMenu.hide(); // Hide context menu before showing confirmation
                    if (!(await showInAppConfirm(`An item named "${itemName}" already exists in "${destinationDir}". Overwrite?`))) {
                        continue; // Skip this item
                    }
                    await FileSystemManager.deleteItem(newPath);
                }
                
                let successMessage = "";
                if (state.clipboard.action === 'copy') {
                    await FileSystemManager.copyItem(sourcePath, newPath);
                    successMessage = `Copied "${itemName}" to "${destinationDir}"`;
                } else if (state.clipboard.action === 'cut') {
                    await FileSystemManager.renameItem(sourcePath, newPath);
                    successMessage = `Moved "${itemName}" to "${destinationDir}"`;
                    // For 'cut', also mark original location for refresh
                    const sourceParentDir = FileSystemManager._getPathInfo(sourcePath).parentPath;
                    if (sourceParentDir === '/Desktop/') refreshDesktop = true;
                    Object.values(state.openWindows).forEach(win => {
                        if (win.appId === 'fileExplorer' && win.appInstance && win.appInstance.getCurrentPath && win.appInstance.getCurrentPath() === sourceParentDir) {
                            feWindowsToRefresh.add(win.element.id);
                        }
                    });
                }
                NotificationManager.show('Paste Success', successMessage, { duration: 2500 });
            }

            if (state.clipboard.action === 'cut') {
                state.clipboard = { action: null, items: [] }; // Clear clipboard after cut & paste
            }
            
            SoundPlayer.playSound('click');

            // UI Refresh Logic - refresh destination and (if cut) source locations
            if (destinationDir === '/Desktop/') refreshDesktop = true;
             Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && win.appInstance.getCurrentPath && win.appInstance.getCurrentPath() === destinationDir) {
                    feWindowsToRefresh.add(win.element.id);
                }
            });

            if (refreshDesktop) await DesktopManager.renderIcons();
            feWindowsToRefresh.forEach(fullWindowId => {
                const feWin = state.openWindows[fullWindowId];
                if (feWin && feWin.appInstance && typeof feWin.appInstance.refresh === 'function') {
                    feWin.appInstance.refresh();
                }
            });
            
        } catch (err) {
            console.error("Error in _actionPasteItem:", err);
            NotificationManager.show('Paste Error', `Failed to paste: ${err.message}`, { type: 'error' });
        }
    },
};
