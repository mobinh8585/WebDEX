import { state } from './state.js';
import { getFileExtension } from './utils.js'; // For mimeType in createFile

export const FileSystemManager = {
    _db: null,
    DB_NAME: 'WebDesktopDB_V5', // Keep version if schema is same, or increment if changed
    STORE_NAME: 'files',
    DB_VERSION: 1, // Increment if onupgradeneeded changes object stores/indices

    /** Initializes the IndexedDB database. */
    init: async () => {
        return new Promise((resolve, reject) => {
            if (FileSystemManager._db && state.fileSystemReady) {
                // console.log("FSM: Already initialized."); // Dev log
                resolve(FileSystemManager._db);
                return;
            }
            // console.log("FSM: Initializing IndexedDB..."); // Dev log
            const request = indexedDB.open(FileSystemManager.DB_NAME, FileSystemManager.DB_VERSION);

            request.onupgradeneeded = (event) => {
                // console.log("FSM: onupgradeneeded triggered."); // Dev log
                const db = event.target.result;
                if (!db.objectStoreNames.contains(FileSystemManager.STORE_NAME)) {
                    const store = db.createObjectStore(FileSystemManager.STORE_NAME, { keyPath: 'path' });
                    store.createIndex('parentPath', 'parentPath', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    // console.log("FSM: Object store created."); // Dev log
                }
            };

            request.onsuccess = async (event) => {
                FileSystemManager._db = event.target.result;
                // console.log("FSM: IndexedDB connection successful."); // Dev log
                try {
                    await FileSystemManager._ensureBaseStructure();
                    state.fileSystemReady = true;
                    // console.log("FSM: Base structure ensured. File system ready."); // Dev log
                    resolve(FileSystemManager._db);
                } catch (err) {
                    console.error("FSM: Error ensuring base structure:", err);
                    state.fileSystemReady = false;
                    reject(err);
                }
            };

            request.onerror = (event) => {
                console.error("FSM: IndexedDB error:", event.target.error);
                state.fileSystemReady = false;
                reject(event.target.error);
            };
        });
    },

    /** Ensures base directories like '/', '/Desktop' exist. */
    _ensureBaseStructure: async () => {
        // console.log("FSM: Ensuring base structure..."); // Dev log
        const baseDirs = ['/', '/Desktop/', '/Documents/', '/Pictures/', '/Downloads/'];
        for (const dirPath of baseDirs) {
            // Normalize path to always end with '/' for folders, except root itself which is just '/'
            const normalizedPath = dirPath === '/' ? '/' : (dirPath.endsWith('/') ? dirPath : dirPath + '/');
            const item = await FileSystemManager.getItem(normalizedPath).catch(() => null);
            if (!item) {
                // console.log(`FSM: Creating base directory: ${normalizedPath}`); // Dev log
                await FileSystemManager.createFolder(normalizedPath);
            }
        }
        // console.log("FSM: Base structure check complete."); // Dev log
    },

    /** Gets an object store with the specified mode. */
    _getObjectStore: (mode = 'readonly') => {
        if (!FileSystemManager._db) {
            throw new Error("FSM: Database not initialized or connection lost.");
        }
        const transaction = FileSystemManager._db.transaction(FileSystemManager.STORE_NAME, mode);
        return transaction.objectStore(FileSystemManager.STORE_NAME);
    },

    /** Retrieves an item by its path. */
    getItem: async (path) => {
        return new Promise((resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for getItem.")); return; }
            try {
                const store = FileSystemManager._getObjectStore();
                const request = store.get(path);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => { console.error(`FSM: Error getItem '${path}':`, e.target.error); reject(e.target.error); };
            } catch (err) { reject(err); }
        });
    },

    /** Adds or updates an item in the store. */
    putItem: async (itemData) => {
        return new Promise((resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for putItem.")); return; }
            try {
                const store = FileSystemManager._getObjectStore('readwrite');
                const request = store.put(itemData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => { console.error(`FSM: Error putItem '${itemData.path}':`, e.target.error); reject(e.target.error); };
            } catch (err) { reject(err); }
        });
    },

    /** Deletes an item (and its children if it's a folder). */
    deleteItem: async (path) => {
        return new Promise(async (resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for deleteItem.")); return; }
            try {
                const item = await FileSystemManager.getItem(path).catch(() => null);
                const store = FileSystemManager._getObjectStore('readwrite');
                if (item && item.type === 'folder') {
                    const itemsInFolder = await FileSystemManager.listDirectory(path);
                    for (const subItem of itemsInFolder) {
                        await FileSystemManager.deleteItem(subItem.path); // Recursive delete
                    }
                }
                const request = store.delete(path);
                request.onsuccess = () => resolve(true);
                request.onerror = (e) => { console.error(`FSM: Error deleteItem '${path}':`, e.target.error); reject(e.target.error); };
            } catch (err) { reject(err); }
        });
    },

    /** Lists all items directly under a given directory path. */
    listDirectory: async (dirPath) => {
        return new Promise((resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for listDirectory.")); return; }
            try {
                // Ensure parent path for querying ends with a slash, or is just "/" for root's children
                const queryParentPath = dirPath === '/' ? '/' : (dirPath.endsWith('/') ? dirPath : dirPath + '/');
                const store = FileSystemManager._getObjectStore();
                const index = store.index('parentPath');
                const request = index.getAll(queryParentPath);

                request.onsuccess = () => {
                    // console.log(`FSM: listDirectory('${queryParentPath}') found:`, request.result); // Dev Log
                    resolve(request.result || []);
                }
                request.onerror = (e) => {
                    console.error(`FSM: Error listDirectory '${queryParentPath}':`, e.target.error);
                    reject(e.target.error);
                };
            } catch (err) { reject(err); }
        });
    },

    /** Parses a full path into its name, parent path, and full path. */
    _getPathInfo: (fullPath) => {
        if (fullPath === '/') return { name: '/', parentPath: null, fullPath: '/' };

        const normalizedFullPath = fullPath.endsWith('/') && fullPath !== '/' ? fullPath.slice(0, -1) : fullPath;
        const parts = normalizedFullPath.split('/');
        const name = parts.pop() || '';

        let parentPath;
        if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) { // e.g. "/file.txt" or "/folder"
            parentPath = '/';
        } else {
            parentPath = parts.join('/') + '/'; // e.g. "/Documents/"
        }
        return { name, parentPath, fullPath: fullPath }; // Return original fullPath for consistency
    },

    /** Creates a new file. */
    createFile: async (fullPath, content = "") => {
        if (!FileSystemManager._db) throw new Error("FSM: DB not available for createFile.");
        const { name, parentPath } = FileSystemManager._getPathInfo(fullPath);
        if (!name) throw new Error("File name cannot be empty.");

        const now = Date.now();
        const fileData = {
            path: fullPath, // Store with original fullPath
            name: name,
            type: 'file',
            content: content,
            mimeType: getFileExtension(name) === 'txt' ? 'text/plain' : 'application/octet-stream',
            size: new TextEncoder().encode(content).length,
            created: now,
            modified: now,
            parentPath: parentPath
        };
        await FileSystemManager.putItem(fileData);
        // console.log("FSM: Created file:", fileData); // Dev log
        return fileData;
    },

    /** Creates a new folder. */
    createFolder: async (fullPath) => {
        if (!FileSystemManager._db) throw new Error("FSM: DB not available for createFolder.");
        const { name, parentPath } = FileSystemManager._getPathInfo(fullPath);

        // For root folder "/", name is "/", parentPath is null.
        // For other folders, name should not be empty.
        if (!name && fullPath !== '/') throw new Error("Folder name cannot be empty.");

        const now = Date.now();
        // Folders (except root) should have paths ending with "/"
        const folderPathNormalized = fullPath === '/' ? '/' : (fullPath.endsWith('/') ? fullPath : fullPath + '/');

        const folderData = {
            path: folderPathNormalized,
            name: name,
            type: 'folder',
            created: now,
            modified: now,
            parentPath: parentPath
        };
        await FileSystemManager.putItem(folderData);
        // console.log("FSM: Created folder:", folderData); // Dev log
        return folderData;
    },
};