export const DESKTOP_ICONS_CONFIG = [
    { id: 'icon-notepad', name: 'Notepad', icon: '📝', appId: 'notepad', type: 'app' },
    { id: 'icon-explorer', name: 'File Explorer', icon: '📁', appId: 'fileExplorer', type: 'app' },
    { id: 'icon-imageviewer', name: 'Image Viewer', icon: '🖼️', appId: 'imageViewer', type: 'app' },
    { id: 'icon-browser', name: 'Web Browser', icon: '🌐', appId: 'webBrowser', type: 'app' },
    { id: 'icon-settings', name: 'Settings', icon: '⚙️', appId: 'settings', type: 'app' },
    { id: 'icon-calculator', name: 'Calculator', icon: '🧮', appId: 'calculator', type: 'app' },
    { id: 'icon-recyclebin', name: 'Recycle Bin', icon: '🗑️', appId: 'recycleBin', type: 'app' },
    // Note: The Code Editor icon on the desktop, if one was defined here, would also need updating
    // if you want its desktop icon to match the new simpler editor.
    // Example: { id: 'icon-codeeditor', name: 'Code Editor (Native)', icon: '📝', appId: 'codeEditor', type: 'app' },
];

export const START_MENU_APPS_CONFIG = [
    { name: 'Notepad', icon: '📝', appId: 'notepad' },
    { name: 'File Explorer', icon: '📁', appId: 'fileExplorer' },
    { name: 'Image Viewer', icon: '🖼️', appId: 'imageViewer' },
    { name: 'Web Browser', icon: '🌐', appId: 'webBrowser' },
    { name: 'Calculator', icon: '🧮', appId: 'calculator' },
    { name: 'Settings', icon: '⚙️', appId: 'settings' },
    { name: 'Separator' },
    { name: 'About Web Desktop', icon: '💡', appId: 'about' }
];

// ... (rest of uiConfigs.js remains the same) ...
export const CONTEXT_MENU_DESKTOP_CONFIG = [
    { label: 'New Text File', action: 'new-text-file', icon: '📄+' },
    { label: 'New Folder', action: 'new-folder', icon: '➕📁' },
    { type: 'separator' },
    { label: 'Paste', action: 'paste-item', icon: '📋', disabled: (dataContext) => !dataContext.clipboardHasItems },
    { type: 'separator' },
    { label: 'Change Wallpaper', action: 'change-wallpaper', icon: '🌄' },
    { label: 'Toggle Theme', action: 'toggle-theme', icon: '🎨' },
];

export const CONTEXT_MENU_ICON_CONFIG = [
    { label: 'Open', action: 'open-item', icon: '➡️' },
    { label: 'Rename', action: 'rename-item', icon: '✍️' },
    { label: 'Copy', action: 'copy-item', icon: '📄' },
    { label: 'Cut', action: 'cut-item', icon: '✂️' },
    { label: 'Delete', action: 'delete-item', icon: '🗑️' },
    { type: 'separator' },
    { label: 'Properties', action: 'properties', icon: 'ℹ️' },
];

export const CONTEXT_MENU_FE_ITEM_CONFIG = {
    folder: [
        { label: 'Open', action: 'fe-open', icon: '📂' },
        { label: 'Rename', action: 'fe-rename', icon: '✍️' },
        { label: 'Copy', action: 'fe-copy', icon: '📄' },
        { label: 'Cut', action: 'fe-cut', icon: '✂️' },
        { label: 'Paste', action: 'fe-paste', icon: '📋', disabled: (dataContext) => !dataContext.clipboardHasItems },
        { label: 'Delete', action: 'fe-delete', icon: '🗑️' },
        { type: 'separator' },
        { label: 'Properties', action: 'fe-properties', icon: 'ℹ️' },
    ],
    file: [
        { label: 'Open', action: 'fe-open', icon: '📄' },
        { label: 'Rename', action: 'fe-rename', icon: '✍️' },
        { label: 'Copy', action: 'fe-copy', icon: '📄' },
        { label: 'Cut', action: 'fe-cut', icon: '✂️' },
        // Paste is usually on a folder or background, not a file item itself.
        // { label: 'Paste', action: 'fe-paste', icon: '📋', disabled: (dataContext) => !dataContext.clipboardHasItems }, 
        { label: 'Delete', action: 'fe-delete', icon: '🗑️' },
        { type: 'separator' },
        { label: 'Properties', action: 'fe-properties', icon: 'ℹ️' },
    ],
    recycledItem: [
        { label: 'Restore', action: 'fe-restore', icon: '↩️' },
        { label: 'Delete Permanently', action: 'fe-delete-permanently', icon: '🔥' },
        { type: 'separator' },
        { label: 'Properties', action: 'fe-properties', icon: 'ℹ️' },
    ]
};

export const CONTEXT_MENU_RECYCLE_BIN_BACKGROUND_CONFIG = [
    { label: 'Empty Recycle Bin', action: 'fe-empty-recycle-bin', icon: '🗑️🔥' },
    { type: 'separator' },
    { label: 'Paste', action: 'fe-paste', icon: '📋', disabled: (dataContext) => !dataContext.clipboardHasItems },
    { type: 'separator' },
    { label: 'Properties', action: 'fe-properties', icon: 'ℹ️' },
];

export const CONTEXT_MENU_TEXT_INPUT_CONFIG = [
    { label: 'Cut', action: 'text-cut', icon: '✂️' },
    { label: 'Copy', action: 'text-copy', icon: '📄' },
    { label: 'Paste', action: 'text-paste', icon: '📋' },
    { type: 'separator' },
    { label: 'Select All', action: 'text-select-all', icon: '🌐' },
];

export const WINDOW_CONTROL_ICONS = { minimize: '➖', maximize: '🔲', restore: '🔳', close: '❌' };
