import { state } from './state.js';
import { AppRegistry } from '../apps/appRegistry.js'; // Needs AppRegistry for getAppConfig, will be defined later

/** Generates a unique ID for windows. */
export function generateId() { return `window-${state.nextWindowId++}`; };

/** Retrieves app configuration by its ID. */
export function getAppConfig(appId) {
    // AppRegistry might not be fully initialized when this is first called.
    // So, ensure we access `apps` property safely.
    if (AppRegistry && AppRegistry.apps && AppRegistry.apps[appId]) {
        return AppRegistry.apps[appId];
    }
    // Fallback for early calls or unknown apps during initialization phases
    return { name: 'Unknown App', icon: '❓', launch: () => {}, width: 600, height: 400 };
};

/** Gets event coordinates, handling both mouse and touch events. */
export function getEventCoordinates(event) {
    if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
};

/** Sanitizes a string to be a valid filename. */
export function sanitizeFilename(name) {
    if (typeof name !== 'string') name = String(name);
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\.$/, '').trim() || "Untitled";
};

/** Extracts the file extension from a filename. */
export function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '';
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
};

/** Returns an appropriate icon character for a given file type or filename. */
export function getIconForFileType(filenameOrType) {
    const extension = getFileExtension(filenameOrType);
    switch (extension) {
        case 'txt': return '📝';
        case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': return '🖼️';
        // Add more types as needed
        default: return '📄'; // Generic file icon
    }
};