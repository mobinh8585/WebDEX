import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
import {
    CONTEXT_MENU_DESKTOP_CONFIG,
    CONTEXT_MENU_ICON_CONFIG,
    CONTEXT_MENU_FE_ITEM_CONFIG
} from '../core/uiConfigs.js';
import { sanitizeFilename, getIconForFileType } from '../core/utils.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from '../apps/appRegistry.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { DesktopManager } from './desktopManager.js';
import { ThemeManager } from '../core/themeManager.js';
import { FileExplorerApp } from '../apps/fileExplorer.js'; // Import directly for FE actions
import { domElements } from '../main.js'; // Shared DOM elements

export const ContextMenu = {
    init: () => {
        // contextMenuElement is in domElements from main.js
        if (!domElements.contextMenuElement) {
            console.error("FATAL: Context menu element missing!");
            return;
        }
        domElements.contextMenuElement.addEventListener('click', async (e) => { // Click on a menu item
            const listItem = e.target.closest('li[data-action]');
            if (listItem) {
                await ContextMenu._handleAction(listItem);
                ContextMenu.hide();
                e.stopPropagation();
            }
        });
        domElements.contextMenuElement.addEventListener('contextmenu', e => e.preventDefault()); // Prevent nested context menu
    },

    _renderItems: (itemsConfig, dataContext = {}) => {
        if (!domElements.contextMenuElement) return;
        const ul = domElements.contextMenuElement.querySelector('ul') || document.createElement('ul');
        ul.innerHTML = ''; // Clear previous items

        itemsConfig.forEach(item => {
            if (item.type === 'separator') {
                ul.appendChild(document.createElement('hr'));
                return;
            }
            const li = document.createElement('li');
            li.dataset.action = item.action;

            // Embed all dataContext properties as data attributes on the li
            for (const key in dataContext) {
                if (dataContext.hasOwnProperty(key) && dataContext[key] !== undefined) {
                    li.dataset[key] = dataContext[key];
                }
            }

            li.innerHTML = `<span class="icon">${item.icon || ''}</span> ${item.label}`;
            li.tabIndex = 0; // For keyboard navigation
            li.setAttribute('role', 'menuitem');
            li.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    await ContextMenu._handleAction(li);
                    ContextMenu.hide();
                }
            });
            ul.appendChild(li);
        });

        if (!domElements.contextMenuElement.contains(ul)) domElements.contextMenuElement.appendChild(ul);
        const firstItem = ul.querySelector('li[tabindex="0"]'); // Focus first actionable item
        if (firstItem) firstItem.focus();
    },

    _showAt: (x, y) => {
        if (!domElements.contextMenuElement) return;
        domElements.contextMenuElement.classList.add('visible');

        const menuWidth = domElements.contextMenuElement.offsetWidth;
        const menuHeight = domElements.contextMenuElement.offsetHeight;

        // Adjust position to ensure menu is fully visible on screen
        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 5;
        if (y + menuHeight > window.innerHeight - CONSTANTS.TASKBAR_HEIGHT) {
            y = window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - menuHeight - 5;
        }
        x = Math.max(5, x); // Ensure min distance from left edge
        y = Math.max(5, y); // Ensure min distance from top edge

        domElements.contextMenuElement.style.left = `${x}px`;
        domElements.contextMenuElement.style.top = `${y}px`;
    },

    showForDesktop: (event) => {
        ContextMenu._renderItems(CONTEXT_MENU_DESKTOP_CONFIG);
        ContextMenu._showAt(event.clientX, event.clientY);
    },

    showForIcon: (event, iconEl) => {
        event.preventDefault();
        event.stopPropagation();
        ContextMenu._renderItems(CONTEXT_MENU_ICON_CONFIG, { ...iconEl.dataset }); // Pass all icon data attributes

        let x, y;
        if (event.pointerType === 'touch' || (event.clientX === 0 && event.clientY === 0)) { // Heuristic for touch/keyboard
            const rect = iconEl.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        } else {
            x = event.clientX;
            y = event.clientY;
        }
        ContextMenu._showAt(x, y);
    },

    showForFileExplorerItem: (event, itemName, itemType, itemPath, windowId) => {
        event.preventDefault();
        event.stopPropagation();
        const config = itemType === 'folder' ? CONTEXT_MENU_FE_ITEM_CONFIG.folder : CONTEXT_MENU_FE_ITEM_CONFIG.file;
        ContextMenu._renderItems(config, {
            targetId: itemName, // `targetId` now consistently `itemName` for FE items
            targetType: itemType,
            filePath: itemPath,
            windowId: windowId
        });
        ContextMenu._showAt(event.clientX, event.clientY);
    },

    hide: () => {
        if (domElements.contextMenuElement) domElements.contextMenuElement.classList.remove('visible');
        clearTimeout(state.longPressTimer); // Clear long press if menu is hidden for any reason
    },

    isVisible: () => {
        return domElements.contextMenuElement && domElements.contextMenuElement.classList.contains('visible');
    },

    // Central action handler, delegates to specific handlers
    _handleAction: async (listItem) => {
        SoundPlayer.playSound('click');
        const action = listItem.dataset.action;
        const data = { ...listItem.dataset }; // Clone dataset for handlers

        switch (action) {
            case 'change-wallpaper':
            case 'display-settings': // Currently, display-settings also opens general settings
                AppRegistry.launchApp('settings');
                break;
            case 'toggle-theme':
                ThemeManager.toggleTheme();
                break;
            case 'new-text-file':
                await ContextMenu._actionNewTextFile(data);
                break;
            case 'open-item':
                ContextMenu._actionOpenItem(data);
                break;
            case 'delete-item':
                await ContextMenu._actionDeleteItem(data);
                break;
            case 'properties':
                ContextMenu._actionProperties(data);
                break;
            case 'fe-open':
                ContextMenu._actionFeOpen(data);
                break;
            case 'fe-delete':
                await ContextMenu._actionFeDelete(data);
                break;
            case 'fe-properties':
                ContextMenu._actionFeProperties(data);
                break;
            default:
                console.warn("ContextMenu: Unknown action:", action, data);
        }
    },

    // Specific action handlers
    _actionNewTextFile: async (data) => {
        let newFileName = prompt("Enter name for new text file:", "New Text File.txt");
        if (newFileName) {
            newFileName = sanitizeFilename(newFileName);
            if (!newFileName.toLowerCase().endsWith('.txt')) newFileName += '.txt';
            const newFilePath = `/Desktop/${newFileName}`; // Create on Desktop
            try {
                const existing = await FileSystemManager.getItem(newFilePath);
                if (existing) {
                    alert(`File "${newFileName}" already exists on the Desktop.`);
                    return;
                }
                await FileSystemManager.createFile(newFilePath, ""); // Create empty file
                await DesktopManager.renderIcons(); // Refresh desktop
            } catch (err) {
                console.error("ContextMenu: Error creating new text file:", err);
                alert("Failed to create text file.");
            }
        }
    },
    _actionOpenItem: (data) => {
        const { iconType, appId, filePath, itemName } = data;
        if (iconType === 'app' && appId) {
            AppRegistry.launchApp(appId);
        } else if ((iconType === 'file' || iconType === 'folder') && filePath) {
            if (iconType === 'file' && getIconForFileType(filePath) === '📝') {
                AppRegistry.launchApp('notepad', { filePath: filePath });
            } else if (iconType === 'folder') {
                AppRegistry.launchApp('fileExplorer', { initialPath: filePath });
            } else {
                alert(`Opening ${iconType} "${itemName || filePath}" (Handler not fully implemented for this type)`);
            }
        }
    },
    _actionDeleteItem: async (data) => {
        const { iconType, filePath, itemName, targetId /* from FE */ } = data;
        const nameToDelete = itemName || targetId || filePath;
        if (!confirm(`Are you sure you want to delete "${nameToDelete}"? This action cannot be undone.`)) return;

        if (iconType === 'app') {
            alert(`Deleting app shortcut "${nameToDelete}" is a UI concept. App shortcuts are currently hardcoded.`);
        } else if ((iconType === 'file' || iconType === 'folder') && filePath) {
            try {
                await FileSystemManager.deleteItem(filePath);
                await DesktopManager.renderIcons(); // Refresh desktop icons
                // Refresh any open File Explorer windows
                Object.values(state.openWindows).forEach(win => {
                    if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function') {
                        win.appInstance.refresh();
                    }
                });
            } catch (err) {
                console.error("ContextMenu: Error deleting item:", err);
                alert("Failed to delete item.");
            }
        }
    },
    _actionProperties: (data) => {
        const { itemName, targetId, iconType, targetType, filePath, appId, windowId } = data;
        AppRegistry.launchApp('propertiesDialog', {
            targetId: itemName || targetId,
            targetType: iconType || targetType,
            filePath: filePath,
            appId: appId, // For app shortcuts
            windowId: windowId // Context window if any
        });
    },
    _actionFeOpen: (data) => {
        const { windowId, targetId, targetType, filePath } = data; // targetId is itemName here
        if (windowId && targetId && targetType && filePath && FileExplorerApp.handleItemAction) {
            FileExplorerApp.handleItemAction(windowId, targetId, targetType, 'open', filePath);
        }
    },
    _actionFeDelete: async (data) => {
        const { windowId, targetId, filePath } = data; // targetId is itemName here
        if (!confirm(`Are you sure you want to delete "${targetId}"? This action cannot be undone.`)) return;

        if (windowId && targetId && filePath) {
            try {
                await FileSystemManager.deleteItem(filePath);
                const feWin = state.openWindows[windowId];
                if (feWin && feWin.appInstance && typeof feWin.appInstance.refresh === 'function') {
                    feWin.appInstance.refresh(); // Refresh current FE
                }
                if (filePath.startsWith("/Desktop/")) { // If deleted from desktop via FE
                    await DesktopManager.renderIcons();
                }
            } catch (err) {
                console.error("ContextMenu: Error deleting FE item:", err);
                alert("Failed to delete item.");
            }
        }
    },
    _actionFeProperties: (data) => {
        const { windowId, targetId, targetType, filePath } = data;
        AppRegistry.launchApp('propertiesDialog', {
            targetId: targetId, // itemName
            targetType: targetType,
            filePath: filePath,
            windowId: windowId
        });
    }
};