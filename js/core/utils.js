import { state } from './state.js';
import { AppRegistry } from '../apps/appRegistry.js'; // Needs AppRegistry for getAppConfig, will be defined later

/** Generates a unique ID for windows. */
export function generateId() { return `window-${state.nextWindowId++}`; }

/** Retrieves app configuration by its ID. */
export function getAppConfig(appId) {
    // AppRegistry might not be fully initialized when this is first called.
    // So, ensure we access `apps` property safely.
    if (AppRegistry && AppRegistry.apps && AppRegistry.apps[appId]) {
        return AppRegistry.apps[appId];
    }
    // Fallback for early calls or unknown apps during initialization phases
    return { name: 'Unknown App', icon: '❓', launch: () => {}, width: 600, height: 400 };
}

/** Gets event coordinates, handling both mouse and touch events. */
export function getEventCoordinates(event) {
    if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
}

/** Sanitizes a string to be a valid filename. */
export function sanitizeFilename(name) {
    if (typeof name !== 'string') name = String(name);
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\.$/, '').trim() || "Untitled";
}

/** Copies text to the clipboard. */
export const copyTextToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy text to clipboard:', err);
            // Fallback for older browsers or insecure contexts if needed,
            // but for modern web apps, navigator.clipboard is preferred.
        });
    } else {
        // Fallback for browsers that do not support navigator.clipboard
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; // Prevent scrolling to bottom of page in MS Edge.
        textarea.style.opacity = '0'; // Hide it
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback: Failed to copy text to clipboard:', err);
        }
        document.body.removeChild(textarea);
    }
};

/** Shows an in-app prompt dialog. */
export function showInAppPrompt(message, defaultValue = '') {
    return new Promise(resolve => {
        const dialogOverlay = document.createElement('div');
        dialogOverlay.classList.add('in-app-dialog-overlay');
        dialogOverlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000; /* Ensure it's on top of everything */
        `;

        const dialogBox = document.createElement('div');
        dialogBox.classList.add('in-app-dialog-box');
        dialogBox.style.cssText = `
            background: var(--window-bg);
            border: 1px solid var(--border-color);
            box-shadow: var(--window-shadow);
            padding: 20px;
            border-radius: 5px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            max-width: 400px;
            width: 90%;
        `;

        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messageElement.style.color = 'var(--text-color)';

        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = defaultValue;
        inputElement.style.cssText = `
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: 3px;
            background: var(--input-bg);
            color: var(--input-text-color);
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.classList.add('dialog-button');
        okButton.style.cssText = `
            padding: 8px 15px;
            background: var(--button-bg);
            color: var(--button-text-color);
            border: 1px solid var(--button-border);
            border-radius: 3px;
            cursor: pointer;
        `;

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.classList.add('dialog-button');
        cancelButton.style.cssText = `
            padding: 8px 15px;
            background: var(--button-bg);
            color: var(--button-text-color);
            border: 1px solid var(--button-border);
            border-radius: 3px;
            cursor: pointer;
        `;

        okButton.onclick = () => {
            document.body.removeChild(dialogOverlay);
            resolve(inputElement.value);
        };

        cancelButton.onclick = () => {
            document.body.removeChild(dialogOverlay);
            resolve(null);
        };

        inputElement.onkeydown = (e) => {
            if (e.key === 'Enter') {
                okButton.click();
            } else if (e.key === 'Escape') {
                cancelButton.click();
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(okButton);
        dialogBox.appendChild(messageElement);
        dialogBox.appendChild(inputElement);
        dialogBox.appendChild(buttonContainer);
        dialogOverlay.appendChild(dialogBox);
        document.body.appendChild(dialogOverlay);
        // Trigger animation by adding 'show' class after a slight delay
        setTimeout(() => dialogOverlay.classList.add('show'), 10);

        inputElement.focus();
        inputElement.select();

        // Function to clean up and resolve
        const cleanup = (result) => {
            dialogOverlay.classList.remove('show');
            dialogOverlay.addEventListener('transitionend', () => {
                if (dialogOverlay.parentNode) {
                    dialogOverlay.parentNode.removeChild(dialogOverlay);
                }
                resolve(result);
            }, { once: true });
        };

        okButton.onclick = () => cleanup(inputElement.value);
        cancelButton.onclick = () => cleanup(null);
        inputElement.onkeydown = (e) => {
            if (e.key === 'Enter') {
                okButton.click();
            } else if (e.key === 'Escape') {
                cancelButton.click();
            }
        };
    });
}

/** Shows an in-app confirmation dialog. */
export function showInAppConfirm(message) {
    return new Promise(resolve => {
        const dialogOverlay = document.createElement('div');
        dialogOverlay.classList.add('in-app-dialog-overlay');

        const dialogBox = document.createElement('div');
        dialogBox.classList.add('in-app-dialog-box');

        const messageElement = document.createElement('p');
        messageElement.textContent = message;

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('dialog-button-container');

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.classList.add('dialog-button');

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.classList.add('dialog-button');

        // Function to clean up and resolve
        const cleanup = (result) => {
            dialogOverlay.classList.remove('show');
            dialogOverlay.addEventListener('transitionend', () => {
                if (dialogOverlay.parentNode) {
                    dialogOverlay.parentNode.removeChild(dialogOverlay);
                }
                resolve(result);
            }, { once: true });
        };

        okButton.onclick = () => cleanup(true);
        cancelButton.onclick = () => cleanup(false);

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(okButton);
        dialogBox.appendChild(messageElement);
        dialogBox.appendChild(buttonContainer);
        dialogOverlay.appendChild(dialogBox);
        document.body.appendChild(dialogOverlay);
        // Trigger animation by adding 'show' class after a slight delay
        setTimeout(() => dialogOverlay.classList.add('show'), 10);
    });
}

/** Shows an in-app alert dialog. */
export function showInAppAlert(message) {
    return new Promise(resolve => {
        const dialogOverlay = document.createElement('div');
        dialogOverlay.classList.add('in-app-dialog-overlay');

        const dialogBox = document.createElement('div');
        dialogBox.classList.add('in-app-dialog-box');

        const messageElement = document.createElement('p');
        messageElement.textContent = message;

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.classList.add('dialog-button');
        okButton.style.alignSelf = 'flex-end'; // Align button to the right

        // Function to clean up and resolve
        const cleanup = () => {
            dialogOverlay.classList.remove('show');
            dialogOverlay.addEventListener('transitionend', () => {
                if (dialogOverlay.parentNode) {
                    dialogOverlay.parentNode.removeChild(dialogOverlay);
                }
                resolve();
            }, { once: true });
        };

        okButton.onclick = cleanup;

        dialogBox.appendChild(messageElement);
        dialogBox.appendChild(okButton);
        dialogOverlay.appendChild(dialogBox);
        document.body.appendChild(dialogOverlay);
        // Trigger animation by adding 'show' class after a slight delay
        setTimeout(() => dialogOverlay.classList.add('show'), 10);

        okButton.focus();
    });
}

/** Extracts the file extension from a filename. */
export function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '';
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}

/** Returns an appropriate icon character for a given file type or filename. */
export function getIconForFileType(filenameOrType, itemType) {
    if (itemType === 'folder') {
        return '📁'; // Folder icon
    }

    const extension = getFileExtension(filenameOrType);
    switch (extension) {
        case 'txt': return '📝';
        case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': return '🖼️';
        // Add more types as needed
        default: return '📄'; // Generic file icon
    }
}
