import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { getEventCoordinates, getIconForFileType, getFileExtension } from '../core/utils.js';
import { DESKTOP_ICONS_CONFIG } from '../core/uiConfigs.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from '../apps/appRegistry.js';
import { ContextMenu } from './contextMenu.js';
import { StartMenu } from './startMenu.js';
import { domElements } from '../main.js'; // Shared DOM elements
import { showInAppAlert, showInAppConfirm } from '../core/utils.js';

export const DesktopManager = {
    /** Initializes desktop, icons, and event listeners. */
    init: async () => {
        // desktopElement is now in domElements from main.js
        if (!domElements.desktopElement) {
            console.error("FATAL: Desktop element not found!");
            return;
        }

        // Load icon positions from localStorage first
        DesktopManager._loadIconPositions();

        // Calculate icon grid cell size after CSS is applied
        requestAnimationFrame(async () => {
            const rootStyle = getComputedStyle(document.documentElement);
            const iconWidth = parseFloat(rootStyle.getPropertyValue('--icon-size')) || 72;
            const iconTotalHeightVisual = parseFloat(rootStyle.getPropertyValue('--icon-total-height-visual')) || 102;
            const iconMargin = parseFloat(rootStyle.getPropertyValue('--icon-margin')) || 10;

            state.iconGridCellSize = {
                width: iconWidth + iconMargin,
                height: iconTotalHeightVisual + iconMargin
            };
            // console.log("DM: iconGridCellSize calculated:", state.iconGridCellSize); // Dev log

            // Invalidate stored positions if desktop width has changed significantly
            // Only reset if the width has changed, otherwise keep loaded positions
            if (Math.abs(state.lastStoredDesktopWidth - domElements.desktopElement.clientWidth) > 50) { // 50px tolerance
                // console.log("DM: Desktop width changed, invalidating stored icon positions."); // Dev log
                state.iconPositions = {}; // Reset positions for re-layout
            }

            await DesktopManager.renderIcons();
            // console.log("DM: renderIcons call completed from requestAnimationFrame."); // Dev log
        });

        domElements.desktopElement.addEventListener('contextmenu', DesktopManager.handleContextMenu);
        domElements.desktopElement.addEventListener('pointerdown', DesktopManager.handleDesktopPointerDown);
        domElements.desktopElement.addEventListener('keydown', DesktopManager.handleDesktopKeyDown);

        DesktopManager.loadWallpaper();
    },

    /** Renders desktop icons based on config and file system. */
    renderIcons: async () => {
        if (!domElements.desktopElement || !state.iconGridCellSize.width || !state.fileSystemReady) {
            console.warn("DM.renderIcons: Pre-conditions not met (desktopElement, iconGridCellSize, or fileSystemReady). Retrying in 100ms.");
            // Retry once if critical elements aren't ready, common during initial load
            setTimeout(() => {
                 if (!state.fileSystemReady) console.warn("DM.renderIcons Retry: FSM still not ready.");
                 DesktopManager.renderIcons();
            }, 100);
            return;
        }

        domElements.desktopElement.querySelectorAll('.desktop-icon').forEach(icon => icon.remove());

        const iconCellWidth = state.iconGridCellSize.width;
        const iconCellHeight = state.iconGridCellSize.height;
        const availableWidth = domElements.desktopElement.clientWidth - (CONSTANTS.DESKTOP_PADDING * 2);

        state.iconsPerRow = Math.max(1, Math.floor(availableWidth / iconCellWidth));

        let iconDomElements = []; // This will hold { el, id, type, name, path, calculatedX, calculatedY }
        let occupiedPositions = {}; // To keep track of positions already assigned in this render cycle

        // 1. Collect all registered app icons
        for (const appId in AppRegistry.apps) {
            const appConfig = AppRegistry.apps[appId];
            if (appId === 'errorApp' || appId === 'propertiesDialog') continue;
            const iconEl = DesktopManager._createIconElement(appId, appConfig.name, appConfig.icon, {
                'data-app-id': appId,
                'data-icon-type': 'app',
                'data-item-name': appConfig.name
            });
            iconDomElements.push({ el: iconEl, id: appId, type: 'app', name: appConfig.name });
        }

        // 2. Collect all file/folder icons from /Desktop/
        try {
            const desktopItems = await FileSystemManager.listDirectory('/Desktop/');
            desktopItems.forEach(item => {
                const iconGlyph = item.type === 'folder' ? '📁' : getIconForFileType(item.name);
                const fileIconId = `desktop-file-${item.path.replace(/[\/\s.]/g, '_')}`;
                const iconEl = DesktopManager._createIconElement(fileIconId, item.name, iconGlyph, {
                    'data-file-path': item.path,
                    'data-icon-type': item.type,
                    'data-item-name': item.name
                });
                iconDomElements.push({ el: iconEl, id: fileIconId, type: item.type, name: item.name, path: item.path });
            });
        } catch (error) {
            console.error("DM: Error rendering desktop file icons:", error);
        }

        // 3. Sort icons based on user's requested priority and then alphabetically
        iconDomElements.sort((a, b) => {
            const customOrder = ['about', 'fileExplorer', 'recycleBin'];

            const aIndex = customOrder.indexOf(a.id);
            const bIndex = customOrder.indexOf(b.id);

            // If both are in custom order, sort by their custom index
            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }
            // If only 'a' is in custom order, 'a' comes first
            if (aIndex !== -1) {
                return -1;
            }
            // If only 'b' is in custom order, 'b' comes first
            if (bIndex !== -1) {
                return 1;
            }

            // For apps not in custom order, sort apps before files/folders
            if (a.type === 'app' && b.type !== 'app') return -1;
            if (a.type !== 'app' && b.type === 'app') return 1;

            // For items of the same type (or both not custom-ordered apps), sort alphabetically
            return a.name.localeCompare(b.name);
        });

        // 4. Calculate positions for all icons
        let currentAutoLayoutCol = 0;
        let currentAutoLayoutRow = 0;

        for (const iconData of iconDomElements) {
            const iconId = iconData.id;
            let finalX, finalY;

            if (state.iconPositions[iconId]) { // Use stored position if available
                finalX = state.iconPositions[iconId].x;
                finalY = state.iconPositions[iconId].y;
            } else { // Find a new position for this icon
                // Start search from the current auto-layout position
                let targetX = currentAutoLayoutCol * iconCellWidth + CONSTANTS.DESKTOP_PADDING;
                let targetY = currentAutoLayoutRow * iconCellHeight + CONSTANTS.DESKTOP_PADDING;

                // Find the next available grid position, considering already occupied slots in this render cycle
                const availablePos = DesktopManager._findNextAvailableGridPosition(targetX, targetY, iconId, occupiedPositions);
                finalX = availablePos.x;
                finalY = availablePos.y;

                // Update auto-layout cursor for the next icon
                currentAutoLayoutCol = Math.round((finalX - CONSTANTS.DESKTOP_PADDING) / iconCellWidth);
                currentAutoLayoutRow = Math.round((finalY - CONSTANTS.DESKTOP_PADDING) / iconCellHeight);

                currentAutoLayoutCol++;
                if (currentAutoLayoutCol >= state.iconsPerRow) {
                    currentAutoLayoutCol = 0;
                    currentAutoLayoutRow++;
                }
            }

            iconData.calculatedX = finalX;
            iconData.calculatedY = finalY;
            occupiedPositions[`${finalX},${finalY}`] = true; // Mark this position as occupied for current render
            state.iconPositions[iconId] = { x: finalX, y: finalY }; // Update global state for persistence
        }

        // 5. Append icons to DOM with their calculated positions
        iconDomElements.forEach(iconData => {
            iconData.el.style.left = `${iconData.calculatedX}px`;
            iconData.el.style.top = `${iconData.calculatedY}px`;
            domElements.desktopElement.appendChild(iconData.el);
        });

        DesktopManager.saveIconPositions();
    },

    /** Creates a desktop icon DOM element. */
    _createIconElement: (id, name, iconGlyph, dataAttributes = {}) => {
        const iconElement = document.createElement('div');
        iconElement.className = 'desktop-icon';
        iconElement.id = id;
        iconElement.setAttribute('role', 'button');
        iconElement.setAttribute('tabindex', '0'); // For keyboard accessibility
        iconElement.innerHTML = `
            <span class="icon-image">${iconGlyph}</span>
            <span class="icon-label" id="${id}-label">${name}</span>`;

        for (const attr in dataAttributes) {
            iconElement.setAttribute(attr, dataAttributes[attr]);
        }

        iconElement.addEventListener('pointerdown', (e) => DesktopManager.handleIconPointerDown(e, iconElement));
        iconElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                DesktopManager._handleIconOpen(iconElement);
            }
        });
        // Add drag and drop listeners
        iconElement.addEventListener('dragstart', DesktopManager.handleDragStart);
        iconElement.addEventListener('dragover', DesktopManager.handleDragOver);
        iconElement.addEventListener('drop', DesktopManager.handleDrop);
        return iconElement;
    },

    /** Handles opening an icon (launch app or file). */
    _handleIconOpen: async (iconEl) => {
        const iconType = iconEl.dataset.iconType;
        const appId = iconEl.dataset.appId;
        const filePath = iconEl.dataset.filePath;

        if (iconType === 'app' && appId) {
            AppRegistry.launchApp(appId);
        } else if ((iconType === 'file' || iconType === 'folder') && filePath) {
            const fileExtension = getFileExtension(filePath);
            const textFileExtensions = ['txt', 'js', 'css', 'html', 'json', 'md', 'xml', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rb', 'sh', 'sql', 'yaml', 'yml', 'ts'];

            if (iconType === 'folder') {
                AppRegistry.launchApp('fileExplorer', { initialPath: filePath });
            } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileExtension)) {
                AppRegistry.launchApp('imageViewer', { initialUrl: `file://${filePath}` });
            } else if (textFileExtensions.includes(fileExtension)) {
                AppRegistry.launchApp('notepad', { filePath: filePath });
            }
            else {
                await showInAppAlert(`Opening file: "${filePath}" (Generic file open for this type is not fully implemented yet)`);
            }
        }
    },

    /** Snaps X, Y coordinates to the desktop grid. */
    snapToGrid: (x, y) => {
        if (!state.iconGridCellSize.width || !state.iconGridCellSize.height) return { x, y }; // Grid not ready
        const padding = CONSTANTS.DESKTOP_PADDING;
        const cellWidth = state.iconGridCellSize.width;
        const cellHeight = state.iconGridCellSize.height;

        const snappedX = Math.round((x - padding) / cellWidth) * cellWidth + padding;
        const snappedY = Math.round((y - padding) / cellHeight) * cellHeight + padding;

        return {
            x: Math.max(padding, snappedX), // Ensure it doesn't go outside padding
            y: Math.max(padding, snappedY)
        };
    },

    /**
     * Finds the next available grid position for an icon, avoiding overlaps.
     * @param {number} targetX - The desired X coordinate (snapped to grid).
     * @param {number} targetY - The desired Y coordinate (snapped to grid).
     * @param {string} iconIdToMove - The ID of the icon being moved, to exclude it from collision checks.
     * @param {object} currentRenderOccupiedPositions - Positions occupied during the current render cycle.
     * @returns {{x: number, y: number}} The final collision-free coordinates.
     */
    _findNextAvailableGridPosition: (targetX, targetY, iconIdToMove, currentRenderOccupiedPositions = {}) => {
        const iconCellWidth = state.iconGridCellSize.width;
        const iconCellHeight = state.iconGridCellSize.height;
        const padding = CONSTANTS.DESKTOP_PADDING;
        const desktopWidth = domElements.desktopElement.clientWidth;
        const desktopHeight = domElements.desktopElement.clientHeight;

        // Convert pixel coordinates to grid indices
        let startCol = Math.round((targetX - padding) / iconCellWidth);
        let startRow = Math.round((targetY - padding) / iconCellHeight);

        // Define search boundaries (e.g., search within a reasonable area)
        const maxCols = Math.floor((desktopWidth - padding * 2) / iconCellWidth);
        const maxRows = Math.floor((desktopHeight - padding * 2) / iconCellHeight);

        // Keep track of visited positions to avoid infinite loops
        const visited = new Set();

        // Search outwards from the target position
        for (let spiralSize = 0; ; spiralSize++) {
            for (let i = -spiralSize; i <= spiralSize; i++) {
                for (let j = -spiralSize; j <= spiralSize; j++) {
                    const col = startCol + i;
                    const row = startRow + j;

                    // Calculate pixel coordinates for the current grid cell
                    const currentX = col * iconCellWidth + padding;
                    const currentY = row * iconCellHeight + padding;

                    // Check if within desktop bounds
                    if (currentX >= padding && currentY >= padding &&
                        currentX + iconCellWidth <= desktopWidth - padding &&
                        currentY + iconCellHeight <= desktopHeight - padding) {

                        const posKey = `${currentX},${currentY}`;
                        if (visited.has(posKey)) continue;
                        visited.add(posKey);

                        let isOccupied = false;
                        // Check against globally stored positions (excluding the icon being moved)
                        for (const id in state.iconPositions) {
                            if (id === iconIdToMove) continue;
                            const existingPos = state.iconPositions[id];
                            if (existingPos.x === currentX && existingPos.y === currentY) {
                                isOccupied = true;
                                break;
                            }
                        }
                        // Additionally check against positions already assigned in the current render cycle
                        if (!isOccupied && currentRenderOccupiedPositions[posKey]) {
                            isOccupied = true;
                        }

                        if (!isOccupied) {
                            return { x: currentX, y: currentY };
                        }
                    }
                }
            }
            // If no position found in this spiral layer, and we've searched a large area,
            // it's possible the desktop is full or there's an issue.
            // For now, we'll just keep expanding the search.
            // A more robust solution might involve resizing the desktop or alerting the user.
            if (spiralSize > Math.max(maxCols, maxRows) * 2) { // Prevent infinite search on full desktop
                console.warn("DM: Could not find an available grid position for icon. Returning original snapped position.");
                return { x: targetX, y: targetY }; // Fallback
            }
        }
    },

    /** Handles pointer down on a desktop icon (for click, double-click, drag). */
    handleIconPointerDown: (event, iconElement) => {
        event.stopPropagation();
        DesktopManager.setActiveIcon(iconElement.id);

        const currentTime = new Date().getTime();
        // Double tap/click handling
        if (currentTime - state.lastTouchTime < CONSTANTS.DOUBLE_CLICK_TIMEOUT) {
            if ( (event.pointerType !== 'mouse') || (event.pointerType === 'mouse' && event.button === 0) ) {
                 DesktopManager._handleIconOpen(iconElement);
                 state.lastTouchTime = 0; // Reset for next double click
                 clearTimeout(state.longPressTimer);
                 return;
            }
        }
        state.lastTouchTime = currentTime;

        // Long press for context menu (touch only)
        if (event.pointerType === 'touch') {
            clearTimeout(state.longPressTimer); // Clear any existing timer
            state.longPressTimer = setTimeout(() => {
                ContextMenu.showForIcon(event, iconElement);
            }, CONSTANTS.LONG_PRESS_DURATION);
        }

        // Potential drag for left mouse button or any touch
        if (event.button === 0 || event.pointerType === 'touch') {
            SoundPlayer.playSound('click'); // Sound for first click/tap
            const coords = getEventCoordinates(event);
            state.dragInfo = {
                element: iconElement,
                id: iconElement.id,
                offsetX: coords.x - iconElement.offsetLeft,
                offsetY: coords.y - iconElement.offsetTop,
                type: 'icon-drag',
                pointerId: event.pointerId,
                initialPointerX: coords.x, // Added for drag threshold
                initialPointerY: coords.y, // Added for drag threshold
                isActive: false, // Drag is PENDING, not active yet
                // Store file system info for drag & drop
                filePath: iconElement.dataset.filePath,
                itemType: iconElement.dataset.iconType
            };
            iconElement.setAttribute('draggable', 'true'); // Make draggable when a potential drag starts
            // DO NOT add 'dragging' class here
            // DO NOT setPointerCapture here
            // DO NOT change z-index here yet
        }
    },

    /** Handles pointer down on the desktop itself. */
    handleDesktopPointerDown: (event) => {
        if (event.target === domElements.desktopElement) { // Clicked directly on desktop background
            DesktopManager.clearActiveIcon();
            if (StartMenu && StartMenu.isVisible()) StartMenu.hide();
            if (ContextMenu && ContextMenu.isVisible()) ContextMenu.hide();
            if (domElements.desktopElement) domElements.desktopElement.focus(); // For keyboard events
            state.focusedDesktopIconIndex = -1;
        }
        if (event.pointerType === 'touch') { // Clear long press if touch starts on desktop
            clearTimeout(state.longPressTimer);
        }
    },

    /** Handles keyboard navigation for desktop icons. */
    handleDesktopKeyDown: (event) => {
        const icons = Array.from(domElements.desktopElement.querySelectorAll('.desktop-icon'));
        if (!icons.length) return;

        let handled = false;
        let nextIndex = state.focusedDesktopIconIndex;
        const totalIcons = icons.length;
        const iconsPerRow = state.iconsPerRow || Math.max(1, Math.floor((domElements.desktopElement.clientWidth - CONSTANTS.DESKTOP_PADDING * 2) / state.iconGridCellSize.width)) || 1;

        switch (event.key) {
            case 'ArrowRight': nextIndex = (nextIndex + 1) % totalIcons; handled = true; break;
            case 'ArrowLeft': nextIndex = (nextIndex - 1 + totalIcons) % totalIcons; handled = true; break;
            case 'ArrowDown': nextIndex = Math.min(nextIndex + iconsPerRow, totalIcons - 1); handled = true; break;
            case 'ArrowUp': nextIndex = Math.max(nextIndex - iconsPerRow, 0); handled = true; break;
            case 'Home': nextIndex = 0; handled = true; break;
            case 'End': nextIndex = totalIcons - 1; handled = true; break;
            case 'Tab': return; // Allow default tab behavior
        }

        if (handled) {
            event.preventDefault();
            if (nextIndex !== state.focusedDesktopIconIndex || state.focusedDesktopIconIndex === -1) {
                 // Special handling if no icon was focused or for edge cases
                if (state.focusedDesktopIconIndex === -1) {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                        nextIndex = (event.key === 'ArrowUp') ? totalIcons - 1 : 0;
                    } else {
                        nextIndex = 0;
                    }
                }
                state.focusedDesktopIconIndex = nextIndex;
                const iconToFocus = icons[state.focusedDesktopIconIndex];
                if (iconToFocus) {
                    iconToFocus.focus(); // This will also trigger :focus styles
                    DesktopManager.setActiveIcon(iconToFocus.id); // Visually mark as active
                }
            }
        }
    },

    /** Sets a desktop icon as active. */
    setActiveIcon: (iconId) => {
        DesktopManager.clearActiveIcon(); // Clear previously active
        const iconElement = document.getElementById(iconId);
        if (iconElement) {
            iconElement.classList.add('active-icon');
            state.activeDesktopIconId = iconId;
            // Update focused index for keyboard navigation
            const icons = Array.from(domElements.desktopElement.querySelectorAll('.desktop-icon'));
            state.focusedDesktopIconIndex = icons.findIndex(icon => icon.id === iconId);
        }
    },

    /** Clears the currently active desktop icon. */
    clearActiveIcon: () => {
        if (state.activeDesktopIconId) {
            const oldActiveIcon = document.getElementById(state.activeDesktopIconId);
            if (oldActiveIcon) oldActiveIcon.classList.remove('active-icon');
            state.activeDesktopIconId = null;
            // Don't reset focusedDesktopIconIndex here, let focus() manage it
        }
    },

    /** Loads icon positions from localStorage. */
    _loadIconPositions: () => {
        try {
            const storedData = localStorage.getItem('desktop-icon-positions-v2');
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                state.iconPositions = parsedData.positions || {};
                state.lastStoredDesktopWidth = parsedData.desktopWidth || 0;
                // console.log("DM: Loaded icon positions from localStorage:", state.iconPositions); // Dev log
            } else {
                state.iconPositions = {};
                state.lastStoredDesktopWidth = 0;
                // console.log("DM: No icon positions found in localStorage. Starting fresh."); // Dev log
            }
        } catch (e) {
            console.warn("DM: Error loading icon positions from localStorage:", e);
            state.iconPositions = {}; // Reset on error to prevent corrupted state
            state.lastStoredDesktopWidth = 0;
        }
    },

    /** Saves current icon positions to localStorage. */
    saveIconPositions: () => {
        try {
            const dataToStore = {
                positions: state.iconPositions,
                desktopWidth: domElements.desktopElement.clientWidth
            };
            localStorage.setItem('desktop-icon-positions-v2', JSON.stringify(dataToStore));
        } catch (e) {
            console.warn("DM: Error saving icon positions to localStorage:", e);
        }
    },

    /** Sets the desktop background image. */
    setBackground: (url) => {
        if (!domElements.desktopElement) return;
        const currentDefaultWallpaper = state.currentTheme === 'dark' ? state.defaultWallpaperDark : state.defaultWallpaperLight;
        const effectiveUrl = (url && url !== "undefined" && url.trim() !== '') ? `url('${url}')` : currentDefaultWallpaper;
        domElements.desktopElement.style.backgroundImage = effectiveUrl;

        try { // Save the user-set URL (or empty if reset to default)
            localStorage.setItem(`desktop-wallpaper-${state.currentTheme}`, url || '');
        } catch (e) {
            console.warn("DM: Error saving wallpaper URL to localStorage:", e);
        }
    },

    /** Loads wallpaper based on current theme from localStorage. */
    loadWallpaper: () => {
        let storedWallpaper = null;
        try {
            storedWallpaper = localStorage.getItem(`desktop-wallpaper-${state.currentTheme}`);
        } catch (e) {
            console.warn("DM: Error loading wallpaper URL from localStorage:", e);
        }
        DesktopManager.setBackground(storedWallpaper); // setBackground handles default if stored is null/empty
    },

    /** Handles context menu requests on the desktop or icons. */
    handleContextMenu: (event) => {
        event.preventDefault();
        const iconElement = event.target.closest('.desktop-icon');
        if (iconElement) {
            ContextMenu.showForIcon(event, iconElement);
            DesktopManager.setActiveIcon(iconElement.id); // Select icon on right-click
        } else {
            ContextMenu.showForDesktop(event);
        }
        if (StartMenu && StartMenu.isVisible()) StartMenu.hide(); // Hide start menu if open
    },

    /** Handles the dragstart event for desktop icons. */
    handleDragStart: (event) => {
        const iconElement = event.target.closest('.desktop-icon');
        if (!iconElement) return;

        const filePath = iconElement.dataset.filePath;
        const itemType = iconElement.dataset.iconType;

        if (filePath && itemType) {
            event.dataTransfer.setData('text/plain', JSON.stringify({ filePath, itemType, source: 'desktop' }));
            event.dataTransfer.effectAllowed = 'move';
            iconElement.classList.add('dragging'); // Add visual feedback
            state.dragInfo.isActive = true; // Confirm drag is active
            SoundPlayer.playSound('drag');
        } else {
            event.preventDefault(); // Prevent drag if no file path
        }
    },

    /** Handles the dragover event for desktop and folder icons. */
    handleDragOver: (event) => {
        event.preventDefault(); // Necessary to allow dropping
        const targetElement = event.target.closest('.desktop-icon');
        const isFolder = targetElement && targetElement.dataset.iconType === 'folder';
        const isDesktop = event.target === domElements.desktopElement;

        if (isFolder || isDesktop) {
            event.dataTransfer.dropEffect = 'move'; // Indicate a move operation
            if (isFolder) {
                targetElement.classList.add('drag-over'); // Visual feedback for folder
            }
        } else {
            event.dataTransfer.dropEffect = 'none';
        }
    },

    /** Handles the dragleave event for desktop and folder icons. */
    handleDragLeave: (event) => {
        const targetElement = event.target.closest('.desktop-icon');
        if (targetElement && targetElement.dataset.iconType === 'folder') {
            targetElement.classList.remove('drag-over');
        }
    },

    /** Handles the drop event for desktop and folder icons. */
    handleDrop: async (event) => {
        event.preventDefault();
        const targetElement = event.target.closest('.desktop-icon');
        const isFolder = targetElement && targetElement.dataset.iconType === 'folder';
        const isDesktop = event.target === domElements.desktopElement;

        if (targetElement && isFolder) {
            targetElement.classList.remove('drag-over');
        }

        if (!isFolder && !isDesktop) {
            return; // Not a valid drop target
        }

        try {
            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            const { filePath: sourcePath, itemType, source } = data;

            if (!sourcePath || !itemType) {
                console.warn("DM: Drop event missing filePath or itemType.", data);
                return;
            }

            let destinationPath;
            if (isFolder) {
                destinationPath = targetElement.dataset.filePath;
                if (!destinationPath.endsWith('/')) destinationPath += '/';
            } else { // Dropped on desktop background
                destinationPath = '/Desktop/';
            }

            const { name: itemName } = FileSystemManager._getPathInfo(sourcePath);
            let newPath = `${destinationPath}${itemName}`;
            if (itemType === 'folder' && !newPath.endsWith('/')) {
                newPath += '/';
            }

            if (sourcePath === newPath) {
                console.log("DM: Item dropped in same location, no move needed.");
                return;
            }

            const existing = await FileSystemManager.getItem(newPath);
            if (existing) {
                if (!(await showInAppConfirm(`An item named "${itemName}" already exists in this location. Overwrite?`))) {
                    console.log(`Move cancelled for ${itemName} due to overwrite.`);
                    return;
                }
                await FileSystemManager.deleteItem(newPath); // Delete existing before overwriting
            }

            await FileSystemManager.renameItem(sourcePath, newPath); // Use renameItem for move
            SoundPlayer.playSound('drop');

            // Refresh UI
            await DesktopManager.renderIcons();
            // Also refresh any open File Explorer windows that might be affected
            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof win.appInstance.refresh === 'function') {
                    win.appInstance.refresh();
                }
            });

        } catch (error) {
            console.error("DM: Error handling drop:", error);
            await showInAppAlert("Failed to move item.");
        } finally {
            // Clean up drag state
            if (state.dragInfo.element) {
                state.dragInfo.element.classList.remove('dragging');
                state.dragInfo.element.removeAttribute('draggable');
            }
            state.dragInfo = { isActive: false };
        }
    },

    /** Initiates inline renaming for a desktop icon. */
    startRenameInline: (iconId, currentName, filePath) => {
        const iconElement = document.getElementById(iconId);
        if (!iconElement) return;

        const labelSpan = iconElement.querySelector('.icon-label');
        if (!labelSpan) return;

        // Store original name and path for revert/save
        labelSpan.dataset.originalName = currentName;
        labelSpan.dataset.filePath = filePath;

        labelSpan.contentEditable = 'true';
        labelSpan.focus();
        document.execCommand('selectAll', false, null); // Select all text

        const handleBlur = async () => {
            labelSpan.contentEditable = 'false';
            labelSpan.removeEventListener('blur', handleBlur);
            labelSpan.removeEventListener('keydown', handleKeyDown);
            await DesktopManager._saveRename(labelSpan, filePath);
        };

        const handleKeyDown = async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                labelSpan.contentEditable = 'false';
                labelSpan.removeEventListener('blur', handleBlur);
                labelSpan.removeEventListener('keydown', handleKeyDown);
                await DesktopManager._saveRename(labelSpan, filePath);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                labelSpan.textContent = labelSpan.dataset.originalName; // Revert
                labelSpan.contentEditable = 'false';
                labelSpan.removeEventListener('blur', handleBlur);
                labelSpan.removeEventListener('keydown', handleKeyDown);
                iconElement.focus(); // Return focus to the icon
            }
        };

        labelSpan.addEventListener('blur', handleBlur);
        labelSpan.addEventListener('keydown', handleKeyDown);
    },

    /** Saves the renamed item. */
    _saveRename: async (labelSpan, originalFilePath) => {
        const newName = labelSpan.textContent.trim();
        const originalName = labelSpan.dataset.originalName;
        const itemType = labelSpan.closest('.desktop-icon').dataset.iconType;

        if (newName === '' || newName === originalName) {
            labelSpan.textContent = originalName; // Revert if empty or same
            return;
        }

        const sanitizedNewName = sanitizeFilename(newName);
        if (sanitizedNewName !== newName) {
            await showInAppAlert(`Invalid characters in name. Renamed to: "${sanitizedNewName}"`);
            labelSpan.textContent = sanitizedNewName; // Update UI with sanitized name
        }

        try {
            const { parentPath } = FileSystemManager._getPathInfo(originalFilePath);
            let newPath = `${parentPath}${sanitizedNewName}`;
            if (itemType === 'folder' && !newPath.endsWith('/')) {
                newPath += '/';
            }

            const existing = await FileSystemManager.getItem(newPath);
            if (existing && existing.path !== originalFilePath) { // Check if existing is not the item itself
                await showInAppAlert(`An item named "${sanitizedNewName}" already exists in this location.`);
                labelSpan.textContent = originalName; // Revert UI
                return;
            }

            await FileSystemManager.renameItem(originalFilePath, newPath);
            SoundPlayer.playSound('rename');
            await DesktopManager.renderIcons(); // Re-render to update icon data and positions

            // Refresh any open File Explorer windows that might be affected
            Object.values(state.openWindows).forEach(win => {
                if (win.appId === 'fileExplorer' && win.appInstance && typeof w.appInstance.refresh === 'function') {
                    w.appInstance.refresh();
                }
            });

        } catch (err) {
            console.error("DM: Error saving inline rename:", err);
            await showInAppAlert("Failed to rename item.");
            labelSpan.textContent = originalName; // Revert UI on error
        }
    },
};
