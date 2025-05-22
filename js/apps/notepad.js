import { state } from '../core/state.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { sanitizeFilename } from '../core/utils.js';
import { DesktopManager } from '../managers/desktopManager.js'; // For refreshing icons

const NotepadAppMethods = {
    onClose: (internalState, currentTextareaValue) => {
        // Check if content changed from last saved state
        internalState.dirty = currentTextareaValue !== internalState.currentContent;
        if (internalState.dirty) {
            return confirm(`${internalState.fileName} - Notepad: You have unsaved changes. Are you sure you want to close?`);
        }
        return true; // Allow close if not dirty
    }
};

export const notepadAppConfig = {
    name: 'Notepad', icon: '📝', width: 550, height: 450, allowMultiple: true, autoFocusContent: false,
    launch: async (windowId, contentArea, params) => {
        contentArea.classList.add('notepad-app-content'); // Add this line
        const internalState = {
            dirty: false,
            currentContent: '',
            filePath: params.filePath || null,
            fileName: params.filePath ? FileSystemManager._getPathInfo(params.filePath).name : "Untitled.txt"
        };

        const win = state.openWindows[windowId];
        if (win && win.element) { // Update window title
            const titleSpan = win.element.querySelector('.title-bar .title');
            if (titleSpan) titleSpan.textContent = `${internalState.fileName} - Notepad`;
        }

        contentArea.innerHTML = `
            <textarea id="notepad-textarea-${windowId}" class="notepad-textarea" spellcheck="false" aria-label="Notepad text area"></textarea>
            <div class="notepad-controls">
                <button id="notepad-save-${windowId}" aria-label="Save content">💾 Save</button>
                <button id="notepad-save-as-${windowId}" aria-label="Save content as new file">💾 Save As...</button>
                <button id="notepad-clear-${windowId}" aria-label="Clear content">🗑️ Clear</button>
                <span class="notepad-status" id="notepad-status-${windowId}"></span>
            </div>`;

        const textarea = contentArea.querySelector(`#notepad-textarea-${windowId}`);
        const statusElement = contentArea.querySelector(`#notepad-status-${windowId}`);

        if (internalState.filePath) {
            try {
                const fileItem = await FileSystemManager.getItem(internalState.filePath);
                if (fileItem && fileItem.type === 'file') {
                    internalState.currentContent = fileItem.content || "";
                    textarea.value = internalState.currentContent;
                    statusElement.textContent = "Loaded";
                } else {
                    statusElement.textContent = "Error: File not found";
                    internalState.filePath = null; // Clear path if not found
                }
            } catch (err) {
                console.error("Notepad: Error loading file:", err);
                statusElement.textContent = "Error loading file";
                internalState.filePath = null;
            }
        } else {
            statusElement.textContent = "New file";
        }
        setTimeout(() => textarea.focus(), 50); // Focus after render

        const updateDirtyState = () => {
            const isDirty = textarea.value !== internalState.currentContent;
            if (internalState.dirty !== isDirty) {
                internalState.dirty = isDirty;
                statusElement.textContent = internalState.dirty ? "Unsaved changes" : (internalState.filePath ? "Saved" : "New file (unsaved)");
                if (win && win.element) {
                    const titleSpan = win.element.querySelector('.title-bar .title');
                    if (titleSpan) titleSpan.textContent = `${isDirty ? '*' : ''}${internalState.fileName} - Notepad`;
                }
            }
        };
        textarea.addEventListener('input', updateDirtyState);

        const saveFile = async (isSaveAs = false) => {
            let savePath = internalState.filePath;
            let newFileName = internalState.fileName;

            if (isSaveAs || !savePath) {
                newFileName = prompt("Save As:", internalState.fileName || "Untitled.txt");
                if (!newFileName) return false; // User cancelled
                newFileName = sanitizeFilename(newFileName);
                if (!newFileName.toLowerCase().endsWith('.txt')) newFileName += '.txt';
                // Default save to /Documents/ if no path, or use parent of current path
                const parentDir = internalState.filePath ? FileSystemManager._getPathInfo(internalState.filePath).parentPath : '/Documents/';
                savePath = parentDir + newFileName;

                if (savePath !== internalState.filePath) { // If new path or different name
                    const existing = await FileSystemManager.getItem(savePath).catch(()=>null);
                    if (existing && !confirm(`File "${newFileName}" already exists. Overwrite?`)) return false;
                }
            }

            try {
                await FileSystemManager.createFile(savePath, textarea.value);
                internalState.currentContent = textarea.value;
                internalState.filePath = savePath;
                internalState.fileName = newFileName;
                updateDirtyState(); // Will set status to "Saved" and update title
                statusElement.textContent = "File Saved"; // Explicitly set

                if (win && win.element) { // Re-update title in case filename changed
                    const titleSpan = win.element.querySelector('.title-bar .title');
                    if (titleSpan) titleSpan.textContent = `${internalState.fileName} - Notepad`;
                }
                // Refresh desktop/FE if file was saved in a relevant location
                if (savePath.startsWith('/Desktop/')) await DesktopManager.renderIcons();
                Object.values(state.openWindows).forEach(w => {
                   if (w.appId === 'fileExplorer' && w.appInstance && typeof w.appInstance.refresh === 'function') {
                       w.appInstance.refresh();
                   }
                });
                return true;
            } catch (err) {
                console.error("Notepad: Error saving file:", err);
                statusElement.textContent = "Error saving file";
                alert("Failed to save file.");
                return false;
            }
        };
        contentArea.querySelector(`#notepad-save-${windowId}`).onclick = () => saveFile(false);
        contentArea.querySelector(`#notepad-save-as-${windowId}`).onclick = () => saveFile(true);
        contentArea.querySelector(`#notepad-clear-${windowId}`).onclick = () => {
            if (internalState.dirty && !confirm("You have unsaved changes. Are you sure you want to clear the content?")) return;
            textarea.value = '';
            updateDirtyState();
            statusElement.textContent = "Content cleared.";
        };
        return { onClose: () => NotepadAppMethods.onClose(internalState, textarea.value) };
    }
};