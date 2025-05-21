export const DESKTOP_ICONS_CONFIG = [
    { id: 'icon-notepad', name: 'Notepad', icon: '📝', appId: 'notepad', type: 'app' },
    { id: 'icon-explorer', name: 'File Explorer', icon: '📁', appId: 'fileExplorer', type: 'app' },
    { id: 'icon-imageviewer', name: 'Image Viewer', icon: '🖼️', appId: 'imageViewer', type: 'app' },
    { id: 'icon-browser', name: 'Web Browser', icon: '🌐', appId: 'webBrowser', type: 'app' },
    { id: 'icon-settings', name: 'Settings', icon: '⚙️', appId: 'settings', type: 'app' },
    { id: 'icon-calculator', name: 'Calculator', icon: '🧮', appId: 'calculator', type: 'app' },
    { id: 'icon-recyclebin', name: 'Recycle Bin', icon: '🗑️', appId: 'recycleBin', type: 'app' },
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

export const CONTEXT_MENU_DESKTOP_CONFIG = [
    // { label: 'View', icon: '👁️', subMenu: [ { label: 'Large icons (N/A)', action: 'view-large', icon: '▫️' }, { label: 'Small icons (N/A)', action: 'view-small', icon: '▫️' }, ]},
    // { label: 'Sort by (N/A)', action: 'sort-dummy', icon: '⇅' }, { type: 'separator' },
    { label: 'New Text File', action: 'new-text-file', icon: '📄+' },
    // { label: 'New Folder (N/A)', action: 'new-folder-desktop', icon: '➕📁' },
    { type: 'separator' },
    { label: 'Change Wallpaper', action: 'change-wallpaper', icon: '🌄' },
    { label: 'Toggle Theme', action: 'toggle-theme', icon: '🎨' },
    // { type: 'separator' },
    // { label: 'Display Settings', action: 'display-settings', icon: '🖥️' },
];

export const CONTEXT_MENU_ICON_CONFIG = [
    { label: 'Open', action: 'open-item', icon: '➡️' },
    { label: 'Delete', action: 'delete-item', icon: '🗑️' },
    { label: 'Properties', action: 'properties', icon: 'ℹ️' },
];

export const CONTEXT_MENU_FE_ITEM_CONFIG = {
    folder: [
        { label: 'Open', action: 'fe-open', icon: '📂' },
        { label: 'Delete', action: 'fe-delete', icon: '🗑️' },
        { label: 'Properties', action: 'fe-properties', icon: 'ℹ️' },
    ],
    file: [
        { label: 'Open', action: 'fe-open', icon: '📄' },
        { label: 'Delete', action: 'fe-delete', icon: '🗑️' },
        { label: 'Properties', action: 'fe-properties', icon: 'ℹ️' },
    ]
};