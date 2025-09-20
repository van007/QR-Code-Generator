export class HistoryManager {
    constructor() {
        this.storageKey = 'qrcode_history';
        this.maxItems = 10;
    }

    getItems() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) {
                return [];
            }
            
            const items = JSON.parse(stored);
            
            if (!Array.isArray(items)) {
                return [];
            }
            
            return items
                .filter(item => this.validateItem(item))
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, this.maxItems);
        } catch (error) {
            console.error('Error loading history:', error);
            return [];
        }
    }

    addItem(item) {
        try {
            if (!this.validateItem(item)) {
                console.error('Invalid history item:', item);
                return false;
            }
            
            let items = this.getItems();
            
            const existingIndex = items.findIndex(
                existing => existing.data === item.data && existing.type === item.type
            );
            
            if (existingIndex !== -1) {
                items.splice(existingIndex, 1);
            }
            
            items.unshift(item);
            
            items = items.slice(0, this.maxItems);
            
            localStorage.setItem(this.storageKey, JSON.stringify(items));
            
            this.notifyChange('add', item);
            
            return true;
        } catch (error) {
            console.error('Error adding to history:', error);
            
            if (error.name === 'QuotaExceededError') {
                this.clearOldItems();
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify([item]));
                    return true;
                } catch (retryError) {
                    console.error('Failed to save after clearing:', retryError);
                    return false;
                }
            }
            
            return false;
        }
    }

    removeItem(timestamp) {
        try {
            let items = this.getItems();
            const initialLength = items.length;
            
            items = items.filter(item => item.timestamp !== timestamp);
            
            if (items.length === initialLength) {
                return false;
            }
            
            localStorage.setItem(this.storageKey, JSON.stringify(items));
            
            this.notifyChange('remove', { timestamp });
            
            return true;
        } catch (error) {
            console.error('Error removing from history:', error);
            return false;
        }
    }

    clearHistory() {
        try {
            localStorage.removeItem(this.storageKey);
            this.notifyChange('clear');
            return true;
        } catch (error) {
            console.error('Error clearing history:', error);
            return false;
        }
    }

    clearOldItems() {
        try {
            let items = this.getItems();
            
            items = items.slice(0, Math.floor(this.maxItems / 2));
            
            localStorage.setItem(this.storageKey, JSON.stringify(items));
            
            this.notifyChange('trim');
            
            return true;
        } catch (error) {
            console.error('Error clearing old items:', error);
            return false;
        }
    }

    validateItem(item) {
        if (!item || typeof item !== 'object') {
            return false;
        }
        
        const requiredFields = ['type', 'data', 'timestamp'];
        for (const field of requiredFields) {
            if (!(field in item)) {
                return false;
            }
        }
        
        if (typeof item.type !== 'string' || !item.type) {
            return false;
        }
        
        if (typeof item.data !== 'string' || !item.data) {
            return false;
        }
        
        if (typeof item.timestamp !== 'number' || item.timestamp <= 0) {
            return false;
        }
        
        return true;
    }

    getItem(timestamp) {
        const items = this.getItems();
        return items.find(item => item.timestamp === timestamp) || null;
    }

    exportHistory() {
        const items = this.getItems();
        const dataStr = JSON.stringify(items, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr_history_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        return true;
    }

    importHistory(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.type !== 'application/json') {
                reject(new Error('Invalid file type. Please select a JSON file.'));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    
                    if (!Array.isArray(imported)) {
                        reject(new Error('Invalid file format. Expected an array.'));
                        return;
                    }
                    
                    const validItems = imported.filter(item => this.validateItem(item));
                    
                    if (validItems.length === 0) {
                        reject(new Error('No valid items found in the file.'));
                        return;
                    }
                    
                    const currentItems = this.getItems();
                    const mergedItems = [...validItems, ...currentItems];
                    
                    const uniqueItems = mergedItems.reduce((acc, item) => {
                        const key = `${item.type}-${item.data}`;
                        if (!acc.map[key] || acc.map[key].timestamp < item.timestamp) {
                            acc.map[key] = item;
                        }
                        return acc;
                    }, { map: {} });
                    
                    const finalItems = Object.values(uniqueItems.map)
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, this.maxItems * 2);
                    
                    localStorage.setItem(this.storageKey, JSON.stringify(finalItems));
                    
                    this.notifyChange('import', { count: validItems.length });
                    
                    resolve(validItems.length);
                } catch (error) {
                    reject(new Error('Failed to parse file: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    searchHistory(query) {
        if (!query || typeof query !== 'string') {
            return this.getItems();
        }
        
        const searchTerm = query.toLowerCase();
        const items = this.getItems();
        
        return items.filter(item => {
            return (
                item.type.toLowerCase().includes(searchTerm) ||
                item.data.toLowerCase().includes(searchTerm)
            );
        });
    }

    getStatistics() {
        const items = this.getItems();
        
        const stats = {
            total: items.length,
            byType: {},
            oldestTimestamp: null,
            newestTimestamp: null,
            averageDataLength: 0
        };
        
        if (items.length === 0) {
            return stats;
        }
        
        let totalDataLength = 0;
        
        items.forEach(item => {
            stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
            
            totalDataLength += item.data.length;
            
            if (!stats.oldestTimestamp || item.timestamp < stats.oldestTimestamp) {
                stats.oldestTimestamp = item.timestamp;
            }
            
            if (!stats.newestTimestamp || item.timestamp > stats.newestTimestamp) {
                stats.newestTimestamp = item.timestamp;
            }
        });
        
        stats.averageDataLength = Math.round(totalDataLength / items.length);
        
        return stats;
    }

    notifyChange(action, data = null) {
        const event = new CustomEvent('qrHistoryChange', {
            detail: {
                action,
                data,
                timestamp: Date.now()
            }
        });
        
        window.dispatchEvent(event);
    }

    onHistoryChange(callback) {
        const handler = (event) => {
            callback(event.detail);
        };
        
        window.addEventListener('qrHistoryChange', handler);
        
        return () => {
            window.removeEventListener('qrHistoryChange', handler);
        };
    }

    setMaxItems(max) {
        if (typeof max !== 'number' || max < 1) {
            throw new Error('Max items must be a positive number');
        }
        
        this.maxItems = max;
        
        const items = this.getItems();
        if (items.length > max) {
            const trimmed = items.slice(0, max);
            localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
            this.notifyChange('trim');
        }
    }

    getStorageSize() {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            return 0;
        }
        
        return new Blob([stored]).size;
    }
}