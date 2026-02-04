// Configuration - NO HARDCODED TOKENS
const CONFIG = {
    SYNC_INTERVAL: 5000, // 5 seconds for real-time sync
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    DEBOUNCE_DELAY: 500,
    BATCH_SIZE: 10,
    
    // Storage keys
    STORAGE_KEYS: {
        CARDS: 'cardscan_cards_v2',
        SETTINGS: 'cardscan_settings_v2',
        SYNC_TOKEN: 'cardscan_sync_token',
        LAST_SYNC: 'cardscan_last_sync'
    }
};

// Global state manager
class AppState {
    constructor() {
        this.savedCards = [];
        this.pendingChanges = [];
        this.isOnline = navigator.onLine;
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.viewMode = 'grid';
        this.theme = 'dark';
        this.ocrWorker = null;
        this.syncInterval = null;
        this.debounceTimers = {};
        
        // Initialize IndexedDB for larger storage
        this.db = null;
        this.initIndexedDB();
    }
    
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('CardScanDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('cards')) {
                    const store = db.createObjectStore('cards', { keyPath: 'id' });
                    store.createIndex('company', 'companyName', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }
    
    async saveCard(cardData) {
        const id = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const card = {
            id,
            ...cardData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            synced: false
        };
        
        // Save to IndexedDB
        await this.saveToIndexedDB(card);
        
        // Save to memory cache
        this.savedCards.push(card);
        
        // Queue for sync
        this.queueChange('add', card);
        
        // Debounce sync
        this.debounceSync();
        
        return card;
    }
    
    async saveToIndexedDB(card) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.put(card);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    async loadCards() {
        // Try memory first
        if (this.savedCards.length > 0) {
            return this.savedCards;
        }
        
        // Load from IndexedDB
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.getAll();
            
            request.onsuccess = () => {
                this.savedCards = request.result;
                resolve(this.savedCards);
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    queueChange(type, data) {
        this.pendingChanges.push({
            type,
            data,
            timestamp: Date.now(),
            id: `change_${Date.now()}`
        });
        
        // Limit queue size
        if (this.pendingChanges.length > 100) {
            this.pendingChanges = this.pendingChanges.slice(-100);
        }
    }
    
    debounceSync() {
        clearTimeout(this.debounceTimers.sync);
        this.debounceTimers.sync = setTimeout(() => {
            this.syncChanges();
        }, CONFIG.DEBOUNCE_DELAY);
    }
    
    async syncChanges() {
        if (this.isSyncing || !this.isOnline || this.pendingChanges.length === 0) {
            return;
        }
        
        this.isSyncing = true;
        updateSyncStatus('Syncing...');
        
        try {
            // Process changes in batches
            const batch = this.pendingChanges.splice(0, CONFIG.BATCH_SIZE);
            
            // Simulate API call (replace with actual backend)
            await this.simulateSync(batch);
            
            // Update sync status
            this.lastSyncTime = new Date();
            localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, this.lastSyncTime.toISOString());
            
            updateSyncStatus('Synced');
            showToast(`Synced ${batch.length} changes`, 'success');
            
        } catch (error) {
            console.error('Sync failed:', error);
            
            // Re-queue failed changes
            this.pendingChanges.unshift(...batch);
            
            updateSyncStatus('Failed');
            showToast('Sync failed. Will retry.', 'error');
            
            // Retry with exponential backoff
            setTimeout(() => this.syncChanges(), CONFIG.RETRY_DELAY * Math.pow(2, 3));
        } finally {
            this.isSyncing = false;
        }
    }
    
    async simulateSync(changes) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // In production, replace with actual API calls
        console.log('Syncing changes:', changes);
        
        // Simulate 90% success rate
        if (Math.random() < 0.9) {
            return true;
        } else {
            throw new Error('Simulated sync error');
        }
    }
}

// Initialize app state
const appState = new AppState();

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize with Promise.all for parallel loading
    await Promise.all([
        initializeUI(),
        initializeParticles(),
        loadData(),
        checkConnection()
    ]);
    
    // Start real-time sync
    startRealtimeSync();
    
    // Add event listeners
    setupEventListeners();
    
    // Show welcome
    setTimeout(() => {
        showWelcome();
    }, 1000);
});

async function initializeUI() {
    // Hide loading screen with animation
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.style.opacity = '0';
    loadingScreen.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 500);
    
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    
    // Initialize view mode
    const savedViewMode = localStorage.getItem('viewMode') || 'grid';
    setViewMode(savedViewMode);
}

async function loadData() {
    try {
        const cards = await appState.loadCards();
        renderCards(cards);
        updateStats();
    } catch (error) {
        console.error('Failed to load data:', error);
        showToast('Failed to load saved cards', 'error');
    }
}

function startRealtimeSync() {
    // Clear any existing interval
    if (appState.syncInterval) {
        clearInterval(appState.syncInterval);
    }
    
    // Start new sync interval
    appState.syncInterval = setInterval(() => {
        if (appState.isOnline && appState.pendingChanges.length > 0) {
            appState.syncChanges();
        }
    }, CONFIG.SYNC_INTERVAL);
    
    // Also sync when window gains focus
    window.addEventListener('focus', () => {
        if (appState.isOnline) {
            appState.syncChanges();
        }
    });
}

function setupEventListeners() {
    // Online/offline detection
    window.addEventListener('online', () => {
        appState.isOnline = true;
        updateConnectionStatus(true);
        appState.syncChanges();
    });
    
    window.addEventListener('offline', () => {
        appState.isOnline = false;
        updateConnectionStatus(false);
    });
    
    // Save on form submit
    const form = document.querySelector('.form-card');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveCard();
    });
    
    // Auto-save on input change (debounced)
    const formInputs = document.querySelectorAll('.form-card input');
    formInputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            autoSaveDraft();
        }, 1000));
    });
    
    // Page visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Save before leaving
            appState.debounceSync();
        }
    });
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Enhanced saveCard function
async function saveCard() {
    const formData = {
        companyName: document.getElementById('companyName').value.trim(),
        contactPerson: document.getElementById('contactPerson').value.trim(),
        jobTitle: document.getElementById('jobTitle').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        imageData: extractedData?.imageData || null,
        ocrData: extractedData || null
    };
    
    // Validate
    if (!formData.companyName && !formData.contactPerson) {
        showToast('Please enter company name or contact person', 'warning');
        return;
    }
    
    try {
        // Show saving animation
        const saveBtn = document.getElementById('saveBtn');
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Saving...</span>';
        saveBtn.disabled = true;
        
        // Save card
        const card = await appState.saveCard(formData);
        
        // Update UI
        renderCards(appState.savedCards);
        updateStats();
        
        // Show success
        showConfetti();
        showToast('Card saved successfully!', 'success');
        
        // Reset form
        clearForm();
        
        // Update button
        setTimeout(() => {
            saveBtn.innerHTML = originalHTML;
            saveBtn.disabled = false;
        }, 1000);
        
    } catch (error) {
        console.error('Save failed:', error);
        showToast('Failed to save card', 'error');
    }
}

// Enhanced OCR with better error handling
async function startOCRScan() {
    const preview = document.getElementById('previewImage');
    
    if (!preview.src) {
        showToast('Please upload or capture an image first', 'warning');
        return;
    }
    
    try {
        // Initialize Tesseract with progress tracking
        if (!appState.ocrWorker) {
            appState.ocrWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => updateOCRProgress(m),
                errorHandler: err => {
                    console.error('OCR Worker Error:', err);
                    showToast('OCR engine error', 'error');
                }
            });
        }
        
        // Show progress UI
        showOCRProgress();
        
        // Perform OCR
        const result = await appState.ocrWorker.recognize(preview.src);
        
        // Process results
        await processOCRResults(result.data);
        
        // Show success
        showToast('Text extracted successfully!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        showToast('OCR failed. Please try again.', 'error');
    } finally {
        hideOCRProgress();
    }
}

// Particle background initialization
async function initializeParticles() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: "#667eea" },
                shape: { type: "circle" },
                opacity: { value: 0.5, random: true },
                size: { value: 3, random: true },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: "#667eea",
                    opacity: 0.2,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: "none",
                    random: true,
                    straight: false,
                    out_mode: "out",
                    bounce: false
                }
            },
            interactivity: {
                detect_on: "canvas",
                events: {
                    onhover: { enable: true, mode: "repulse" },
                    onclick: { enable: true, mode: "push" }
                }
            },
            retina_detect: true
        });
    }
}

// Theme toggle
function toggleTheme() {
    const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    appState.theme = newTheme;
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update UI elements
    const themeIcon = document.querySelector('#themeToggle i');
    if (themeIcon) {
        themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// Confetti animation
function showConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#667eea', '#764ba2', '#4cd964', '#ff6b6b', '#ffd93d'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        
        container.appendChild(confetti);
        
        // Remove after animation
        setTimeout(() => {
            confetti.remove();
        }, 3000);
    }
}

// Export all cards with compression
async function exportAllCards() {
    try {
        const cards = appState.savedCards;
        
        if (cards.length === 0) {
            showToast('No cards to export', 'warning');
            return;
        }
        
        // Compress data
        const data = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            count: cards.length,
            cards: cards
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const compressed = LZString.compressToUTF16(dataStr);
        
        // Create downloadable file
        const blob = new Blob([compressed], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `cardscan_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${cards.length} cards`, 'success');
        
    } catch (error) {
        console.error('Export failed:', error);
        showToast('Export failed', 'error');
    }
}

// Import cards
async function importCards(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const compressed = e.target.result;
                const dataStr = LZString.decompressFromUTF16(compressed);
                const data = JSON.parse(dataStr);
                
                // Validate data structure
                if (!data.cards || !Array.isArray(data.cards)) {
                    throw new Error('Invalid file format');
                }
                
                // Import cards
                let imported = 0;
                for (const card of data.cards) {
                    try {
                        await appState.saveCard(card);
                        imported++;
                    } catch (err) {
                        console.warn('Failed to import card:', card.id, err);
                    }
                }
                
                // Update UI
                renderCards(appState.savedCards);
                updateStats();
                
                showToast(`Imported ${imported} cards`, 'success');
                resolve(imported);
                
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

// Enhanced toast with queue system
class ToastManager {
    constructor() {
        this.queue = [];
        this.isShowing = false;
    }
    
    show(message, type = 'info', duration = 5000) {
        this.queue.push({ message, type, duration });
        this.processQueue();
    }
    
    processQueue() {
        if (this.isShowing || this.queue.length === 0) {
            return;
        }
        
        this.isShowing = true;
        const toast = this.queue.shift();
        this.createToast(toast.message, toast.type, toast.duration);
    }
    
    createToast(message, type, duration) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${this.getIcon(type)}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
                <div class="toast-time">${new Date().toLocaleTimeString()}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove();">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'toastSlideOut 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                    this.isShowing = false;
                    this.processQueue();
                }, 300);
            }
        }, duration);
    }
    
    getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

const toastManager = new ToastManager();

function showToast(message, type = 'info') {
    toastManager.show(message, type);
}

// Connection status
function updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById('connectionStatus');
    const offlineIndicator = document.getElementById('offlineIndicator');
    
    if (isOnline) {
        statusElement.className = 'status-indicator online';
        statusElement.querySelector('.status-text').textContent = 'Online';
        offlineIndicator.style.display = 'none';
    } else {
        statusElement.className = 'status-indicator offline';
        statusElement.querySelector('.status-text').textContent = 'Offline';
        offlineIndicator.style.display = 'flex';
    }
}

// Auto-save draft
let draftTimeout;
function autoSaveDraft() {
    clearTimeout(draftTimeout);
    
    draftTimeout = setTimeout(() => {
        const formData = {
            companyName: document.getElementById('companyName').value,
            contactPerson: document.getElementById('contactPerson').value,
            jobTitle: document.getElementById('jobTitle').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            website: document.getElementById('website').value,
            location: document.getElementById('location').value
        };
        
        localStorage.setItem('cardscan_draft', JSON.stringify(formData));
        console.log('Draft auto-saved');
    }, 2000);
}

// Load draft
function loadDraft() {
    const draft = localStorage.getItem('cardscan_draft');
    if (draft) {
        const formData = JSON.parse(draft);
        Object.keys(formData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.value = formData[key];
            }
        });
    }
}

// Clear all data with confirmation
async function clearAllData() {
    const confirmed = await showConfirmDialog(
        'Clear All Data',
        'This will delete all cards and settings. This action cannot be undone.',
        'Delete Everything',
        'Cancel'
    );
    
    if (confirmed) {
        try {
            // Clear IndexedDB
            const transaction = appState.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            store.clear();
            
            // Clear memory
            appState.savedCards = [];
            appState.pendingChanges = [];
            
            // Clear localStorage
            localStorage.clear();
            
            // Update UI
            renderCards([]);
            updateStats();
            
            showToast('All data cleared successfully', 'success');
            
        } catch (error) {
            console.error('Failed to clear data:', error);
            showToast('Failed to clear data', 'error');
        }
    }
}

// Confirm dialog
function showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="dialog-actions">
                    <button class="btn-cancel">${cancelText}</button>
                    <button class="btn-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        dialog.querySelector('.btn-cancel').onclick = () => {
            dialog.remove();
            resolve(false);
        };
        
        dialog.querySelector('.btn-confirm').onclick = () => {
            dialog.remove();
            resolve(true);
        };
        
        dialog.querySelector('.dialog-overlay').onclick = () => {
            dialog.remove();
            resolve(false);
        };
    });
}

// Cleanup on exit
window.addEventListener('beforeunload', (e) => {
    if (appState.pendingChanges.length > 0) {
        // Save any pending changes
        appState.syncChanges();
        
        // Optional: Show warning for unsaved changes
        // e.preventDefault();
        // e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
    
    // Cleanup OCR worker
    if (appState.ocrWorker) {
        appState.ocrWorker.terminate();
    }
    
    // Clear sync interval
    if (appState.syncInterval) {
        clearInterval(appState.syncInterval);
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
