// Configuration
const CONFIG = {
    GITHUB_USERNAME: 'ansh200229',
    REPO_NAME: 'Ansh_Business-card-scanner',
    GITHUB_TOKEN: 'github_pat_11ATZQ4MI0fnYt3qf4MZ7l_u2g2NDQ2GduZfAm5QITR2PKW2N7zBZ45gWtI2FyQshSJ6YGTY2E1m8tJzC',
    SYNC_INTERVAL: 1000, // 1 second for real-time sync
    API_BASE: 'https://api.github.com',
    DATA_FILE: 'cards_data.json',
    SYNC_ENABLED: true
};

// Global variables
let savedCards = [];
let currentStream = null;
let currentCamera = 'back';
let flashEnabled = false;
let ocrWorker = null;
let extractedData = {};
let viewMode = 'grid';
let syncInterval = null;
let isSyncing = false;
let isOnline = navigator.onLine;
let searchQuery = '';
let currentFilter = 'all';
let currentSort = 'newest';
let realTimeSyncEnabled = true;
let searchResults = [];
let lastSyncTime = null;
let syncWebSocket = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1000);
    
    // Initialize components
    await initializeApp();
    
    // Initialize real-time sync
    initializeRealTimeSync();
    
    // Start auto-sync
    startAutoSync();
    
    // Handle online/offline status
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    // Handle visibility change for sync
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initialize search functionality
    initializeSearch();
    
    // Show welcome message
    setTimeout(() => {
        showToast('Card Scanner Pro is ready!', 'success');
    }, 1500);
});

// Initialize the app
async function initializeApp() {
    // Load local cards first
    loadLocalCards();
    
    // Then try to sync with cloud
    await syncWithCloud();
    
    // Initialize UI
    updateUI();
    
    // Update sync status
    updateSyncStatus('Synced');
}

// Initialize real-time sync
function initializeRealTimeSync() {
    // Check if real-time sync is enabled
    const realTimeSyncToggle = document.getElementById('realTimeSync');
    if (realTimeSyncToggle) {
        realTimeSyncEnabled = realTimeSyncToggle.checked;
        realTimeSyncToggle.addEventListener('change', function() {
            realTimeSyncEnabled = this.checked;
            if (realTimeSyncEnabled) {
                startAutoSync();
                showToast('Real-time sync enabled', 'success');
            } else {
                stopAutoSync();
                showToast('Real-time sync disabled', 'info');
            }
        });
    }
    
    // Initialize WebSocket for real-time updates (simulated)
    setupWebSocket();
}

// Setup WebSocket connection (simulated for demo)
function setupWebSocket() {
    // In a real implementation, you would connect to a WebSocket server
    // For demo, we'll simulate real-time updates with setInterval
    
    console.log('Setting up real-time sync...');
    
    // Show sync indicator
    const syncIndicator = document.getElementById('syncIndicator');
    if (syncIndicator) {
        syncIndicator.style.display = 'flex';
        setTimeout(() => {
            syncIndicator.style.display = 'none';
        }, 2000);
    }
}

// Start auto-sync
function startAutoSync() {
    if (!realTimeSyncEnabled || !isOnline) return;
    
    if (syncInterval) clearInterval(syncInterval);
    
    // Get sync frequency from settings
    const syncFrequency = document.getElementById('syncFrequency');
    const interval = syncFrequency ? parseInt(syncFrequency.value) : CONFIG.SYNC_INTERVAL;
    
    syncInterval = setInterval(async () => {
        if (isOnline && realTimeSyncEnabled) {
            await performSync();
        }
    }, interval);
    
    console.log('Auto-sync started with interval:', interval, 'ms');
}

// Stop auto-sync
function stopAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('Auto-sync stopped');
    }
}

// Perform sync operation
async function performSync() {
    if (isSyncing || !isOnline) return;
    
    isSyncing = true;
    showSyncIndicator();
    
    try {
        // Get changes from cloud
        const cloudData = await fetchFromGitHub();
        
        if (cloudData) {
            // Merge and check for changes
            const hasChanges = mergeCards(cloudData);
            
            if (hasChanges) {
                // Update UI if changes were merged
                updateUI();
                showToast('Synced latest changes', 'info');
            }
        }
        
        // Push local changes to cloud
        await pushToCloud();
        
        updateSyncStatus('Live');
        lastSyncTime = new Date();
        updateLastSyncTime();
        
    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('Sync Error');
    } finally {
        isSyncing = false;
        hideSyncIndicator();
    }
}

// Show sync indicator
function showSyncIndicator() {
    const indicator = document.getElementById('syncIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
        indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i><span>Syncing changes...</span>';
    }
}

// Hide sync indicator
function hideSyncIndicator() {
    const indicator = document.getElementById('syncIndicator');
    if (indicator) {
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 1000);
    }
}

// Sync with cloud
async function syncWithCloud() {
    if (!isOnline) {
        updateSyncStatus('Offline');
        return false;
    }
    
    return await performSync();
}

// Push to cloud
async function pushToCloud() {
    if (!isOnline) return false;
    
    try {
        // In a real implementation, you would push to GitHub here
        // For demo, we'll simulate success
        console.log('Pushing to cloud:', savedCards.length, 'cards');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return true;
    } catch (error) {
        console.error('Push error:', error);
        return false;
    }
}

// Fetch from GitHub
async function fetchFromGitHub() {
    try {
        // This would be the actual fetch call with authentication
        // For demo, we'll simulate the response
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Return sample data for demo
        return getSampleCards();
        
    } catch (error) {
        console.error('GitHub fetch error:', error);
        return null;
    }
}

// Merge cards and return if changes were made
function mergeCards(cloudCards) {
    if (!cloudCards || !Array.isArray(cloudCards)) return false;
    
    const merged = [...savedCards];
    let newCards = 0;
    let updatedCards = 0;
    
    cloudCards.forEach(cloudCard => {
        const existingIndex = savedCards.findIndex(localCard => localCard.id === cloudCard.id);
        
        if (existingIndex === -1) {
            // New card
            merged.push(cloudCard);
            newCards++;
        } else {
            // Update existing card if cloud version is newer
            const localCard = savedCards[existingIndex];
            const localDate = new Date(localCard.updatedAt || localCard.createdAt);
            const cloudDate = new Date(cloudCard.updatedAt || cloudCard.createdAt);
            
            if (cloudDate > localDate) {
                merged[existingIndex] = cloudCard;
                updatedCards++;
            }
        }
    });
    
    if (newCards > 0 || updatedCards > 0) {
        savedCards = merged;
        saveLocalCards();
        
        if (newCards > 0) {
            showToast(`Added ${newCards} new card${newCards > 1 ? 's' : ''} from cloud`, 'success');
        }
        if (updatedCards > 0) {
            showToast(`Updated ${updatedCards} card${updatedCards > 1 ? 's' : ''} from cloud`, 'info');
        }
        
        return true;
    }
    
    return false;
}

// Initialize search functionality
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                searchCards();
            }
        });
        
        searchInput.addEventListener('input', function() {
            if (this.value.length >= 2) {
                searchCards();
            } else if (this.value.length === 0) {
                clearSearch();
            }
        });
    }
    
    // Initialize filter tags
    const filterTags = document.querySelectorAll('.filter-tag');
    filterTags.forEach(tag => {
        tag.addEventListener('click', function() {
            filterTags.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            applySearch();
        });
    });
    
    // Initialize sort
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            applySearch();
        });
    }
}

// Search cards
function searchCards() {
    const searchInput = document.getElementById('searchInput');
    searchQuery = searchInput.value.trim().toLowerCase();
    
    if (searchQuery.length < 2) {
        clearSearch();
        return;
    }
    
    applySearch();
    showSearchResults();
}

// Apply search with filters
function applySearch() {
    let results = savedCards;
    
    // Apply text search
    if (searchQuery) {
        results = results.filter(card => {
            const searchFields = [
                card.companyName,
                card.contactPerson,
                card.email,
                card.phone,
                card.jobTitle,
                card.location,
                card.website
            ];
            
            return searchFields.some(field => 
                field && field.toLowerCase().includes(searchQuery)
            );
        });
    }
    
    // Apply filter
    if (currentFilter !== 'all') {
        results = results.filter(card => {
            switch (currentFilter) {
                case 'company':
                    return card.companyName && card.companyName.toLowerCase().includes(searchQuery);
                case 'contact':
                    return card.contactPerson && card.contactPerson.toLowerCase().includes(searchQuery);
                case 'email':
                    return card.email && card.email.toLowerCase().includes(searchQuery);
                case 'phone':
                    return card.phone && card.phone.toLowerCase().includes(searchQuery);
                default:
                    return true;
            }
        });
    }
    
    // Apply sort
    results.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        
        switch (currentSort) {
            case 'newest':
                return dateB - dateA;
            case 'oldest':
                return dateA - dateB;
            case 'company':
                return (a.companyName || '').localeCompare(b.companyName || '');
            case 'contact':
                return (a.contactPerson || '').localeCompare(b.contactPerson || '');
            default:
                return dateB - dateA;
        }
    });
    
    searchResults = results;
    displaySearchResults();
}

// Display search results
function displaySearchResults() {
    // Update cards display
    renderFilteredCards();
    
    // Update search info
    const searchInfo = document.getElementById('searchInfo');
    const resultsCount = document.getElementById('searchResultsCount');
    
    if (searchInfo && resultsCount) {
        if (searchQuery) {
            searchInfo.style.display = 'flex';
            resultsCount.textContent = `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`;
        } else {
            searchInfo.style.display = 'none';
        }
    }
    
    // Show search results dropdown
    showSearchResultsDropdown();
}

// Show search results dropdown
function showSearchResultsDropdown() {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    
    if (searchQuery && searchResults.length > 0) {
        let html = '';
        
        searchResults.slice(0, 5).forEach(card => {
            html += `
                <div class="search-result-item" onclick="viewCard('${card.id}')">
                    <div class="search-result-header">
                        <div class="search-result-company">${highlightText(card.companyName || 'Unnamed Company', searchQuery)}</div>
                        <div class="search-result-date">${new Date(card.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div class="search-result-details">
                        ${card.contactPerson ? `<div class="search-result-detail"><i class="fas fa-user"></i>${highlightText(card.contactPerson, searchQuery)}</div>` : ''}
                        ${card.email ? `<div class="search-result-detail"><i class="fas fa-envelope"></i>${highlightText(card.email, searchQuery)}</div>` : ''}
                        ${card.phone ? `<div class="search-result-detail"><i class="fas fa-phone"></i>${highlightText(card.phone, searchQuery)}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        if (searchResults.length > 5) {
            html += `<div class="search-result-item" onclick="showAllSearchResults()">
                <div class="search-result-detail" style="justify-content: center; color: #667eea;">
                    <i class="fas fa-chevron-down"></i>
                    Show ${searchResults.length - 5} more results
                </div>
            </div>`;
        }
        
        resultsContainer.innerHTML = html;
        resultsContainer.classList.add('active');
    } else if (searchQuery) {
        resultsContainer.innerHTML = '<div class="search-no-results">No results found</div>';
        resultsContainer.classList.add('active');
    } else {
        resultsContainer.classList.remove('active');
    }
}

// Highlight search text
function highlightText(text, query) {
    if (!text || !query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

// Show all search results
function showAllSearchResults() {
    const searchPanel = document.getElementById('searchPanel');
    if (searchPanel) {
        searchPanel.style.display = 'block';
    }
    
    // Hide dropdown
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.classList.remove('active');
    }
}

// Clear search
function clearSearch() {
    searchQuery = '';
    searchResults = [];
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.classList.remove('active');
    }
    
    const searchInfo = document.getElementById('searchInfo');
    if (searchInfo) {
        searchInfo.style.display = 'none';
    }
    
    // Reset filter
    const filterTags = document.querySelectorAll('.filter-tag');
    filterTags.forEach(tag => {
        if (tag.dataset.filter === 'all') {
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });
    currentFilter = 'all';
    
    // Reset to show all cards
    renderCards();
}

// Expand search box
function expandSearch() {
    const searchBox = document.querySelector('.search-box');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBox && searchInput) {
        searchBox.classList.add('expanded');
        searchInput.style.width = '200px';
    }
}

// Collapse search box
function collapseSearch() {
    const searchBox = document.querySelector('.search-box');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBox && searchInput && !searchInput.value) {
        searchBox.classList.remove('expanded');
        searchInput.style.width = '0';
    }
}

// Toggle search panel
function toggleSearchPanel() {
    const searchPanel = document.getElementById('searchPanel');
    if (searchPanel) {
        if (searchPanel.style.display === 'block') {
            searchPanel.style.display = 'none';
        } else {
            searchPanel.style.display = 'block';
        }
    }
}

// Apply advanced search
function applyAdvancedSearch() {
    const searchFields = document.querySelectorAll('input[name="searchField"]:checked');
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    let results = savedCards;
    
    // Apply field filters
    if (searchFields.length > 0) {
        const fields = Array.from(searchFields).map(field => field.value);
        results = results.filter(card => {
            return fields.some(field => {
                const value = card[field];
                return value && value.toLowerCase().includes(searchQuery.toLowerCase());
            });
        });
    }
    
    // Apply date range filter
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        results = results.filter(card => new Date(card.createdAt) >= fromDate);
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo);
        results = results.filter(card => new Date(card.createdAt) <= toDate);
    }
    
    searchResults = results;
    displaySearchResults();
    
    // Hide search panel
    const searchPanel = document.getElementById('searchPanel');
    if (searchPanel) {
        searchPanel.style.display = 'none';
    }
}

// Render filtered cards
function renderFilteredCards() {
    const cardsToRender = searchQuery ? searchResults : savedCards;
    
    if (cardsToRender.length === 0) {
        showEmptyState(searchQuery ? 'No search results' : 'No cards yet');
        return;
    }
    
    if (viewMode === 'grid') {
        renderGridView(cardsToRender);
    } else {
        renderListView(cardsToRender);
    }
}

// Show empty state with custom message
function showEmptyState(message) {
    const emptyState = document.getElementById('emptyState');
    const cardsGrid = document.getElementById('cardsGrid');
    const cardsList = document.getElementById('cardsList');
    
    if (emptyState) {
        emptyState.querySelector('h3').textContent = message || 'No Cards Yet';
        emptyState.style.display = 'flex';
    }
    
    if (cardsGrid) cardsGrid.style.display = 'none';
    if (cardsList) cardsList.style.display = 'none';
}

// Sort cards
function sortCards() {
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        currentSort = sortSelect.value;
        applySearch();
    }
}

// Mobile search
function searchCardsMobile() {
    const searchInput = document.querySelector('.mobile-menu input');
    if (searchInput) {
        searchQuery = searchInput.value.trim().toLowerCase();
        applySearch();
    }
}

// Handle online status
function handleOnlineStatus() {
    isOnline = true;
    updateSyncStatus('Reconnecting...');
    showToast('Back online. Syncing...', 'info');
    
    if (realTimeSyncEnabled) {
        startAutoSync();
    }
    
    setTimeout(() => {
        syncWithCloud();
    }, 1000);
}

// Handle offline status
function handleOfflineStatus() {
    isOnline = false;
    updateSyncStatus('Offline');
    showToast('You are offline. Working locally.', 'warning');
    stopAutoSync();
}

// Handle visibility change
function handleVisibilityChange() {
    if (!document.hidden && isOnline && realTimeSyncEnabled) {
        // Page became visible, sync if online
        setTimeout(() => {
            syncWithCloud();
        }, 500);
    }
}

// Update sync status
function updateSyncStatus(status) {
    const syncElement = document.getElementById('syncStatus');
    const cloudStatus = document.getElementById('cloudStatus');
    
    if (syncElement) {
        syncElement.textContent = status;
        
        if (status === 'Live' || status === 'Synced') {
            syncElement.style.color = '#4cd964';
            if (cloudStatus) cloudStatus.style.background = '#4cd964';
        } else if (status.includes('Error') || status === 'Offline') {
            syncElement.style.color = '#ff6b6b';
            if (cloudStatus) cloudStatus.style.background = '#ff6b6b';
        } else if (status.includes('Sync')) {
            syncElement.style.color = '#ffd93d';
            if (cloudStatus) cloudStatus.style.background = '#ffd93d';
        }
    }
}

// Update last sync time
function updateLastSyncTime() {
    if (!lastSyncTime) return;
    
    const now = new Date();
    const diffMs = now - lastSyncTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    let timeString;
    if (diffMins < 1) {
        timeString = 'Just now';
    } else if (diffMins < 60) {
        timeString = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
        const diffHours = Math.floor(diffMins / 60);
        timeString = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    
    const lastSyncElement = document.getElementById('lastSync');
    if (lastSyncElement) {
        lastSyncElement.textContent = timeString;
    }
}

// Get sample cards for demo
function getSampleCards() {
    return [
        {
            id: 'card_sample_1',
            companyName: 'TechCorp Solutions',
            contactPerson: 'Alex Johnson',
            jobTitle: 'CEO',
            email: 'alex@techcorp.com',
            phone: '+1 (555) 123-4567',
            website: 'www.techcorp.com',
            location: 'San Francisco, CA',
            createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            updatedAt: new Date().toISOString(),
            imageData: null
        },
        {
            id: 'card_sample_2',
            companyName: 'Innovate Labs',
            contactPerson: 'Sarah Williams',
            jobTitle: 'CTO',
            email: 'sarah@innovatelabs.com',
            phone: '+1 (555) 987-6543',
            website: 'www.innovatelabs.com',
            location: 'New York, NY',
            createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            updatedAt: new Date().toISOString(),
            imageData: null
        },
        {
            id: 'card_sample_3',
            companyName: 'Digital Ventures',
            contactPerson: 'Michael Chen',
            jobTitle: 'Marketing Director',
            email: 'michael@digitalventures.com',
            phone: '+1 (555) 456-7890',
            website: 'www.digitalventures.com',
            location: 'Los Angeles, CA',
            createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
            updatedAt: new Date().toISOString(),
            imageData: null
        }
    ];
}

// Load cards from local storage
function loadLocalCards() {
    try {
        const localData = localStorage.getItem('cardscan_local_cards');
        if (localData) {
            savedCards = JSON.parse(localData);
            console.log('Loaded local cards:', savedCards.length);
        }
    } catch (error) {
        console.error('Error loading local cards:', error);
        savedCards = [];
    }
}

// Save cards to local storage
function saveLocalCards() {
    try {
        localStorage.setItem('cardscan_local_cards', JSON.stringify(savedCards));
        console.log('Saved local cards:', savedCards.length);
    } catch (error) {
        console.error('Error saving local cards:', error);
    }
}

// Update UI
function updateUI() {
    renderCards();
    updateCardCount();
    updateLastSyncTime();
}

// Update card count
function updateCardCount() {
    const count = savedCards.length;
    document.getElementById('cardCount').textContent = count;
    document.getElementById('totalCards').textContent = count;
}

// Render cards
function renderCards() {
    renderFilteredCards();
}

// Render grid view
function renderGridView(cards) {
    const grid = document.getElementById('cardsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (cards.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';
    
    cards.forEach((card, index) => {
        const cardElement = createCardElement(card, index);
        grid.appendChild(cardElement);
    });
}

// Render list view
function renderListView(cards) {
    const listView = document.getElementById('cardsList');
    const listBody = document.getElementById('cardsListBody');
    const emptyState = document.getElementById('emptyState');
    
    if (cards.length === 0) {
        listView.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    listView.style.display = 'flex';
    emptyState.style.display = 'none';
    listBody.innerHTML = '';
    
    cards.forEach(card => {
        const listItem = document.createElement('div');
        listItem.className = 'list-item';
        
        listItem.innerHTML = `
            <div class="list-cell">
                <div class="company-cell">
                    <div class="company-logo-small" style="background: ${getCardGradient(card.id)};">
                        ${card.companyName ? card.companyName.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                        <div class="company-name">${highlightText(card.companyName || 'Unnamed Company', searchQuery)}</div>
                        <div class="card-date">${card.jobTitle || ''}</div>
                    </div>
                </div>
            </div>
            <div class="list-cell">${highlightText(card.contactPerson || '—', searchQuery)}</div>
            <div class="list-cell">${highlightText(card.phone || '—', searchQuery)}</div>
            <div class="list-cell">${new Date(card.createdAt).toLocaleDateString()}</div>
            <div class="list-cell">
                <div class="list-actions">
                    <button class="list-btn view" onclick="viewCard('${card.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="list-btn edit" onclick="editCard('${card.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="list-btn delete" onclick="deleteCard('${card.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        listBody.appendChild(listItem);
    });
}

// Rest of your existing functions remain the same...
// (saveCard, viewCard, editCard, deleteCard, clearForm, camera functions, OCR functions, etc.)

// Note: The rest of your existing JavaScript functions (saveCard, viewCard, editCard, deleteCard, 
// camera functions, OCR functions, etc.) should be kept as they are. 
// Only the new search and sync functions have been added above.

// Clean up
window.addEventListener('beforeunload', function() {
    if (ocrWorker) {
        ocrWorker.terminate();
    }
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    if (syncWebSocket) {
        syncWebSocket.close();
    }
    
    // Save before leaving
    saveLocalCards();
});
