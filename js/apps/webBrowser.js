// No external state imports needed directly for this app's config

export const webBrowserAppConfig = {
    name:'Web Browser', icon:'🌐', width:800, height:600, allowMultiple:true, autoFocusContent:false,
    launch: (windowId, contentArea) => {
        if(!contentArea) return null;
        contentArea.style.display = 'flex';
        contentArea.style.flexDirection = 'column';
        contentArea.style.padding = '0'; 
        contentArea.innerHTML = `
            <div class="web-browser-controls">
                <button id="wb-back-${windowId}" title="Back" aria-label="Back">⬅️</button>
                <button id="wb-forward-${windowId}" title="Forward" aria-label="Forward">➡️</button>
                <button id="wb-refresh-${windowId}" title="Refresh" aria-label="Refresh">🔄</button>
                <input type="url" id="wb-url-${windowId}" placeholder="https://example.com" value="about:blank">
                <button id="wb-go-${windowId}" title="Go" aria-label="Go">Go</button>
            </div>
            <div class="web-browser-iframe-container" id="wb-iframe-container-${windowId}">
                <iframe id="wb-iframe-${windowId}" sandbox="allow-forms allow-modals allow-pointer-lock allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation"></iframe>
                <div class="web-browser-message hidden">Many websites block direct embedding due to security policies (X-Frame-Options or CSP). If a page doesn't load, this is likely the reason.</div>
            </div>`;

        const backBtn = contentArea.querySelector(`#wb-back-${windowId}`);
        const forwardBtn = contentArea.querySelector(`#wb-forward-${windowId}`);
        const refreshBtn = contentArea.querySelector(`#wb-refresh-${windowId}`);
        const urlInput = contentArea.querySelector(`#wb-url-${windowId}`);
        const goBtn = contentArea.querySelector(`#wb-go-${windowId}`);
        const iframe = contentArea.querySelector(`#wb-iframe-${windowId}`);
        const browserMessage = contentArea.querySelector('.web-browser-message');

        const navigate = (url) => {
            let finalUrl = url.trim();
            if (finalUrl === "" || finalUrl === "about:blank") {
                iframe.src = "about:blank";
                urlInput.value = "about:blank"; 
                browserMessage.classList.add('hidden');
                iframe.classList.remove('hidden');
                return;
            }
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                finalUrl = 'https://' + finalUrl;
            }
            iframe.src = "about:blank"; 
            setTimeout(() => { iframe.src = finalUrl; }, 10); 
            urlInput.value = finalUrl; 
            browserMessage.classList.add('hidden');
            iframe.classList.remove('hidden');
        };

        iframe.onload = () => {
            try {
                // Check if iframe is still attached to DOM; if window closed, contentWindow might be null
                if (!iframe.contentWindow) return;

                const currentIframeSrc = iframe.contentWindow.location.href;
                if (currentIframeSrc && currentIframeSrc !== "about:blank") {
                    urlInput.value = currentIframeSrc; 
                    browserMessage.classList.add('hidden');
                    iframe.classList.remove('hidden');
                } else if (urlInput.value !== "about:blank" && urlInput.value !== "") { 
                     browserMessage.classList.remove('hidden');
                     iframe.classList.add('hidden');
                }
            } catch (e) { 
                if (urlInput.value !== "about:blank" && urlInput.value !== "") {
                     browserMessage.classList.remove('hidden');
                     iframe.classList.add('hidden');
                }
            }
        };
        iframe.onerror = () => { 
            browserMessage.classList.remove('hidden');
            iframe.classList.add('hidden');
        };

        goBtn.onclick = () => navigate(urlInput.value);
        urlInput.onkeydown = (e) => { if (e.key === 'Enter') navigate(urlInput.value); };
        backBtn.onclick = () => { try { if(iframe.contentWindow) iframe.contentWindow.history.back(); } catch(e){} };
        forwardBtn.onclick = () => { try { if(iframe.contentWindow) iframe.contentWindow.history.forward(); } catch(e){} };
        refreshBtn.onclick = () => { if (iframe.src && iframe.src !== "about:blank") { try {if(iframe.contentWindow) iframe.contentWindow.location.reload(); } catch(e){}} };

        navigate(urlInput.value); 
        setTimeout(() => urlInput.focus(), 50);
        return {}; // Return a dummy appInstance
    }
};
