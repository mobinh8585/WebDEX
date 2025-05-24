import { state } from './state.js';
import { getFileExtension } from './utils.js'; // For mimeType in createFile

export const FileSystemManager = {
    _db: null,
    DB_NAME: 'WebDesktopDB_V5',
    STORE_NAME: 'files',
    DB_VERSION: 2,

    init: async () => {
        return new Promise((resolve, reject) => {
            if (FileSystemManager._db && state.fileSystemReady) {
                resolve(FileSystemManager._db);
                return;
            }
            const request = indexedDB.open(FileSystemManager.DB_NAME, FileSystemManager.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(FileSystemManager.STORE_NAME)) {
                    const store = db.createObjectStore(FileSystemManager.STORE_NAME, { keyPath: 'path' });
                    store.createIndex('parentPath', 'parentPath', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                FileSystemManager._db = event.target.result;
                try {
                    await FileSystemManager._ensureBaseStructure();
                    state.fileSystemReady = true;
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

    _ensureBaseStructure: async () => {
        const baseDirs = ['/', '/Desktop/', '/Documents/', '/Pictures/', '/Downloads/', '/Recycle Bin/', '/user_apps/'];
        for (const dirPath of baseDirs) {
            const normalizedPath = dirPath === '/' ? '/' : (dirPath.endsWith('/') ? dirPath : dirPath + '/');
            const item = await FileSystemManager.getItem(normalizedPath).catch(() => null);
            if (!item) {
                await FileSystemManager.createFolder(normalizedPath);
            }
        }
    },

    _getObjectStore: (mode = 'readonly') => {
        if (!FileSystemManager._db) {
            throw new Error("FSM: Database not initialized or connection lost.");
        }
        const transaction = FileSystemManager._db.transaction(FileSystemManager.STORE_NAME, mode);
        return transaction.objectStore(FileSystemManager.STORE_NAME);
    },

    getItem: async (path) => {
        return new Promise((resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for getItem.")); return; }
            try {
                const store = FileSystemManager._getObjectStore();
                const request = store.get(path);
                request.onsuccess = () => resolve(request.result); // Result can be undefined if not found
                request.onerror = (e) => { console.error(`FSM: Error getItem '${path}':`, e.target.error); reject(e.target.error); };
            } catch (err) { reject(err); }
        });
    },

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

    _permanentDeleteItem: async (path) => {
        return new Promise(async (resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for _permanentDeleteItem.")); return; }
            try {
                const item = await FileSystemManager.getItem(path).catch(() => null);
                if (!item) {
                    console.warn(`FSM: Attempted to permanently delete non-existent item: ${path}`);
                    resolve(true);
                    return;
                }

                const store = FileSystemManager._getObjectStore('readwrite');
                if (item.type === 'folder') {
                    const itemsInFolder = await FileSystemManager.listDirectory(path);
                    for (const subItem of itemsInFolder) {
                        await FileSystemManager._permanentDeleteItem(subItem.path);
                    }
                }
                const request = store.delete(path);
                request.onsuccess = () => resolve(true);
                request.onerror = (e) => { console.error(`FSM: Error _permanentDeleteItem '${path}':`, e.target.error); reject(e.target.error); };
            } catch (err) { reject(err); }
        });
    },

    deleteItem: async (path) => {
        return new Promise(async (resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for deleteItem.")); return; }
            try {
                const item = await FileSystemManager.getItem(path).catch(() => null);
                if (!item) {
                    console.warn(`FSM: Attempted to delete non-existent item: ${path}`);
                    resolve(true);
                    return;
                }

                // If the item is already in the Recycle Bin, permanently delete it
                if (path.startsWith('/Recycle Bin/')) {
                    await FileSystemManager._permanentDeleteItem(path);
                    resolve(true);
                    return;
                }

                // Move item to Recycle Bin
                const recycleBinPath = '/Recycle Bin/';
                const { name } = FileSystemManager._getPathInfo(path);
                const newPathInRecycleBin = `${recycleBinPath}${name}_${Date.now()}${item.type === 'folder' ? '/' : ''}`;

                const newItem = {
                    ...item,
                    path: newPathInRecycleBin,
                    parentPath: recycleBinPath,
                    originalPath: path, // Store original path for restoration
                    isRecycled: true,
                    modified: Date.now()
                };

                const transaction = FileSystemManager._db.transaction(FileSystemManager.STORE_NAME, 'readwrite');
                const store = transaction.objectStore(FileSystemManager.STORE_NAME);

                // Delete old item
                const deleteRequest = store.delete(path);
                deleteRequest.onerror = (e) => { console.error(`FSM: Error deleting original item '${path}' for recycle:`, e.target.error); reject(e.target.error); };
                
                deleteRequest.onsuccess = () => {
                    // Add new item to recycle bin
                    const putRequest = store.put(newItem);
                    putRequest.onsuccess = () => resolve(newItem);
                    putRequest.onerror = (e) => { console.error(`FSM: Error putting item to recycle bin '${newItem.path}':`, e.target.error); reject(e.target.error);};
                };

            } catch (err) { reject(err); }
        });
    },

    renameItem: async (oldPath, newPath) => { // Used for both rename and move
        return new Promise(async (resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for renameItem.")); return; }
            try {
                const item = await FileSystemManager.getItem(oldPath);
                if (!item) { reject(new Error(`FSM: Item not found at '${oldPath}'`)); return; }

                const normalizedNewPath = item.type === 'folder' && !newPath.endsWith('/') ? newPath + '/' : newPath;
                const { name: newName, parentPath: newParentPath } = FileSystemManager._getPathInfo(normalizedNewPath);

                // Check if destination already exists and is not the source item itself (important for case-only renames)
                const existingAtNewPath = await FileSystemManager.getItem(normalizedNewPath);
                if (existingAtNewPath && existingAtNewPath.path !== oldPath) {
                    reject(new Error(`FSM: An item already exists at the destination path '${normalizedNewPath}'`));
                    return;
                }


                const transaction = FileSystemManager._db.transaction(FileSystemManager.STORE_NAME, 'readwrite');
                const store = transaction.objectStore(FileSystemManager.STORE_NAME);

                // Create the new item structure
                const newItem = { ...item,
                    path: normalizedNewPath,
                    name: newName,
                    parentPath: newParentPath,
                    modified: Date.now()
                };

                // If it's a folder, recursively update paths of all children
                if (item.type === 'folder') {
                    const children = await FileSystemManager.listDirectory(oldPath); // This uses a separate transaction
                    for (const child of children) {
                        const relativePath = child.path.substring(oldPath.length);
                        // Recursively call renameItem for children. This will create new transactions.
                        // For complex folder moves, this could be optimized by doing it within the same transaction if possible.
                        await FileSystemManager.renameItem(child.path, normalizedNewPath + relativePath);
                    }
                }

                // Delete old item and add new item within the same transaction (if not a folder with children handled above)
                const deleteRequest = store.delete(oldPath);
                deleteRequest.onerror = (e) => { console.error(`FSM: Error deleting old item '${oldPath}' in rename:`, e.target.error); reject(e.target.error); };
                
                deleteRequest.onsuccess = () => {
                    const putRequest = store.put(newItem);
                    putRequest.onsuccess = () => resolve(newItem);
                    putRequest.onerror = (e) => { console.error(`FSM: Error putting new item '${newItem.path}' in rename:`, e.target.error); reject(e.target.error);};
                };
                
                // For folder moves without children (or if children handled by recursive calls), this direct put after delete is fine.
                // However, if children were handled by separate transactions, ensure transaction commits properly.

            } catch (err) { reject(err); }
        });
    },

    copyItem: async (sourcePath, destinationPath) => {
        return new Promise(async (resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for copyItem.")); return; }
            try {
                const item = await FileSystemManager.getItem(sourcePath);
                if (!item) { reject(new Error(`FSM: Item not found at '${sourcePath}'`)); return; }

                const normalizedDestinationPath = item.type === 'folder' && !destinationPath.endsWith('/') ? destinationPath + '/' : destinationPath;
                const { name: destName, parentPath: destParentPath } = FileSystemManager._getPathInfo(normalizedDestinationPath);
                
                // Check if destination already exists
                const existingAtDest = await FileSystemManager.getItem(normalizedDestinationPath);
                if (existingAtDest) {
                    reject(new Error(`FSM: An item already exists at the destination path '${normalizedDestinationPath}' for copy.`));
                    return;
                }


                const newItemData = { ...item,
                    path: normalizedDestinationPath,
                    name: destName,
                    parentPath: destParentPath,
                    created: Date.now(),
                    modified: Date.now()
                };
                // If 'id' or other unique store-generated keys were part of item, they should be removed for a true copy.
                // delete newItemData.id; (if applicable)

                await FileSystemManager.putItem(newItemData); // Puts the new item

                if (item.type === 'folder') {
                    const children = await FileSystemManager.listDirectory(sourcePath);
                    for (const child of children) {
                        const relativePath = child.path.substring(sourcePath.length);
                        await FileSystemManager.copyItem(child.path, normalizedDestinationPath + relativePath);
                    }
                }
                resolve(newItemData);
            } catch (err) { reject(err); }
        });
    },

    listDirectory: async (dirPath) => {
        return new Promise((resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for listDirectory.")); return; }
            try {
                const queryParentPath = dirPath === '/' ? '/' : (dirPath.endsWith('/') ? dirPath : dirPath + '/');
                const store = FileSystemManager._getObjectStore();
                const index = store.index('parentPath');
                const request = index.getAll(queryParentPath);

                request.onsuccess = () => {
                    resolve(request.result || []);
                }
                request.onerror = (e) => {
                    console.error(`FSM: Error listDirectory '${queryParentPath}':`, e.target.error);
                    reject(e.target.error);
                };
            } catch (err) { reject(err); }
        });
    },

    _getPathInfo: (fullPath) => {
        if (fullPath === '/') return { name: '/', parentPath: null, fullPath: '/' };

        const normalizedFullPath = fullPath.endsWith('/') && fullPath !== '/' ? fullPath.slice(0, -1) : fullPath;
        const parts = normalizedFullPath.split('/');
        const name = parts.pop() || '';

        let parentPath;
        if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
            parentPath = '/';
        } else {
            parentPath = parts.join('/') + '/';
        }
        return { name, parentPath, fullPath: fullPath };
    },

    createFile: async (fullPath, content = "", overwrite = false) => {
        if (!FileSystemManager._db) throw new Error("FSM: DB not available for createFile.");
        const { name, parentPath } = FileSystemManager._getPathInfo(fullPath);
        if (!name) throw new Error("File name cannot be empty.");

        const now = Date.now();
        let createdTime = now;

        const existingItem = await FileSystemManager.getItem(fullPath).catch(() => null);

        if (existingItem) {
            if (overwrite) {
                createdTime = existingItem.created || now; // Preserve original creation time
            } else {
                // If not overwriting and file exists, throw error or handle as per app logic.
                throw new Error(`File ${fullPath} already exists. Use overwrite option to replace it.`);
            }
        }
        
        const fileData = {
            path: fullPath,
            name: name,
            type: 'file',
            content: content,
            mimeType: getFileExtension(name) === 'txt' ? 'text/plain' : (['js', 'json', 'css', 'html', 'md', 'xml', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'rb', 'sh', 'sql', 'yaml', 'yml', 'ts'].includes(getFileExtension(name)) ? `text/${getFileExtension(name)}` : 'application/octet-stream'),
            size: new TextEncoder().encode(content).length,
            created: createdTime,
            modified: now,
            parentPath: parentPath
        };
        await FileSystemManager.putItem(fileData);
        return fileData;
    },

    restoreItem: async (itemPathInRecycleBin) => {
        return new Promise(async (resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for restoreItem.")); return; }
            try {
                const item = await FileSystemManager.getItem(itemPathInRecycleBin);
                if (!item || !item.isRecycled || !item.originalPath) {
                    reject(new Error(`FSM: Item '${itemPathInRecycleBin}' is not a valid recycled item.`));
                    return;
                }

                let targetPath = item.originalPath;
                let { name, parentPath } = FileSystemManager._getPathInfo(targetPath);

                // Check if original path is available
                const existingAtOriginalPath = await FileSystemManager.getItem(targetPath).catch(() => null);
                if (existingAtOriginalPath) {
                    // If original path is occupied, try to restore to Desktop
                    targetPath = `/Desktop/${name}`;
                    parentPath = '/Desktop/';
                    const existingAtDesktop = await FileSystemManager.getItem(targetPath).catch(() => null);
                    if (existingAtDesktop) {
                        // If Desktop path is also occupied, append a timestamp
                        targetPath = `/Desktop/${name}_${Date.now()}`;
                    }
                    console.warn(`FSM: Original path '${item.originalPath}' occupied. Restoring to '${targetPath}'.`);
                }

                const newItem = {
                    ...item,
                    path: targetPath,
                    name: name,
                    parentPath: parentPath,
                    isRecycled: false,
                    originalPath: undefined, // Clear originalPath
                    modified: Date.now()
                };

                const transaction = FileSystemManager._db.transaction(FileSystemManager.STORE_NAME, 'readwrite');
                const store = transaction.objectStore(FileSystemManager.STORE_NAME);

                // Delete item from recycle bin
                const deleteRequest = store.delete(itemPathInRecycleBin);
                deleteRequest.onerror = (e) => { console.error(`FSM: Error deleting item from recycle bin '${itemPathInRecycleBin}' for restore:`, e.target.error); reject(e.target.error); };
                
                deleteRequest.onsuccess = () => {
                    // Add item back to its original (or new) location
                    const putRequest = store.put(newItem);
                    putRequest.onsuccess = () => resolve(newItem);
                    putRequest.onerror = (e) => { console.error(`FSM: Error putting item back '${newItem.path}' during restore:`, e.target.error); reject(e.target.error);};
                };

            } catch (err) { reject(err); }
        });
    },

    emptyRecycleBin: async () => {
        return new Promise(async (resolve, reject) => {
            if (!FileSystemManager._db) { reject(new Error("FSM: DB not available for emptyRecycleBin.")); return; }
            try {
                const recycleBinContents = await FileSystemManager.listDirectory('/Recycle Bin/');
                for (const item of recycleBinContents) {
                    await FileSystemManager._permanentDeleteItem(item.path);
                }
                resolve(true);
            } catch (err) {
                console.error("FSM: Error emptying recycle bin:", err);
                reject(err);
            }
        });
    },

    createFolder: async (fullPath) => {
        if (!FileSystemManager._db) throw new Error("FSM: DB not available for createFolder.");
        const { name, parentPath } = FileSystemManager._getPathInfo(fullPath);

        if (!name && fullPath !== '/') throw new Error("Folder name cannot be empty.");

        const now = Date.now();
        const folderPathNormalized = fullPath === '/' ? '/' : (fullPath.endsWith('/') ? fullPath : fullPath + '/');

        const existing = await FileSystemManager.getItem(folderPathNormalized).catch(() => null);
        if (existing) {
            if (existing.type === 'folder') {
                return existing; // Folder already exists, do nothing and resolve
            } else {
                throw new Error(`A file with the name ${folderPathNormalized} already exists.`);
            }
        }

        const folderData = {
            path: folderPathNormalized,
            name: name,
            type: 'folder',
            created: now,
            modified: now,
            parentPath: parentPath
        };
        await FileSystemManager.putItem(folderData);
        return folderData;
    },
};
