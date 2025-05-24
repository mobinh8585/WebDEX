// No external state imports needed directly for this app's config, only in launch

export const imageViewerAppConfig = {
    name:'Image Viewer', icon:'🖼️', width:600, height:500, allowMultiple:true,
    launch: (windowId, contentArea, params) => {
        if(!contentArea) return null;
        const initialMessage = params && params.initialMessage ? params.initialMessage : "Enter image URL or drag & drop / load file.";
        const initialUrl = params && params.filePath ? `file://${params.filePath}` : (params && params.initialUrl ? params.initialUrl : '');


        contentArea.innerHTML = `
            <div class="image-viewer-controls">
                <input type="url" id="image-url-input-${windowId}" placeholder="Enter image URL" aria-label="Image URL" value="${initialUrl}">
                <button id="load-image-btn-${windowId}">Load URL</button>
                <input type="file" id="image-file-input-${windowId}" accept="image/*" style="display:none">
                <button id="load-file-btn-${windowId}" aria-label="Load image from file">📂 From File</button>
            </div>
            <div class="image-viewer-canvas" id="image-canvas-${windowId}">
                <span class="message">${initialMessage}</span>
                <img id="image-display-${windowId}" src="#" alt="Loaded image" style="display:none">
            </div>`;

        const urlInput = contentArea.querySelector(`#image-url-input-${windowId}`);
        const loadUrlButton = contentArea.querySelector(`#load-image-btn-${windowId}`);
        const fileInput = contentArea.querySelector(`#image-file-input-${windowId}`);
        const loadFileButton = contentArea.querySelector(`#load-file-btn-${windowId}`);
        const canvas = contentArea.querySelector(`#image-canvas-${windowId}`);
        const imageDisplay = contentArea.querySelector(`#image-display-${windowId}`);
        const messageSpan = canvas.querySelector('.message');

        const displayImage = (src, isLocalFile = false) => {
            if (isLocalFile && src.startsWith('file://')) {
                // For actual FSM files, this would need FileSystemManager to read content as DataURL
                // For now, this path is mostly for desktop icons that pass filePath
                if (messageSpan) {
                    messageSpan.textContent = 'Viewing local files from WebDEX FSM is not fully supported via path. Use "From File" or Drag & Drop.';
                    messageSpan.style.display = 'block';
                    imageDisplay.style.display = 'none';
                }
                // A more robust solution:
                // if (params.filePath && FileSystemManager) {
                //     FileSystemManager.getItem(params.filePath).then(file => {
                //         if (file && file.content) { // Assuming image content is stored as base64 string or similar
                //              imageDisplay.src = file.content; // Or appropriate data URL prefix
                //              imageDisplay.style.display = 'block';
                //              if (messageSpan) messageSpan.style.display = 'none';
                //         } else { ... error ... }
                //     }).catch(err => ... error ...);
                // }
                return;
            }

            imageDisplay.src = src;
            imageDisplay.style.display = 'block';
            if (messageSpan) messageSpan.style.display = 'none';
            imageDisplay.onerror = () => {
                imageDisplay.style.display = 'none';
                if (messageSpan) {
                    messageSpan.textContent = 'Error loading image. Invalid URL or format.';
                    messageSpan.style.display = 'block';
                }
            };
        };

        // Handle initial filePath passed from desktop icon or file explorer
        if (params.filePath) {
            displayImage(`file://${params.filePath}`, true);
        } else if (initialUrl) {
            displayImage(initialUrl);
        }


        loadUrlButton.onclick = () => {
            const url = urlInput.value.trim();
            if (url) displayImage(url);
            else if (messageSpan) messageSpan.textContent = 'Please enter an image URL.';
        };
        urlInput.onkeydown = e => { if (e.key === 'Enter') loadUrlButton.click(); };
        loadFileButton.onclick = () => fileInput.click();

        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = ev => displayImage(ev.target.result);
                reader.readAsDataURL(file);
            } else if (file && messageSpan) {
                messageSpan.textContent = 'Invalid file selected. Please choose an image.';
            }
            fileInput.value = null;
        };

        canvas.ondragover = e => { e.preventDefault(); canvas.style.borderColor = 'var(--accent-color)'; };
        canvas.ondragleave = () => { canvas.style.borderColor = 'var(--input-border)'; };
        canvas.ondrop = e => {
            e.preventDefault();
            canvas.style.borderColor = 'var(--input-border)';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = ev => displayImage(ev.target.result);
                reader.readAsDataURL(file);
            } else if (file && messageSpan) {
                messageSpan.textContent = 'Invalid file dropped. Please drop an image file.';
            }
        };
        setTimeout(() => urlInput.focus(), 50);
        return {}; // Return a dummy appInstance
    }
};