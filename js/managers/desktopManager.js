import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { getEventCoordinates, getIconForFileType } from '../core/utils.js';
import { DESKTOP_ICONS_CONFIG } from '../core/svgIcons.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from '../apps/appRegistry.js';
import { ContextMenu } from './contextMenu.js';
import { StartMenu } from './startMenu.js';
import { domElements } from '../main.js'; // Shared DOM elements

export const DesktopManager = {
    /** Initializes desktop, icons, and event listeners. */
    init: async () => {
        // desktopElement is now in domElements from main.js
        if (!domElements.desktopElement) {
            console.error("FATAL: Desktop element not found!");
            return;
        }

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
            if (Math.abs(state.lastStoredDesktopWidth - domElements.desktopElement.clientWidth) > 50) { // 50px tolerance
                // console.log("DM: Desktop width changed, invalidating stored icon positions."); // Dev log
                state.iconPositions = {};
            }

            await DesktopManager.renderIcons();
            // console.log("DM: renderIcons call completed from requestAnimationFrame."); // Dev log
        });

        domElements.desktopElement.addEventListener('contextmenu', DesktopManager.handleContextMenu);
        domElements.desktopElement.addEventListener('pointerdown', DesktopManager.handleDesktopPointerDown);
        domElements.desktopElement.addEventListener('keydown', DesktopManager.handleDesktopKeyDown);

        DesktopManager.loadWallpaper();
    };

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
        // console.log(`DM.renderIcons: Desktop clientWidth: ${domElements.desktopElement.clientWidth}, Available: ${availableWidth}, Icons per row: ${state.iconsPerRow}`); // Dev Log

        let currentX = CONSTANTS.DESKTOP_PADDING;
        let currentY = CONSTANTS.DESKTOP_PADDING;
        let iconCountInRow = 0;
        let iconDomElements = [];

        // Add app icons from config
        DESKTOP_ICONS_CONFIG.forEach((iconConfig) => {
            const iconEl = DesktopManager._createIconElement(iconConfig.id, iconConfig.name, iconConfig.icon, {
                'data-app-id': iconConfig.appId,
                'data-icon-type': 'app',
                'data-item-name': iconConfig.name // For context menu consistency
            });
            iconDomElements.push({ el: iconEl, id: iconConfig.id, type: 'app', name: iconConfig.name });
        });

        // Add file/folder icons from /Desktop/ in FSM
        try {
            const desktopItems = await FileSystemManager.listDirectory('/Desktop/');
            // console.log("DM: Fetched desktop items from FSM:", desktopItems); // Dev Log
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

        // Sort icons: apps first, then by name
        iconDomElements.sort((a, b) => {
            if (a.type === 'app' && b.type !== 'app') return -1;
            if (a.type !== 'app' && b.type === 'app') return 1;
            return a.name.localeCompare(b.name);
        });

        // Position and append icons
        iconDomElements.forEach(iconData => {
            const iconEl = iconData.el;
            const iconId = iconData.id;

            if (state.iconPositions[iconId]) { // Use stored position if available and valid (validity checked by desktopWidth match)
                iconEl.style.left = `${state.iconPositions[iconId].x}px`;
                iconEl.style.top = `${state.iconPositions[iconId].y}px`;
            } else { // Auto-layout
                if (iconCountInRow >= state.iconsPerRow && state.iconsPerRow > 0) {
                    currentX = CONSTANTS.DESKTOP_PADDING;
                    currentY += iconCellHeight;
                    iconCountInRow = 0;
                }
                iconEl.style.left = `${currentX}px`;
                iconEl.style.top = `${currentY}px`;
                state.iconPositions[iconId] = { x: currentX, y: currentY }; // Store auto-layout position

                currentX += iconCellWidth;
                iconCountInRow++;
            }
            domElements.desktopElement.appendChild(iconEl);
        });
        DesktopManager.saveIconPositions(); // Save potentially updated auto-layout positions
        // console.log("DM: Icons rendered and positioned."); // Dev Log
    };

    /** Creates a desktop icon DOM element. */
    _createIconElement: (id, name, iconGlyph, dataAttributes = {}) => {
        const iconElement = document.createElement('div');
        iconElement.className = 'desktop-icon';
        iconElement.id = id;
        iconElement.setAttribute('role', 'button');
        iconElement.setAttribute('tabindex', '0'); // For keyboard accessibility
        iconElement.innerHTML = `
            <span class="icon-image">${iconGlyph}</span>
            <span class="icon-label">${name}</span>`;

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
        iconElement.ondragstart = () => false; // Prevent native browser drag
        return iconElement;
    };

    /** Handles opening an icon (launch app or file). */
    _handleIconOpen: (iconEl) => {
        const iconType = iconEl.dataset.iconType;
        const appId = iconEl.dataset.appId;
        const filePath = iconEl.dataset.filePath;

        if (iconType === 'app' && appId) {
            AppRegistry.launchApp(appId);
        } else if ((iconType === 'file' || iconType === 'folder') && filePath) {
            if (iconType === 'file' && getIconForFileType(filePath) === '📝') { // Use getIconForFileType to check type based on extension
                AppRegistry.launchApp('notepad', { filePath: filePath });
            } else if (iconType === 'folder') {
                AppRegistry.launchApp('fileExplorer', { initialPath: filePath });
            } else {
                // Generic open for other file types (e.g., image viewer for images)
                const ext = getIconForFileType(filePath); // Re-check based on actual extension for safety
                if (['🖼️'].includes(ext)) { // Check against image icon
                    AppRegistry.launchApp('imageViewer', { initialUrl: `file://${filePath}` /* Placeholder, actual file loading needs FSM read */ });
                     alert(`Opening image: ${filePath} (Direct file URL for images from FSM is complex; use Image Viewer's 'Load from file' or paste path for now if it were a web URL)`);
                } else {
                    alert(`Opening ${iconType}: ${filePath} (Handler not fully implemented for this file type)`);
                }
            }
        }
    };

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
    };

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
                isActive: false // Drag is PENDING, not active yet
            };
            // DO NOT add 'dragging' class here
            // DO NOT setPointerCapture here
            // DO NOT change z-index here yet
        }
    };

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
    };

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
    };

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
    };

    /** Clears the currently active desktop icon. */
    clearActiveIcon: () => {
        if (state.activeDesktopIconId) {
            const oldActiveIcon = document.getElementById(state.activeDesktopIconId);
            if (oldActiveIcon) oldActiveIcon.classList.remove('active-icon');
            state.activeDesktopIconId = null;
            // Don't reset focusedDesktopIconIndex here, let focus() manage it
        }
    };

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
    };

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
    };

    /** Loads wallpaper based on current theme from localStorage. */
    loadWallpaper: () => {
        let storedWallpaper = null;
        try {
            storedWallpaper = localStorage.getItem(`desktop-wallpaper-${state.currentTheme}`);
        } catch (e) {
            console.warn("DM: Error loading wallpaper URL from localStorage:", e);
        }
        DesktopManager.setBackground(storedWallpaper); // setBackground handles default if stored is null/empty
    };

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
    };
};