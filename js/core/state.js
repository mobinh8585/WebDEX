export const state = {
    openWindows: {},
    activeWindowId: null,
    nextZIndex: 100,
    nextIconZIndex: 10, // Separate z-index for desktop icons
    nextWindowId: 1,
    defaultWallpaperLight: `url('assets/images/desktop_light_theme_background.png')`,
    defaultWallpaperDark: `url('assets/images/desktop_dark_theme_background.png')`,
    currentTheme: 'light', // Default, will be loaded from localStorage
    dragInfo: { // Holds info about the current drag operation
        element: null,    // The DOM element being dragged/resized
        offsetX: 0,       // Mouse offset from element's left edge
        offsetY: 0,       // Mouse offset from element's top edge
        type: null,       // 'window-drag', 'window-resize', 'icon-drag'
        id: null,         // ID of the window or icon
        resizeEdge: null, // For window resize: 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
        initialX: 0,      // Initial mouse X for resize
        initialY: 0,      // Initial mouse Y for resize
        initialLeft: 0,   // Initial element left for resize
        initialTop: 0,    // Initial element top for resize
        initialWidth: 0,  // Initial element width for resize
        initialHeight: 0, // Initial element height for resize
        initialPointerX: 0, // Pointer X at the start of a potential icon drag
        initialPointerY: 0, // Pointer Y at the start of a potential icon drag
        pointerId: undefined, // To store the pointerId for consistent capture/release
        isActive: false,      // True if the drag operation has actually started (e.g., mouse moved beyond threshold)
    },
    longPressTimer: null,      // Timer for touch long press (context menu)
    lastTouchTime: 0,          // Timestamp of the last touch start (for double tap)
    activeDesktopIconId: null, // ID of the currently selected/active desktop icon
    focusedDesktopIconIndex: -1, // Index for keyboard navigation of desktop icons
    snapTarget: null,          // Current window snap target ('top', 'left', 'right')
    audioContext: null,        // Web Audio API context
    iconPositions: {           // Stores { x, y } for desktop icons, keyed by icon ID
        // Example: 'icon-notepad': { x: 10, y: 10 }
    },
    lastStoredDesktopWidth: 0, // Used to invalidate icon positions if desktop width changes
    iconGridCellSize: { width: 0, height: 0 }, // Calculated size of each grid cell for icons
    isVolumePopupOpen: false,
    masterVolume: 75,          // Initial master volume level (0-100)
    iconsPerRow: 0,            // Calculated number of icons per row on the desktop
    fileSystemReady: false,    // Flag indicating if IndexedDB is initialized
    clipboard: {
        type: null, // 'copy' or 'cut'
        items: []   // Array of { path: string, type: 'file' | 'folder' }
    },
};

// Attempt to load theme and icon positions from localStorage
export function loadInitialStateFromLocalStorage() {
    try {
        const storedTheme = localStorage.getItem('desktop-theme');
        if (storedTheme === 'light' || storedTheme === 'dark') {
            state.currentTheme = storedTheme;
        }
    } catch (e) { console.warn("Error reading theme from localStorage:", e); }

    try {
        const storedVolume = localStorage.getItem('master-volume');
        if (storedVolume !== null) {
            state.masterVolume = parseInt(storedVolume, 10);
        }
    } catch (e) { console.warn("Error reading master volume from localStorage:", e); }

    try {
        const storedIconData = localStorage.getItem('desktop-icon-positions-v2'); // v2 for new structure
        if (storedIconData) {
            const parsedData = JSON.parse(storedIconData);
            state.iconPositions = parsedData.positions || {};
            state.lastStoredDesktopWidth = parsedData.desktopDataWidth || 0; // Corrected property name
        }
    } catch (e) { console.warn("Error reading icon positions from localStorage:", e); }
}
