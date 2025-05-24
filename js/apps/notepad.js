import { state } from '../core/state.js';
import { FileSystemManager } from '../core/fileSystemManager.js';
import { sanitizeFilename, showInAppPrompt, showInAppConfirm, showInAppAlert } from '../core/utils.js';
import { DesktopManager } from '../managers/desktopManager.js'; // For refreshing icons
import { ContextMenu } from '../managers/contextMenu.js'; // Import ContextMenu

const NotepadAppMethods = {
    onClose: async (internalState, currentTextareaValue) => {
        // Check if content changed from last saved state
        internalState.dirty = currentTextareaValue !== internalState.currentContent;
        if (internalState.dirty) {
            return await showInAppConfirm(`${internalState.fileName} - Notepad: You have unsaved changes. Are you sure you want to close?`);
        }
        return true; // Allow close if not dirty
    }
};

export const notepadAppConfig = {
    name: 'Notepad', icon: '📝', width: 550, height: 450, allowMultiple: true, autoFocusContent: false,
    launch: async (windowId, contentArea, params) => {
        contentArea.classList.add('notepad-app-content'); // Add this line
        console.log(`Notepad Launch: params.filePath = ${params.filePath}`);
        const internalState = {
            dirty: false,
            currentContent: '',
            filePath: params.filePath || null,
            fileName: params.filePath ? FileSystemManager._getPathInfo(params.filePath).name : "Untitled.txt"
        };
        console.log(`Notepad Launch: initial internalState.filePath = ${internalState.filePath}`);

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

        // Prevent default context menu and show custom one for text input
        textarea.addEventListener('contextmenu', (e) => {
            ContextMenu.showForTextInput(e, textarea.id);
        });

        if (internalState.filePath) {
            try {
                const fileItem = await FileSystemManager.getItem(internalState.filePath);
                if (fileItem && fileItem.type === 'file') {
                    internalState.currentContent = fileItem.content || "";
                    textarea.value = internalState.currentContent;
                    statusElement.textContent = "Loaded";
                    console.log(`Notepad Load Success: internalState.filePath = ${internalState.filePath}, internalState.fileName = ${internalState.fileName}`);
                } else {
                    statusElement.textContent = "Error: File not found. Saving will act as 'Save As'.";
                    internalState.filePath = null; // Clear path if not found
                    console.log(`Notepad Load Error (File Not Found): internalState.filePath = ${internalState.filePath}`);
                }
            } catch (err) {
                console.error("Notepad: Error loading file:", err);
                statusElement.textContent = "Error loading file. Saving will act as 'Save As'.";
                internalState.filePath = null;
                console.log(`Notepad Load Error (Exception): internalState.filePath = ${internalState.filePath}`);
            }
        } else {
            statusElement.textContent = "New file (unsaved)";
            console.log(`Notepad New File: internalState.filePath = ${internalState.filePath}`);
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
                console.log(`Notepad Dirty State Update: isDirty = ${isDirty}, internalState.filePath = ${internalState.filePath}, internalState.fileName = ${internalState.fileName}`);
            }
        };
        textarea.addEventListener('input', updateDirtyState);

        const saveFile = async (isSaveAs = false) => {
            let targetPath = internalState.filePath;
            let targetFileName = internalState.fileName;

            console.log(`Notepad Save Initiated: isSaveAs = ${isSaveAs}, current internalState.filePath = ${internalState.filePath}, current internalState.fileName = ${internalState.fileName}`);

            // Determine if a prompt is needed (Save As, or Save for a new/unloaded file)
            if (isSaveAs || !internalState.filePath) {
                const promptTitle = isSaveAs ? "Save As:" : "Save File:";
                const promptResult = await showInAppPrompt(promptTitle, internalState.fileName || "Untitled.txt");
                if (promptResult === null) {
                    console.log("Notepad Save: User cancelled prompt.");
                    return false; // User cancelled
                }

                targetFileName = sanitizeFilename(promptResult);
                if (!targetFileName.toLowerCase().endsWith('.txt')) targetFileName += '.txt';

                // Determine parent directory for saving
                let parentDir;
                if (internalState.filePath && !isSaveAs) { // If existing file, but acting as Save As due to no path (e.g., load error)
                    parentDir = FileSystemManager._getPathInfo(internalState.filePath).parentPath;
                } else { // New file or explicit Save As
                    parentDir = '/Documents/'; // Default for new files or explicit Save As
                }
                targetPath = parentDir + targetFileName;

                // Check for overwrite if path changed or it's a new file
                if (targetPath !== internalState.filePath || !internalState.filePath) {
                    const existing = await FileSystemManager.getItem(targetPath).catch(() => null);
                    if (existing && !(await showInAppConfirm(`File "${targetFileName}" already exists. Overwrite?`))) return false;
                }
            }
            // If not isSaveAs and internalState.filePath exists, targetPath and targetFileName are already correct.
            const shouldOverwrite = !isSaveAs && internalState.filePath;

            try {
                await FileSystemManager.createFile(targetPath, textarea.value, shouldOverwrite);
                internalState.currentContent = textarea.value;
                internalState.filePath = targetPath;
                internalState.fileName = targetFileName;
                updateDirtyState();
                statusElement.textContent = "File Saved";

                if (win && win.element) {
                    const titleSpan = win.element.querySelector('.title-bar .title');
                    if (titleSpan) titleSpan.textContent = `${internalState.fileName} - Notepad`;
                }
                if (targetPath.startsWith('/Desktop/')) await DesktopManager.renderIcons();
                Object.values(state.openWindows).forEach(w => {
                   if (w.appId === 'fileExplorer' && w.appInstance && typeof w.appInstance.refresh === 'function') {
                       w.appInstance.refresh();
                   }
                });
                return true;
            } catch (err) {
                console.error("Notepad: Error saving file:", err);
                statusElement.textContent = "Error saving file";
                await showInAppAlert("Failed to save file.");
                return false;
            }
        };
        contentArea.querySelector(`#notepad-save-${windowId}`).onclick = () => saveFile(false);
        contentArea.querySelector(`#notepad-save-as-${windowId}`).onclick = () => saveFile(true);
        contentArea.querySelector(`#notepad-clear-${windowId}`).onclick = async () => {
            if (internalState.dirty && !(await showInAppConfirm("You have unsaved changes. Are you sure you want to clear the content?"))) return;
            textarea.value = '';
            updateDirtyState();
            statusElement.textContent = "Content cleared.";
        };
        return { onClose: () => NotepadAppMethods.onClose(internalState, textarea.value) };
    }
};
