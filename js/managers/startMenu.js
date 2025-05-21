import { START_MENU_APPS_CONFIG } from '../core/uiConfigs.js';
import { SoundPlayer } from '../core/soundPlayer.js';
import { AppRegistry } from '../apps/appRegistry.js';
import { domElements } from '../main.js'; // Shared DOM elements

export const StartMenu = {
    init: () => {
        // DOM elements are now in domElements from main.js
        if (!domElements.startMenuElement || !domElements.startMenuAppsList || !domElements.startMenuSearchInput) {
            console.error("FATAL: One or more Start Menu elements are missing!");
            return;
        }
        StartMenu.populate();
        domElements.startMenuElement.addEventListener('click', e => e.stopPropagation()); // Prevent clicks inside from closing
        domElements.startMenuSearchInput.addEventListener('keyup', StartMenu.filterApps);
        domElements.startMenuSearchInput.addEventListener('click', e => e.stopPropagation()); // Prevent search click from closing
    },

    populate: () => {
        if (!domElements.startMenuAppsList) return;
        domElements.startMenuAppsList.innerHTML = ''; // Clear existing items
        START_MENU_APPS_CONFIG.forEach(appConfig => {
            if (appConfig.name === 'Separator') {
                domElements.startMenuAppsList.appendChild(document.createElement('hr'));
                return;
            }
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span class="app-icon">${appConfig.icon || '🚀'}</span> ${appConfig.name}`;
            listItem.dataset.appId = appConfig.appId;
            listItem.dataset.appName = appConfig.name.toLowerCase(); // For case-insensitive search
            listItem.tabIndex = 0; // For keyboard accessibility
            listItem.setAttribute('role', 'menuitem');

            const launch = () => {
                SoundPlayer.playSound('click');
                AppRegistry.launchApp(appConfig.appId);
                StartMenu.hide();
            };
            listItem.addEventListener('click', launch);
            listItem.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    launch();
                }
            });
            domElements.startMenuAppsList.appendChild(listItem);
        });
    },

    filterApps: () => {
        if (!domElements.startMenuSearchInput || !domElements.startMenuAppsList) return;
        const searchTerm = domElements.startMenuSearchInput.value.toLowerCase();
        domElements.startMenuAppsList.querySelectorAll('li').forEach(appItem => {
            const appName = appItem.dataset.appName;
            if (appName && appName.includes(searchTerm)) {
                appItem.style.display = 'flex'; // Show if matches
            } else if (appName) { // Hide if doesn't match (and is an app item)
                appItem.style.display = 'none';
            }
        });
    },

    toggle: () => {
        if (!domElements.startMenuElement) return;
        domElements.startMenuElement.classList.contains('visible') ? StartMenu.hide() : StartMenu.show();
    },

    show: () => {
        if (!domElements.startMenuElement || !domElements.startMenuSearchInput) return;
        domElements.startMenuElement.classList.add('visible');
        domElements.startMenuSearchInput.value = ''; // Clear search on open
        StartMenu.filterApps(); // Reset filter
        domElements.startMenuSearchInput.focus();
    },

    hide: () => {
        if (!domElements.startMenuElement || !domElements.startMenuSearchInput) return;
        domElements.startMenuElement.classList.remove('visible');
        domElements.startMenuSearchInput.blur(); // Remove focus
    },

    isVisible: () => {
        return domElements.startMenuElement && domElements.startMenuElement.classList.contains('visible');
    }
};