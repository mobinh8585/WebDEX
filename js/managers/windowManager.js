// Placeholder for missing SVG_ICONS definition (as discussed previously)
const SVG_ICONS = { minimize: '➖', maximize: '🔲', restore: '🔳', close: '❌' };

import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
// import { SVG_ICONS } from '../core/svgIcons.js'; // Problematic import
import { generateId, getAppConfig, getEventCoordinates } from '../core/utils.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from '../apps/appRegistry.js';
import { Taskbar } from './taskbar.js';
import { DesktopManager } from './desktopManager.js';
import { domElements } from '../main.js';

export const WindowManager = {
    init: () => {
        if (!domElements.snapPreviewElement) console.error("WM: Snap preview element not found!");
        // Ensure passive: false if we might call preventDefault() for text selection, though not currently used here.
        document.addEventListener('pointermove', WindowManager.handleGlobalPointerMove, { passive: true }); // Passive true if no preventDefault
        document.addEventListener('pointerup', WindowManager.handleGlobalPointerUp, { passive: true });
        document.addEventListener('pointercancel', WindowManager.handleGlobalPointerUp, { passive: true });
    },

    createWindow: (appId, params = {}) => {
        const appConfig = getAppConfig(appId);
        if (!appConfig || typeof appConfig.launch !== 'function') {
            console.error(`WM: App '${appId}' or its launch function is not defined.`);
            AppRegistry.launchApp('errorApp', { erroredAppId: appId });
            return;
        }
        if (appConfig.allowMultiple === false) {
            for (const id in state.openWindows) {
                if (state.openWindows[id].appId === appId && !state.openWindows[id].isClosing) {
                    WindowManager.focusWindow(id);
                    return;
                }
            }
        }
        const windowId = generateId();
        const windowEl = WindowManager._buildWindowShell(windowId, appConfig.name, appConfig.icon);
        WindowManager._addResizeHandles(windowEl, windowId);
        const contentArea = windowEl.querySelector('.window-content');
        if (!contentArea) {
            console.error(`WM: Window content area not found for window: ${windowId}`);
            return;
        }
        contentArea.setAttribute('tabindex', '-1');
        const appInstance = appConfig.launch(windowId, contentArea, params);
        if (!domElements.desktopElement) {
            console.error("WM: Cannot create window, desktop element not found.");
            return;
        }
        domElements.desktopElement.appendChild(windowEl);
        SoundPlayer.playSound('windowOpen');
        const initialWidth = appConfig.width || 600;
        let initialWidth = appConfig.width || 600;
        let initialHeight = appConfig.height || 400;
        let initialX = 0;
        let initialY = 0;
        let isForcedMaximized = false;

        if (window.innerWidth < 480) { // Small screen optimization
            isForcedMaximized = true;
            initialWidth = window.innerWidth; // Full width
            initialHeight = window.innerHeight - CONSTANTS.TASKBAR_HEIGHT; // Full height minus taskbar
            initialX = 0;
            initialY = 0;
            windowEl.classList.add('forced-maximized'); // Add a class for potential CSS targeting / state
            // Hide resize handles and potentially alter maximize button behavior for forced maximized windows
            const resizeWrapper = windowEl.querySelector('.resize-handle-wrapper');
            if (resizeWrapper) resizeWrapper.style.display = 'none';
            const maximizeButton = windowEl.querySelector('.maximize-btn');
            if (maximizeButton) {
                maximizeButton.disabled = true; // Disable maximize/restore on these windows
                maximizeButton.style.opacity = '0.5';
                maximizeButton.title = "Maximized (auto)";
            }
        } else {
            const openWinCount = Object.keys(state.openWindows).length;
            const cascadeOffset = (openWinCount % 10) * 25;
            initialX = Math.max(0, Math.min((window.innerWidth - initialWidth) / 2 + cascadeOffset, window.innerWidth - initialWidth - 20));
            initialY = Math.max(0, Math.min((window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - initialHeight) / 2 + cascadeOffset, window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - initialHeight - 20));
        }

        windowEl.style.width = `${initialWidth}px`;
        windowEl.style.height = `${initialHeight}px`;
        windowEl.style.left = `${initialX}px`;
        windowEl.style.top = `${initialY}px`;

        state.openWindows[windowId] = {
            element: windowEl,
            title: appConfig.name,
            appId: appId,
            isMinimized: false,
            isMaximized: isForcedMaximized, // If forced, it's considered maximized
            isForcedMaximized: isForcedMaximized, // Store this new state
            originalRect: isForcedMaximized ? { x: 0, y: 0, width: initialWidth, height: initialHeight } : null,
            zIndex: state.nextZIndex++,
            taskbarButton: null,
            appInstance: appInstance,
            isModal: appConfig.isModal || false,
        };
        windowEl.classList.add('opening');
        requestAnimationFrame(() => { requestAnimationFrame(() => { if (windowEl) windowEl.classList.remove('opening'); }); });
        WindowManager.focusWindow(windowId);
        Taskbar.addApp(windowId, appConfig.name, appConfig.icon);
        if (appConfig.autoFocusContent !== false && contentArea && typeof contentArea.focus === 'function') {
            setTimeout(() => contentArea.focus(), 50);
        }
    },

    _buildWindowShell: (windowId, title, icon) => {
        const windowEl = document.createElement('div');
        windowEl.className = 'app-window';
        windowEl.id = windowId;
        windowEl.setAttribute('role', 'dialog');
        windowEl.setAttribute('aria-label', title);
        // Note: SVG_ICONS are placeholders here, actual icons come from CSS or a JS mapping
        windowEl.innerHTML = `
            <div class="title-bar" tabindex="-1">
                <span class="app-icon">${icon || '🧩'}</span> {/* Changed default icon */}
                <span class="title">${title}</span>
                <div class="window-controls">
                    <button class="minimize-btn" data-action="minimize" title="Minimize" aria-label="Minimize" tabindex="0">
                        <svg class="window-control-icon minimize-icon" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5"/></svg>
                    </button>
                    <button class="maximize-btn" data-action="maximize" title="Maximize" aria-label="Maximize" tabindex="0">
                        <svg class="window-control-icon maximize-icon" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="1"/></svg>
                    </button>
                    {/* Restore icon will be swapped in JS by toggleMaximize */}
                    <button class="close-btn" data-action="close" title="Close" aria-label="Close" tabindex="0">
                        <svg class="window-control-icon close-icon" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10"/><line x1="0" y1="10" x2="10" y2="0"/></svg>
                    </button>
                </div>
            </div>
            <div class="window-content"></div>`;
        windowEl.addEventListener('pointerdown', (e) => { 
            WindowManager.focusWindow(windowId); 
            // Clearing longPressTimer here for any touch on window, helps if user misses an icon.
            if (e.pointerType === 'touch') clearTimeout(state.longPressTimer); 
        }, true);
        const titleBar = windowEl.querySelector('.title-bar');
        if (titleBar) {
            titleBar.addEventListener('pointerdown', (e) => { 
                const winData = state.openWindows[windowId];
                if (winData && winData.isForcedMaximized) return; // Prevent drag if forced maximized
                if (e.target.closest('.window-controls button') || e.target.closest('.resize-handle')) return; 
                WindowManager.startDrag(e, windowId); 
            });
            titleBar.addEventListener('dblclick', (e) => { 
                const winData = state.openWindows[windowId];
                if (winData && winData.isForcedMaximized) return; // Prevent toggle maximize if forced
                if (!e.target.closest('.window-controls button')) WindowManager.toggleMaximize(windowId); 
            });
        }
        const controls = windowEl.querySelector('.window-controls');
        if (controls) {
            controls.addEventListener('click', (e) => {
                const button = e.target.closest('button'); if (!button) return; const action = button.dataset.action;
                if (action === 'minimize') WindowManager.minimizeWindow(windowId);
                else if (action === 'maximize') WindowManager.toggleMaximize(windowId);
                else if (action === 'close') WindowManager.closeWindow(windowId);
                e.stopPropagation();
            });
        }
        return windowEl;
    },

    _addResizeHandles: (windowEl, windowId) => {
        const resizeWrapper = document.createElement('div');
        resizeWrapper.className = 'resize-handle-wrapper';
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(edge => {
            const handle = document.createElement('div'); handle.className = `resize-handle ${edge}`; handle.dataset.edge = edge;
            handle.addEventListener('pointerdown', (e) => WindowManager.startResize(e, windowId, edge));
            resizeWrapper.appendChild(handle);
        });
        windowEl.appendChild(resizeWrapper);
    },

    focusWindow: (windowId) => {
        if (state.activeWindowId && state.openWindows[state.activeWindowId] && state.openWindows[state.activeWindowId].element) {
            const oldActiveWinData = state.openWindows[state.activeWindowId];
            oldActiveWinData.element.classList.remove('active');
            if (oldActiveWinData.isModal) oldActiveWinData.element.removeAttribute('aria-modal');
            Taskbar.setAppActive(state.activeWindowId, false);
        }
        const winData = state.openWindows[windowId];
        if (winData && winData.element) {
            winData.element.style.zIndex = state.nextZIndex++;
            winData.element.classList.add('active');
            if (winData.isModal) winData.element.setAttribute('aria-modal', 'true');
            state.activeWindowId = windowId;
            Taskbar.setAppActive(windowId, true, winData.isMinimized);
            if (winData.isMinimized) { WindowManager.restoreWindow(windowId); }
        }
    },

    closeWindow: (windowId) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.element && !winData.isClosing) {
            winData.isClosing = true;
            if (winData.appInstance && typeof winData.appInstance.onClose === 'function') {
                if (winData.appInstance.onClose(winData.element) === false) { winData.isClosing = false; return; }
            }
            SoundPlayer.playSound('windowClose');
            winData.element.style.opacity = '0'; winData.element.style.transform = 'scale(0.8)';
            const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-medium') || '0.25s') * 1000;
            setTimeout(() => {
                if (winData.element) winData.element.remove();
                Taskbar.removeApp(windowId); delete state.openWindows[windowId];
                if (state.activeWindowId === windowId) {
                    state.activeWindowId = null; let maxZ = -1, nextFocusId = null;
                    for (const id in state.openWindows) {
                        if (state.openWindows[id].element && !state.openWindows[id].isMinimized) {
                            const currentZ = parseInt(state.openWindows[id].element.style.zIndex) || 0;
                            if (currentZ > maxZ) { maxZ = currentZ; nextFocusId = id; }
                        }
                    }
                    if (nextFocusId) WindowManager.focusWindow(nextFocusId);
                    else if (domElements.desktopElement) domElements.desktopElement.focus();
                }
            }, transitionDuration);
        }
    },

    minimizeWindow: (windowId) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.element && !winData.isMinimized) {
            winData.isMinimized = true; winData.lastFocusedElement = document.activeElement;
            winData.element.classList.add('minimized-state'); Taskbar.setAppMinimized(windowId, true);
            if (state.activeWindowId === windowId) {
                state.activeWindowId = null; let maxZ = -1, nextFocusId = null;
                for (const id in state.openWindows) {
                    if (state.openWindows[id].element && !state.openWindows[id].isMinimized && id !== windowId) {
                        const currentZ = parseInt(state.openWindows[id].element.style.zIndex) || 0;
                        if (currentZ > maxZ) { maxZ = currentZ; nextFocusId = id; }
                    }
                }
                if (nextFocusId) WindowManager.focusWindow(nextFocusId);
                else { Taskbar.setAppActive(windowId, false); if (domElements.desktopElement) domElements.desktopElement.focus(); }
            }
        }
    },

    restoreWindow: (windowId) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.element && winData.isMinimized) {
            winData.isMinimized = false; winData.element.classList.remove('minimized-state');
            Taskbar.setAppMinimized(windowId, false); WindowManager.focusWindow(windowId);
            if (winData.lastFocusedElement && typeof winData.lastFocusedElement.focus === 'function' && winData.element.contains(winData.lastFocusedElement)) {
                setTimeout(() => winData.lastFocusedElement.focus(), 0);
            } else if (winData.element.querySelector('.window-content')) {
                setTimeout(() => winData.element.querySelector('.window-content').focus(), 0);
            }
        }
    },

    toggleMaximize: (windowId) => {
        const winData = state.openWindows[windowId]; 
        if (!winData || !winData.element || winData.isForcedMaximized) return; // Don't allow toggle if forced maximized

        const maximizeButton = winData.element.querySelector('.maximize-btn');
        const maximizeIcon = maximizeButton ? maximizeButton.querySelector('.maximize-icon') : null;
        const restoreIconSvg = '<svg class="window-control-icon restore-icon" viewBox="0 0 10 10"><rect x="2" y="0" width="8" height="8" rx="1"/><rect x="0" y="2" width="8" height="8" rx="1" style="fill:var(--window-bg); stroke-width:0.5px; stroke:var(--window-title-bar-text);"/></svg>';
        const maximizeIconSvg = '<svg class="window-control-icon maximize-icon" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="1"/></svg>';

        const resizeHandleWrapper = winData.element.querySelector('.resize-handle-wrapper');
        if (!maximizeButton || !resizeHandleWrapper) { 
            console.error("WM: Maximize controls/handles not found for window:", windowId); 
            return; 
        }
        winData.element.style.transition = 'all var(--transition-fast)';
        if (winData.isMaximized) { // Restore
            if (winData.originalRect) { // Ensure originalRect exists
                winData.element.style.left = winData.originalRect.x + 'px'; 
                winData.element.style.top = winData.originalRect.y + 'px';
                winData.element.style.width = winData.originalRect.width + 'px'; 
                winData.element.style.height = winData.originalRect.height + 'px';
            } else { // Fallback if originalRect is missing (should not happen in normal flow)
                winData.element.style.left = '10%'; 
                winData.element.style.top = '10%';
                winData.element.style.width = '80vw'; 
                winData.element.style.height = `calc(80vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            }
            winData.isMaximized = false; 
            if (maximizeIcon) maximizeIcon.outerHTML = maximizeIconSvg;
            maximizeButton.title = "Maximize"; 
            maximizeButton.setAttribute('aria-label', "Maximize");
            resizeHandleWrapper.style.display = 'block';
        } else { // Maximize
            winData.originalRect = { x: winData.element.offsetLeft, y: winData.element.offsetTop, width: winData.element.offsetWidth, height: winData.element.offsetHeight };
            winData.element.style.left = '0px'; 
            winData.element.style.top = '0px';
            winData.element.style.width = '100vw'; 
            winData.element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = true; 
            if (maximizeIcon) maximizeIcon.outerHTML = restoreIconSvg;
            maximizeButton.title = "Restore"; 
            maximizeButton.setAttribute('aria-label', "Restore");
            resizeHandleWrapper.style.display = 'none';
        }
        const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-fast') || '0.15s') * 1000;
        setTimeout(() => { 
            if (winData.element) { 
                winData.element.style.transition = `opacity var(--transition-medium), transform var(--transition-medium), left var(--transition-medium), top var(--transition-medium), width var(--transition-medium), height var(--transition-medium)`; 
            } 
        }, transitionDuration);
        WindowManager.focusWindow(windowId);
    },

    startDrag: (event, windowId) => {
        const winData = state.openWindows[windowId];
        // Prevent drag if forced maximized OR if already maximized (unless snapping is desired for maximized windows)
        if (winData && winData.element && !winData.isMaximized && !winData.isForcedMaximized && (event.button === 0 || event.pointerType === 'touch')) {
            WindowManager.focusWindow(windowId); 
            const coords = getEventCoordinates(event);
            state.dragInfo = { 
                element: winData.element, 
                id: windowId, 
                offsetX: coords.x - winData.element.offsetLeft, 
                offsetY: coords.y - winData.element.offsetTop, 
                type: 'window-drag', 
                pointerId: event.pointerId, 
                isActive: true // Window drag is active immediately
            }; 
            winData.element.style.cursor = 'grabbing'; 
            document.body.style.cursor = 'grabbing';
            // Use target (titleBar) for pointer capture, as element might be large.
            if (event.target.setPointerCapture) { 
                try { event.target.setPointerCapture(event.pointerId); } catch(err) { console.warn("Pointer capture failed:", err); } 
            }
        }
    },

    startResize: (event, windowId, edge) => {
        const winData = state.openWindows[windowId];
        // Prevent resize if forced maximized OR if already maximized
        if (winData && winData.element && !winData.isMaximized && !winData.isForcedMaximized && (event.button === 0 || event.pointerType === 'touch')) {
            WindowManager.focusWindow(windowId); 
            const coords = getEventCoordinates(event);
            state.dragInfo = { 
                element: winData.element, 
                id: windowId, 
                type: 'window-resize', 
                resizeEdge: edge, 
                initialX: coords.x, 
                initialY: coords.y, 
                initialLeft: winData.element.offsetLeft, 
                initialTop: winData.element.offsetTop, 
                initialWidth: winData.element.offsetWidth, 
                initialHeight: winData.element.offsetHeight, 
                pointerId: event.pointerId, 
                isActive: true // Resize is active immediately
            }; 
            document.body.style.cursor = getComputedStyle(event.target).cursor;
            // Resize handles are the direct target for capture.
            if (event.target.setPointerCapture) { 
                try { event.target.setPointerCapture(event.pointerId); } catch(err) { console.warn("Pointer capture failed:", err); }
            }
            event.stopPropagation(); // Prevent title bar drag from starting if handle is on title bar edge
        }
    },

    handleGlobalPointerMove: (event) => {
        if (!state.dragInfo.element || !state.dragInfo.type) return;
        requestAnimationFrame(() => {
            if (!state.dragInfo.element || !state.dragInfo.type) return;
            const coords = getEventCoordinates(event);
            const el = state.dragInfo.element;
            if (state.dragInfo.type === 'window-drag') { 
                WindowManager._handleWindowDragMove(el, coords); 
            } else if (state.dragInfo.type === 'window-resize') { 
                WindowManager._handleWindowResizeMove(el, coords); 
            } else if (state.dragInfo.type === 'icon-drag') {
                // Call DesktopManager to activate drag if threshold met
                if (!state.dragInfo.isActive) {
                    const DRAG_THRESHOLD = 5; // pixels
                    const dx = coords.x - (state.dragInfo.initialPointerX || coords.x);
                    const dy = coords.y - (state.dragInfo.initialPointerY || coords.y);
                    if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) {
                        DesktopManager.activatePendingIconDrag(event.pointerId || state.dragInfo.pointerId); // Pass pointerId
                    }
                }
                // If drag is active (either just activated or previously active), move the icon
                if (state.dragInfo.isActive) {
                    WindowManager._handleIconDragMove(el, coords); 
                }
            }
        });
    },

    _handleWindowDragMove: (element, coords) => {
        let newX = coords.x - state.dragInfo.offsetX; let newY = coords.y - state.dragInfo.offsetY;
        element.style.left = newX + 'px'; element.style.top = newY + 'px';
        WindowManager.checkSnap(element, coords.x, coords.y);
    },

    _handleWindowResizeMove: (element, coords) => {
        const dx = coords.x - state.dragInfo.initialX; const dy = coords.y - state.dragInfo.initialY;
        let newX = state.dragInfo.initialLeft, newY = state.dragInfo.initialTop;
        let newW = state.dragInfo.initialWidth, newH = state.dragInfo.initialHeight;
        const minWidth = parseInt(getComputedStyle(element).minWidth) || 150;
        const minHeight = parseInt(getComputedStyle(element).minHeight) || 100;
        if (state.dragInfo.resizeEdge.includes('e')) newW = Math.max(minWidth, state.dragInfo.initialWidth + dx);
        if (state.dragInfo.resizeEdge.includes('s')) newH = Math.max(minHeight, state.dragInfo.initialHeight + dy);
        if (state.dragInfo.resizeEdge.includes('w')) {
            const proposedWidth = state.dragInfo.initialWidth - dx;
            if (proposedWidth >= minWidth) { newW = proposedWidth; newX = state.dragInfo.initialLeft + dx; }
            else { newW = minWidth; newX = state.dragInfo.initialLeft + (state.dragInfo.initialWidth - minWidth); }
        }
        if (state.dragInfo.resizeEdge.includes('n')) {
            const proposedHeight = state.dragInfo.initialHeight - dy;
            if (proposedHeight >= minHeight) { newH = proposedHeight; newY = state.dragInfo.initialTop + dy; }
            else { newH = minHeight; newY = state.dragInfo.initialTop + (state.dragInfo.initialHeight - minHeight); }
        }
        element.style.left = newX + 'px'; element.style.top = newY + 'px';
        element.style.width = newW + 'px'; element.style.height = newH + 'px';
    },

    _handleIconDragMove: (element, coords) => {
        // This function now ONLY handles the visual movement of an ALREADY ACTIVE icon drag.
        // Activation, class changes, z-index, and pointer capture are handled by DesktopManager.activatePendingIconDrag.
        if (!state.dragInfo.isActive) return; // Should not happen if called correctly

        let newX = coords.x - state.dragInfo.offsetX;
        let newY = coords.y - state.dragInfo.offsetY;
        const desktopRect = domElements.desktopElement.getBoundingClientRect();
        // Use offsetWidth/Height which are readily available and correct for the element
        newX = Math.max(0, Math.min(newX, desktopRect.width - element.offsetWidth));
        newY = Math.max(0, Math.min(newY, desktopRect.height - element.offsetHeight));
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
    },

    handleGlobalPointerUp: (event) => {
        if (state.dragInfo.element) {
            const currentDragType = state.dragInfo.type;
            const currentPointerId = state.dragInfo.pointerId; // Capture before reset by finalizeIconDragOrTap

            if (currentDragType === 'icon-drag') {
                DesktopManager.finalizeIconDragOrTap(currentPointerId); 
                // DesktopManager.finalizeIconDragOrTap now handles:
                // - classList.remove('dragging')
                // - resetting z-index (if it was changed by DM)
                // - snapping to grid
                // - saving positions
                // - playing sound
                // - releasing pointer capture (if held by desktopElement)
                // - resetting state.dragInfo for icon drags
            } else if (currentDragType === 'window-drag') {
                WindowManager.applySnap(state.dragInfo.element);
                if (state.dragInfo.element) state.dragInfo.element.style.cursor = 'grab';
                 if (state.dragInfo.isActive && state.dragInfo.element.releasePointerCapture && currentPointerId !== undefined) {
                    try { state.dragInfo.element.releasePointerCapture(currentPointerId); } catch(err) {}
                }
                 state.dragInfo = { element: null, offsetX: 0, offsetY: 0, type: null, id: null, resizeEdge: null, initialPointerX: 0, initialPointerY: 0, pointerId: undefined, isActive: false };
            } else if (currentDragType === 'window-resize') {
                 if (state.dragInfo.isActive && state.dragInfo.element.releasePointerCapture && currentPointerId !== undefined) {
                    try { state.dragInfo.element.releasePointerCapture(currentPointerId); } catch(err) {}
                }
                state.dragInfo = { element: null, offsetX: 0, offsetY: 0, type: null, id: null, resizeEdge: null, initialPointerX: 0, initialPointerY: 0, pointerId: undefined, isActive: false };
            } else {
                 // If it's not an icon, window, or resize drag, but dragInfo was set, clear it.
                 state.dragInfo = { element: null, offsetX: 0, offsetY: 0, type: null, id: null, resizeEdge: null, initialPointerX: 0, initialPointerY: 0, pointerId: undefined, isActive: false };
            }
        } else {
             // Fallback clear if dragInfo.element was somehow null but dragInfo existed
            state.dragInfo = { element: null, offsetX: 0, offsetY: 0, type: null, id: null, resizeEdge: null, initialPointerX: 0, initialPointerY: 0, pointerId: undefined, isActive: false };
        }
        
        // These should be reset regardless of drag type if a drag operation was potentially underway.
        document.body.style.cursor = 'default';
        if (domElements.snapPreviewElement) domElements.snapPreviewElement.classList.add('hidden');
        state.snapTarget = null; // Reset snap target
    },

    checkSnap: (element, cursorX, cursorY) => {
        if (!domElements.snapPreviewElement || !element) return;

        // Disable snapping for very small screens or if window is forced maximized
        const winData = state.openWindows[element.id];
        if (window.innerWidth < 768 || (winData && winData.isForcedMaximized)) { // Increased threshold for disabling snap
            if (state.snapTarget) { // If a snap target was active, hide preview
                domElements.snapPreviewElement.classList.add('hidden');
                state.snapTarget = null;
            }
            return;
        }

        const snapZone = CONSTANTS.SNAP_ZONE_THRESHOLD; 
        let newSnapTarget = null;
        if (cursorY < snapZone) newSnapTarget = 'top';
        else if (cursorX < snapZone) newSnapTarget = 'left';
        else if (cursorX > window.innerWidth - snapZone) newSnapTarget = 'right';
        
        if (newSnapTarget !== state.snapTarget) {
            state.snapTarget = newSnapTarget;
            if (state.snapTarget) {
                domElements.snapPreviewElement.classList.remove('hidden');
                let rect = { x: 0, y: 0, width: '100vw', height: `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)` };
                if (state.snapTarget === 'left') rect = { x: 0, y: 0, width: '50vw', height: `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)` };
                if (state.snapTarget === 'right') rect = { x: '50vw', y: 0, width: '50vw', height: `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)` };
                domElements.snapPreviewElement.style.left = typeof rect.x === 'string' ? rect.x : rect.x + 'px';
                domElements.snapPreviewElement.style.top = typeof rect.y === 'string' ? rect.y : rect.y + 'px';
                domElements.snapPreviewElement.style.width = rect.width; 
                domElements.snapPreviewElement.style.height = rect.height;
            } else { 
                domElements.snapPreviewElement.classList.add('hidden'); 
            }
        }
    },

    applySnap: (element) => {
        if (!element) return; 
        const windowId = element.id; 
        const winData = state.openWindows[windowId]; 
        if (!winData) return;

        // If snapping is disabled (e.g., small screen) or no snap target, just ensure window is within bounds.
        if (window.innerWidth < 768 || !state.snapTarget) {
            const currentX = element.offsetLeft, currentY = element.offsetTop; 
            const winWidth = element.offsetWidth;
            const titleBarHeight = element.querySelector('.title-bar') ? element.querySelector('.title-bar').offsetHeight : 34;
            const minVisibleWidth = 80; 
            const minVisibleHeight = titleBarHeight;
            const newX = Math.max(-winWidth + minVisibleWidth, Math.min(currentX, window.innerWidth - minVisibleWidth));
            const newY = Math.max(0, Math.min(currentY, window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - minVisibleHeight));
            element.style.left = newX + 'px'; 
            element.style.top = newY + 'px'; 
            if (state.snapTarget) { // Clear snap target if it was set but not applied due to screen size
                 state.snapTarget = null; 
                 if (domElements.snapPreviewElement) domElements.snapPreviewElement.classList.add('hidden');
            }
            return;
        }

        // Apply actual snap if a target is set and screen is large enough
        if (!winData.isMaximized && !winData.isForcedMaximized) { // Store original only if not already maximized or forced
            winData.originalRect = { x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }; 
        }
        
        const maximizeButton = element.querySelector('.maximize-btn');
        const maximizeIcon = maximizeButton ? maximizeButton.querySelector('.maximize-icon, .restore-icon') : null; // Select either
        const restoreIconSvg = '<svg class="window-control-icon restore-icon" viewBox="0 0 10 10"><rect x="2" y="0" width="8" height="8" rx="1"/><rect x="0" y="2" width="8" height="8" rx="1" style="fill:var(--window-bg); stroke-width:0.5px; stroke:var(--window-title-bar-text);"/></svg>';
        const maximizeIconSvg = '<svg class="window-control-icon maximize-icon" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" rx="1"/></svg>';
        const resizeHandleWrapper = element.querySelector('.resize-handle-wrapper');

        element.style.transition = 'all var(--transition-medium)';
        
        if (state.snapTarget === 'top') {
            element.style.left = '0px'; element.style.top = '0px'; 
            element.style.width = '100vw'; element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = true; 
            if (maximizeIcon) maximizeIcon.outerHTML = restoreIconSvg;
            if (maximizeButton) { maximizeButton.title = "Restore"; maximizeButton.setAttribute('aria-label', "Restore"); }
            if (resizeHandleWrapper) resizeHandleWrapper.style.display = 'none';
        } else if (state.snapTarget === 'left') {
            element.style.left = '0px'; element.style.top = '0px'; 
            element.style.width = '50vw'; element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = false; // Snapped to side is not fully maximized
            if (maximizeIcon) maximizeIcon.outerHTML = maximizeIconSvg;
            if (maximizeButton) { maximizeButton.title = "Maximize"; maximizeButton.setAttribute('aria-label', "Maximize"); }
            if (resizeHandleWrapper) resizeHandleWrapper.style.display = 'block';
        } else if (state.snapTarget === 'right') {
            element.style.left = '50vw'; element.style.top = '0px'; 
            element.style.width = '50vw'; element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = false; // Snapped to side is not fully maximized
            if (maximizeIcon) maximizeIcon.outerHTML = maximizeIconSvg;
            if (maximizeButton) { maximizeButton.title = "Maximize"; maximizeButton.setAttribute('aria-label', "Maximize"); }
            if (resizeHandleWrapper) resizeHandleWrapper.style.display = 'block';
        }
        
        const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-medium') || '.25s') * 1000;
        setTimeout(() => { 
            if (element) { 
                element.style.transition = `opacity var(--transition-medium), transform var(--transition-medium), left var(--transition-medium), top var(--transition-medium), width var(--transition-medium), height var(--transition-medium)`; 
            } 
        }, transitionDuration);
        
        state.snapTarget = null; 
        if (domElements.snapPreviewElement) domElements.snapPreviewElement.classList.add('hidden');
    }
};