import { CONSTANTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { SVG_ICONS } from '../core/svgIcons.js'; // Corrected import
import { generateId, getAppConfig, getEventCoordinates } from '../core/utils.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from '../apps/appRegistry.js';
import { Taskbar } from './taskbar.js';
import { DesktopManager } from './desktopManager.js';
import { domElements } from '../main.js';

export const WindowManager = {
    init: () => {
        if (!domElements.snapPreviewElement) console.error("WM: Snap preview element not found!");
        document.addEventListener('pointermove', WindowManager.handleGlobalPointerMove);
        document.addEventListener('pointerup', WindowManager.handleGlobalPointerUp);
        document.addEventListener('pointercancel', WindowManager.handleGlobalPointerUp);
    };

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
        const initialHeight = appConfig.height || 400;
        const openWinCount = Object.keys(state.openWindows).length;
        const cascadeOffset = (openWinCount % 10) * 25;
        windowEl.style.width = `${initialWidth}px`;
        windowEl.style.height = `${initialHeight}px`;
        windowEl.style.left = `${Math.max(0, Math.min((window.innerWidth - initialWidth) / 2 + cascadeOffset, window.innerWidth - initialWidth - 20))}px`;
        windowEl.style.top = `${Math.max(0, Math.min((window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - initialHeight) / 2 + cascadeOffset, window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - initialHeight - 20))}px`;
        state.openWindows[windowId] = { element: windowEl, title: appConfig.name, appId: appId, isMinimized: false, isMaximized: false, originalRect: null, zIndex: state.nextZIndex++, taskbarButton: null, appInstance: appInstance, isModal: appConfig.isModal || false, };
        windowEl.classList.add('opening');
        requestAnimationFrame(() => { requestAnimationFrame(() => { if (windowEl) windowEl.classList.remove('opening'); }); });
        WindowManager.focusWindow(windowId);
        Taskbar.addApp(windowId, appConfig.name, appConfig.icon);
        if (appConfig.autoFocusContent !== false && contentArea && typeof contentArea.focus === 'function') {
            setTimeout(() => contentArea.focus(), 50);
        }
    };

    _buildWindowShell: (windowId, title, icon) => {
        const windowEl = document.createElement('div');
        windowEl.className = 'app-window';
        windowEl.id = windowId;
        windowEl.setAttribute('role', 'dialog');
        windowEl.setAttribute('aria-label', title);
        windowEl.innerHTML = `
            <div class="title-bar" tabindex="-1">
                <span class="app-icon">${icon || '🚀'}</span>
                <span class="title">${title}</span>
                <div class="window-controls">
                    <button class="minimize-btn" data-action="minimize" title="Minimize" aria-label="Minimize" tabindex="0">${SVG_ICONS.minimize}</button>
                    <button class="maximize-btn" data-action="maximize" title="Maximize" aria-label="Maximize" tabindex="0">${SVG_ICONS.maximize}</button>
                    <button class="close-btn" data-action="close" title="Close" aria-label="Close" tabindex="0">${SVG_ICONS.close}</button>
                </div>
            </div>
            <div class="window-content"></div>`;
        windowEl.addEventListener('pointerdown', (e) => { WindowManager.focusWindow(windowId); if (e.pointerType === 'touch') clearTimeout(state.longPressTimer); }, true);
        const titleBar = windowEl.querySelector('.title-bar');
        if (titleBar) {
            titleBar.addEventListener('pointerdown', (e) => { if (e.target.closest('.window-controls button') || e.target.closest('.resize-handle')) return; WindowManager.startDrag(e, windowId); });
            titleBar.addEventListener('dblclick', (e) => { if (!e.target.closest('.window-controls button')) WindowManager.toggleMaximize(windowId); });
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
    };

    _addResizeHandles: (windowEl, windowId) => {
        const resizeWrapper = document.createElement('div');
        resizeWrapper.className = 'resize-handle-wrapper';
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(edge => {
            const handle = document.createElement('div'); handle.className = `resize-handle ${edge}`; handle.dataset.edge = edge;
            handle.addEventListener('pointerdown', (e) => WindowManager.startResize(e, windowId, edge));
            resizeWrapper.appendChild(handle);
        });
        windowEl.appendChild(resizeWrapper);
    };

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
    };

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
    };

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
    };

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
    };

    toggleMaximize: (windowId) => {
        const winData = state.openWindows[windowId]; if (!winData || !winData.element) return;
        const maximizeButton = winData.element.querySelector('.maximize-btn');
        const resizeHandleWrapper = winData.element.querySelector('.resize-handle-wrapper');
        if (!maximizeButton || !resizeHandleWrapper) { console.error("WM: Maximize controls/handles not found for window:", windowId); return; }
        winData.element.style.transition = 'all var(--transition-fast)';
        if (winData.isMaximized) {
            winData.element.style.left = winData.originalRect.x + 'px'; winData.element.style.top = winData.originalRect.y + 'px';
            winData.element.style.width = winData.originalRect.width + 'px'; winData.element.style.height = winData.originalRect.height + 'px';
            winData.isMaximized = false; maximizeButton.innerHTML = SVG_ICONS.maximize; maximizeButton.title = "Maximize"; maximizeButton.setAttribute('aria-label', "Maximize");
            resizeHandleWrapper.style.display = 'block';
        } else {
            winData.originalRect = { x: winData.element.offsetLeft, y: winData.element.offsetTop, width: winData.element.offsetWidth, height: winData.element.offsetHeight };
            winData.element.style.left = '0px'; winData.element.style.top = '0px';
            winData.element.style.width = '100vw'; winData.element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = true; maximizeButton.innerHTML = SVG_ICONS.restore; maximizeButton.title = "Restore"; maximizeButton.setAttribute('aria-label', "Restore");
            resizeHandleWrapper.style.display = 'none';
        }
        const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-fast') || '0.15s') * 1000;
        setTimeout(() => { if (winData.element) { winData.element.style.transition = `opacity var(--transition-medium), transform var(--transition-medium), left var(--transition-medium), top var(--transition-medium), width var(--transition-medium), height var(--transition-medium)`; } }, transitionDuration);
        WindowManager.focusWindow(windowId);
    };

    startDrag: (event, windowId) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.element && !winData.isMaximized && (event.button === 0 || event.pointerType === 'touch')) {
            WindowManager.focusWindow(windowId); const coords = getEventCoordinates(event);
            state.dragInfo = { element: winData.element, id: windowId, offsetX: coords.x - winData.element.offsetLeft, offsetY: coords.y - winData.element.offsetTop, type: 'window-drag', pointerId: event.pointerId, isActive: true }; // Window drag is active immediately
            winData.element.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing';
            if (event.target.setPointerCapture) { try { event.target.setPointerCapture(event.pointerId); } catch(err) { /* Ignore error: Element might not be in a state to capture pointer, or pointerId is stale. This is expected in some edge cases. */ } }
        }
    };

    startResize: (event, windowId, edge) => {
        const winData = state.openWindows[windowId];
        if (winData && winData.element && !winData.isMaximized && (event.button === 0 || event.pointerType === 'touch')) {
            WindowManager.focusWindow(windowId); const coords = getEventCoordinates(event);
            state.dragInfo = { element: winData.element, id: windowId, type: 'window-resize', resizeEdge: edge, initialX: coords.x, initialY: coords.y, initialLeft: winData.element.offsetLeft, initialTop: winData.element.offsetTop, initialWidth: winData.element.offsetWidth, initialHeight: winData.element.offsetHeight, pointerId: event.pointerId, isActive: true }; // Resize is active immediately
            document.body.style.cursor = getComputedStyle(event.target).cursor;
            if (event.target.setPointerCapture) { try { event.target.setPointerCapture(event.pointerId); } catch(err) { /* Ignore error: Element might not be in a state to capture pointer, or pointerId is stale. This is expected in some edge cases. */ } }
            event.stopPropagation();
        }
    };

    handleGlobalPointerMove: (event) => {
        if (!state.dragInfo.element || !state.dragInfo.type) return;
        requestAnimationFrame(() => {
            if (!state.dragInfo.element || !state.dragInfo.type) return;
            const coords = getEventCoordinates(event);
            const el = state.dragInfo.element;
            if (state.dragInfo.type === 'window-drag') { WindowManager._handleWindowDragMove(el, coords); }
            else if (state.dragInfo.type === 'window-resize') { WindowManager._handleWindowResizeMove(el, coords); }
            else if (state.dragInfo.type === 'icon-drag') { WindowManager._handleIconDragMove(el, coords); }
        });
    };

    _handleWindowDragMove: (element, coords) => {
        let newX = coords.x - state.dragInfo.offsetX; let newY = coords.y - state.dragInfo.offsetY;
        element.style.left = newX + 'px'; element.style.top = newY + 'px';
        WindowManager.checkSnap(element, coords.x, coords.y);
    };

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
    };

    _handleIconDragMove: (element, coords) => {
        // Activate drag if it was pending (first move) and threshold is met
        if (!state.dragInfo.isActive) { // If drag is pending (isActive is false)
            const DRAG_THRESHOLD = 5; // pixels
            // Ensure initialPointerX/Y are available; they should be if type is icon-drag
            const dx = coords.x - (state.dragInfo.initialPointerX || coords.x);
            const dy = coords.y - (state.dragInfo.initialPointerY || coords.y);

            if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) {
                state.dragInfo.isActive = true;
                if (element) { // element should be state.dragInfo.element
                    element.classList.add('dragging');
                    element.style.zIndex = state.nextIconZIndex++;
                    if (element.setPointerCapture && state.dragInfo.pointerId !== undefined) {
                        try { element.setPointerCapture(state.dragInfo.pointerId); } catch (err) { /* Ignore error: Element might not be in a state to capture pointer, or pointerId is stale. This is expected in some edge cases. */ }
                    }
                }
            } else {
                // Threshold not met, don't treat as a drag yet, and don't move the icon.
                return;
            }
        }

        // If we reach here, drag is active (either just became active by meeting threshold, or was already active)
        // Actual move logic
        let newX = coords.x - state.dragInfo.offsetX;
        let newY = coords.y - state.dragInfo.offsetY;
        const desktopRect = domElements.desktopElement.getBoundingClientRect();
        // Use offsetWidth/Height which are readily available and correct for the element
        newX = Math.max(0, Math.min(newX, desktopRect.width - element.offsetWidth));
        newY = Math.max(0, Math.min(newY, desktopRect.height - element.offsetHeight));
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
    };

    handleGlobalPointerUp: (event) => {
        if (state.dragInfo.element) {
            const wasDragActive = state.dragInfo.isActive; // Capture before reset

            if (state.dragInfo.type === 'icon-drag') {
                if (wasDragActive) { // Only do cleanup if drag was actually active
                    state.dragInfo.element.classList.remove('dragging');
                    state.dragInfo.element.style.cursor = 'pointer'; // NEW: Reset cursor to new default
                    const snappedPos = DesktopManager.snapToGrid(state.dragInfo.element.offsetLeft, state.dragInfo.element.offsetTop);
                    state.dragInfo.element.style.left = `${snappedPos.x}px`;
                    state.dragInfo.element.style.top = `${snappedPos.y}px`;
                    if (state.dragInfo.id) {
                        state.iconPositions[state.dragInfo.id] = snappedPos;
                        DesktopManager.saveIconPositions();
                    }
                }
            } else if (state.dragInfo.type === 'window-drag') {
                WindowManager.applySnap(state.dragInfo.element);
                state.dragInfo.element.style.cursor = 'grab';
            }
            // No specific 'up' action for window-resize other than releasing capture

            const pointerIdToRelease = state.dragInfo.pointerId;
            // Only release capture if drag was active (isActive was true) and pointerId is valid
            if (wasDragActive && state.dragInfo.element.releasePointerCapture && pointerIdToRelease !== undefined) {
                try { state.dragInfo.element.releasePointerCapture(pointerIdToRelease); } catch(err) { /* Ignore error: Element might not be in a state to release pointer, or pointerId is stale. This is expected in some edge cases. */ }
            }
        }

        state.dragInfo = { element: null, offsetX: 0, offsetY: 0, type: null, id: null, resizeEdge: null, initialPointerX: 0, initialPointerY: 0, pointerId: undefined, isActive: false };
        document.body.style.cursor = 'default';
        if (domElements.snapPreviewElement) domElements.snapPreviewElement.classList.add('hidden');
        state.snapTarget = null;
    };

    checkSnap: (element, cursorX, cursorY) => {
        if (!domElements.snapPreviewElement || !element) return;
        const snapZone = CONSTANTS.SNAP_ZONE_THRESHOLD; let newSnapTarget = null;
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
                domElements.snapPreviewElement.style.width = rect.width; domElements.snapPreviewElement.style.height = rect.height;
            } else { domElements.snapPreviewElement.classList.add('hidden'); }
        }
    };

    applySnap: (element) => {
        if (!element) return; const windowId = element.id; const winData = state.openWindows[windowId]; if (!winData) return;
        if (!state.snapTarget) {
            const currentX = element.offsetLeft, currentY = element.offsetTop; const winWidth = element.offsetWidth;
            const titleBarHeight = element.querySelector('.title-bar') ? element.querySelector('.title-bar').offsetHeight : 34;
            const minVisibleWidth = 80; const minVisibleHeight = titleBarHeight;
            const newX = Math.max(-winWidth + minVisibleWidth, Math.min(currentX, window.innerWidth - minVisibleWidth));
            const newY = Math.max(0, Math.min(currentY, window.innerHeight - CONSTANTS.TASKBAR_HEIGHT - minVisibleHeight));
            element.style.left = newX + 'px'; element.style.top = newY + 'px'; return;
        }
        if (!winData.isMaximized) { winData.originalRect = { x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }; }
        const maximizeButton = element.querySelector('.maximize-btn'); const resizeHandleWrapper = element.querySelector('.resize-handle-wrapper');
        element.style.transition = 'all var(--transition-medium)';
        if (state.snapTarget === 'top') {
            element.style.left = '0px'; element.style.top = '0px'; element.style.width = '100vw'; element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = true; if (maximizeButton) maximizeButton.innerHTML = SVG_ICONS.restore; if (resizeHandleWrapper) resizeHandleWrapper.style.display = 'none';
        } else if (state.snapTarget === 'left') {
            element.style.left = '0px'; element.style.top = '0px'; element.style.width = '50vw'; element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = false; if (maximizeButton) maximizeButton.innerHTML = SVG_ICONS.maximize; if (resizeHandleWrapper) resizeHandleWrapper.style.display = 'block';
        } else if (state.snapTarget === 'right') {
            element.style.left = '50vw'; element.style.top = '0px'; element.style.width = '50vw'; element.style.height = `calc(100vh - ${CONSTANTS.TASKBAR_HEIGHT}px)`;
            winData.isMaximized = false; if (maximizeButton) maximizeButton.innerHTML = SVG_ICONS.maximize; if (resizeHandleWrapper) resizeHandleWrapper.style.display = 'block';
        }
        const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-medium') || '.25s') * 1000;
        setTimeout(() => { if (element) { element.style.transition = `opacity var(--transition-medium), transform var(--transition-medium), left var(--transition-medium), top var(--transition-medium), width var(--transition-medium), height var(--transition-medium)`; } }, transitionDuration);
        state.snapTarget = null; if (domElements.snapPreviewElement) domElements.snapPreviewElement.classList.add('hidden');
    };
};