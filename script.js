// script.js - Business Card Scanner Pro with Firebase Realtime Database

// Global variables
let savedCards = [];
let currentStream = null;
let currentCamera = 'back';
let flashEnabled = false;
let ocrWorker = null;
let extractedData = {};
let viewMode = 'grid';
let isOnline = navigator.onLine;
let userId = null;
let searchQuery = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1000);
    
    // Generate or get user ID
    userId = getUserId();
    
    // Initialize components
    await initializeApp();
    
    // Set up real-time listener
    setupRealtimeListener();
    
    // Handle online/offline status
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    // Initialize search functionality
    initializeSearch();
    
    // Update sync status
    updateSyncStatus('Connected');
});

// Generate user ID
function getUserId() {
    let id = localStorage.getItem('cardscan_user_id');
    if (!id) {
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cardscan_user_id', id);
    }
    return id;
}

// Initialize the app
async function initializeApp() {
    // Load local cards first
    loadLocalCards();
    
    // Update user ID display
    updateUserIdDisplay();
    
    // Initialize UI
    updateUI();
    
    // Show welcome message
    setTimeout(() => {
        showToast('Business Card Scanner Pro is ready!', 'success');
    }, 1500);
}

// Load cards from local storage
function loadLocalCards() {
    try {
        const localData = localStorage.getItem(`cardscan_local_cards_${userId}`);
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
        localStorage.setItem(`cardscan_local_cards_${userId}`, JSON.stringify(savedCards));
        console.log('Saved local cards:', savedCards.length);
    } catch (error) {
        console.error('Error saving local cards:', error);
    }
}

// Set up real-time Firebase listener
function setupRealtimeListener() {
    const cardsRef = firebase.database().ref('businessCards');
    
    cardsRef.orderByChild('userId').equalTo(userId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const cloudCards = Object.entries(data).map(([key, value]) => ({
                firebaseId: key,
                ...value
            }));
            mergeCards(cloudCards);
            updateUI();
            updateSyncStatus('Synced');
        }
    }, (error) => {
        console.error('Firebase error:', error);
        updateSyncStatus('Sync Error');
        showToast('Failed to sync with cloud', 'error');
    });
}

// Save card to Firebase
async function saveCardToFirebase(cardData) {
    try {
        const cardsRef = firebase.database().ref('businessCards');
        const newCardRef = cardsRef.push();
        await newCardRef.set({
            ...cardData,
            userId: userId,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
            syncedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Add Firebase ID to local card
        cardData.firebaseId = newCardRef.key;
        return true;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        return false;
    }
}

// Update card in Firebase
async function updateCardInFirebase(cardId, cardData) {
    try {
        const cardRef = firebase.database().ref(`businessCards/${cardId}`);
        await cardRef.update({
            ...cardData,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
            syncedAt: firebase.database.ServerValue.TIMESTAMP
        });
        return true;
    } catch (error) {
        console.error('Error updating in Firebase:', error);
        return false;
    }
}

// Delete card from Firebase
async function deleteCardFromFirebase(cardId) {
    try {
        const cardRef = firebase.database().ref(`businessCards/${cardId}`);
        await cardRef.remove();
        return true;
    } catch (error) {
        console.error('Error deleting from Firebase:', error);
        return false;
    }
}

// Merge local and cloud cards
function mergeCards(cloudCards) {
    if (!cloudCards || !Array.isArray(cloudCards)) return;
    
    const merged = [...savedCards];
    let newCards = 0;
    let updatedCards = 0;
    
    cloudCards.forEach(cloudCard => {
        const existingIndex = savedCards.findIndex(localCard => 
            localCard.firebaseId === cloudCard.firebaseId
        );
        
        if (existingIndex === -1) {
            // New card from cloud
            merged.push(cloudCard);
            newCards++;
        } else {
            // Update existing card if cloud version is newer
            const localCard = savedCards[existingIndex];
            const cloudDate = cloudCard.lastUpdated || 0;
            const localDate = localCard.lastUpdated || 0;
            
            if (cloudDate > localDate) {
                merged[existingIndex] = cloudCard;
                updatedCards++;
            }
        }
    });
    
    if (newCards > 0 || updatedCards > 0) {
        savedCards = merged;
        saveLocalCards();
        updateUI();
        
        if (newCards > 0) {
            showToast(`${newCards} new cards synced from cloud`, 'success');
        }
        if (updatedCards > 0) {
            console.log(`${updatedCards} cards updated from cloud`);
        }
    }
}

// Initialize search functionality
function initializeSearch() {
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        searchBox.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterCards();
        });
        
        // Add debounce for better performance
        searchBox.addEventListener('input', debounce(filterCards, 300));
    }
}

// Debounce function for search
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

// Clear search
function clearSearch() {
    document.getElementById('searchBox').value = '';
    searchQuery = '';
    filterCards();
}

// Filter cards based on search query
function filterCards() {
    if (!searchQuery) {
        renderCards();
        return;
    }
    
    const filteredCards = savedCards.filter(card => {
        return (
            (card.companyName && card.companyName.toLowerCase().includes(searchQuery)) ||
            (card.contactPerson && card.contactPerson.toLowerCase().includes(searchQuery)) ||
            (card.email && card.email.toLowerCase().includes(searchQuery)) ||
            (card.phone && card.phone.toLowerCase().includes(searchQuery)) ||
            (card.jobTitle && card.jobTitle.toLowerCase().includes(searchQuery)) ||
            (card.location && card.location.toLowerCase().includes(searchQuery))
        );
    });
    
    renderCards(filteredCards);
}

// Update search results count
function updateSearchResultsCount(filteredCount) {
    const totalCount = savedCards.length;
    const resultsElement = document.getElementById('searchResultsCount');
    const tipsElement = document.getElementById('searchTips');
    
    if (searchQuery) {
        resultsElement.innerHTML = `Showing <span class="search-highlight">${filteredCount}</span> of <span class="search-highlight">${totalCount}</span> cards`;
        tipsElement.innerHTML = 'Tip: Search by company, name, email, phone, job title, or location';
    } else {
        resultsElement.innerHTML = `Total: <span class="search-highlight">${totalCount}</span> cards`;
        tipsElement.innerHTML = 'Start typing to search through your cards';
    }
}

// Update UI
function updateUI() {
    filterCards();
    updateCardCount();
    updateLastSyncTime();
}

// Update card count
function updateCardCount() {
    const count = savedCards.length;
    document.getElementById('cardCount').textContent = count;
    document.getElementById('totalCards').textContent = count;
}

// Update last sync time
function updateLastSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('lastSync').textContent = timeString;
}

// Update user ID display
function updateUserIdDisplay() {
    const display = document.getElementById('userIdDisplay');
    const syncId = document.getElementById('userSyncId');
    const settingsId = document.getElementById('settingsUserId');
    
    if (display) {
        display.textContent = userId.substring(0, 8) + '...';
    }
    if (syncId) {
        syncId.textContent = userId;
    }
    if (settingsId) {
        settingsId.textContent = userId;
    }
}

// Copy user ID
function copyUserId() {
    navigator.clipboard.writeText(userId)
        .then(() => showToast('User ID copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy User ID', 'error'));
}

// Update sync status
function updateSyncStatus(status) {
    const syncElement = document.getElementById('syncStatus');
    if (syncElement) {
        syncElement.textContent = status;
        
        if (status === 'Connected' || status === 'Synced') {
            syncElement.style.color = '#4cd964';
        } else if (status.includes('Error')) {
            syncElement.style.color = '#ff6b6b';
        } else {
            syncElement.style.color = '#ffd93d';
        }
    }
}

// Save Card
async function saveCard() {
    const companyName = document.getElementById('companyName').value.trim();
    const contactPerson = document.getElementById('contactPerson').value.trim();
    
    if (!companyName && !contactPerson) {
        showToast('Please enter company name or contact person', 'warning');
        return;
    }
    
    const cardData = {
        id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        companyName,
        contactPerson,
        jobTitle: document.getElementById('jobTitle').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        createdAt: new Date().toISOString(),
        lastUpdated: Date.now(),
        imageData: extractedData.imageData || null,
        userId: userId
    };
    
    // Save to Firebase
    const success = await saveCardToFirebase(cardData);
    
    if (success) {
        // Save locally
        savedCards.push(cardData);
        saveLocalCards();
        
        // Update UI
        updateUI();
        
        // Clear form
        clearForm();
        
        // Show success animation
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
        setTimeout(() => {
            saveBtn.style.background = 'linear-gradient(135deg, #4cd964, #2ecc71)';
        }, 1000);
        
        showToast('Business card saved and synced!', 'success');
    } else {
        // Save locally only if Firebase fails
        savedCards.push(cardData);
        saveLocalCards();
        updateUI();
        clearForm();
        showToast('Card saved locally. Will sync when online.', 'warning');
    }
}

// Render cards with optional filtering
function renderCards(cards = savedCards) {
    const gridView = document.getElementById('cardsGrid');
    const listView = document.getElementById('cardsList');
    const listBody = document.getElementById('cardsListBody');
    const emptyState = document.getElementById('emptyState');
    
    // Update search results count
    updateSearchResultsCount(cards.length);
    
    if (cards.length === 0) {
        gridView.innerHTML = '';
        listBody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    
    if (viewMode === 'grid') {
        renderGridView(gridView, cards);
        listView.style.display = 'none';
        gridView.style.display = 'grid';
    } else {
        renderListView(listBody, cards);
        gridView.style.display = 'none';
        listView.style.display = 'flex';
    }
}

function renderGridView(container, cards) {
    container.innerHTML = '';
    
    cards.forEach((card, index) => {
        const cardElement = createCardElement(card, index);
        container.appendChild(cardElement);
    });
}

function renderListView(container, cards) {
    container.innerHTML = '';
    
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
                        <div class="company-name">${card.companyName || 'Unnamed Company'}</div>
                        <div class="card-date">${card.jobTitle || ''}</div>
                    </div>
                </div>
            </div>
            <div class="list-cell">${card.contactPerson || '—'}</div>
            <div class="list-cell">${card.phone || '—'}</div>
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
        
        container.appendChild(listItem);
    });
}

function createCardElement(card, index) {
    const cardElement = document.createElement('div');
    cardElement.className = 'business-card';
    cardElement.style.animationDelay = `${index * 0.1}s`;
    
    // Highlight search matches
    const highlightText = (text) => {
        if (!text || !searchQuery) return text || '—';
        const regex = new RegExp(`(${searchQuery})`, 'gi');
        return text.replace(regex, '<span class="search-match">$1</span>');
    };
    
    cardElement.innerHTML = `
        <div class="card-header">
            <div class="company-info">
                <div class="company-logo" style="background: ${getCardGradient(card.id)};">
                    ${card.companyName ? card.companyName.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                    <div class="company-name">${highlightText(card.companyName) || 'Unnamed Company'}</div>
                    <div class="card-date">${new Date(card.createdAt).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="card-status">
                <i class="fas fa-cloud" style="color: ${card.firebaseId ? '#4cd964' : '#667eea'};"></i>
            </div>
        </div>
        
        <div class="card-details">
            <div class="card-detail">
                <i class="fas fa-user-tie"></i>
                <span>${highlightText(card.contactPerson) || '—'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-id-badge"></i>
                <span>${highlightText(card.jobTitle) || '—'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-envelope"></i>
                <span>${highlightText(card.email) || '—'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-phone"></i>
                <span>${highlightText(card.phone) || '—'}</span>
            </div>
        </div>
        
        <div class="card-actions">
            <button class="card-btn view" onclick="viewCard('${card.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="card-btn edit" onclick="editCard('${card.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="card-btn delete" onclick="deleteCard('${card.id}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return cardElement;
}

function getCardGradient(id) {
    const gradients = [
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #4cd964, #2ecc71)',
        'linear-gradient(135deg, #ff6b6b, #ee5a24)',
        'linear-gradient(135deg, #ffd93d, #ff9f43)',
        'linear-gradient(135deg, #36d1dc, #5b86e5)',
        'linear-gradient(135deg, #9d50bb, #6e48aa)'
    ];
    
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
}

// View Card
function viewCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    const modal = document.getElementById('cardDetailsModal');
    const content = document.getElementById('cardDetailsContent');
    
    let html = `
        <div class="card-details-modal">
            <div class="card-preview" style="background: ${getCardGradient(cardId)}; padding: 25px; border-radius: 15px;">
                <div class="card-preview-header" style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                    <div class="card-logo" style="width: 50px; height: 50px; background: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: #333;">
                        ${card.companyName ? card.companyName.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                        <div class="card-preview-title" style="font-size: 24px; font-weight: 700; color: white;">${card.companyName || 'Business Card'}</div>
                        <div style="font-size: 14px; color: rgba(255, 255, 255, 0.9);">${card.jobTitle || ''}</div>
                    </div>
                </div>
                <div class="card-preview-details" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="detail-row" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: white;">
                        <i class="fas fa-user-tie"></i>
                        <span>${card.contactPerson || '—'}</span>
                    </div>
                    <div class="detail-row" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: white;">
                        <i class="fas fa-id-badge"></i>
                        <span>${card.jobTitle || '—'}</span>
                    </div>
                    <div class="detail-row" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: white;">
                        <i class="fas fa-envelope"></i>
                        <span>${card.email || '—'}</span>
                    </div>
                    <div class="detail-row" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: white;">
                        <i class="fas fa-phone"></i>
                        <span>${card.phone || '—'}</span>
                    </div>
                    <div class="detail-row" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: white;">
                        <i class="fas fa-globe"></i>
                        <span>${card.website || '—'}</span>
                    </div>
                    <div class="detail-row" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: white;">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${card.location || '—'}</span>
                    </div>
                </div>
                ${card.firebaseId ? `
                    <div style="margin-top: 15px; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.8);">
                            <i class="fas fa-cloud"></i> Synced to cloud
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="card-actions-modal" style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-modal edit" onclick="editCard('${cardId}'); closeCardModal();" style="flex: 1; padding: 12px; background: #667eea; border: none; border-radius: 10px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-edit"></i> Edit Card
                </button>
                <button class="btn-modal share" onclick="shareCard('${cardId}')" style="flex: 1; padding: 12px; background: #4cd964; border: none; border-radius: 10px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-share-alt"></i> Share
                </button>
                <button class="btn-modal delete" onclick="deleteCard('${cardId}'); closeCardModal();" style="flex: 1; padding: 12px; background: #ff6b6b; border: none; border-radius: 10px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
            
            ${card.imageData ? `
                <div class="card-original-image" style="margin-top: 20px;">
                    <h4 style="margin-bottom: 10px; color: white;">Original Scan:</h4>
                    <img src="${card.imageData}" alt="Original scan" style="max-width: 100%; border-radius: 10px;">
                </div>
            ` : ''}
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Edit Card
function editCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    // Populate form
    document.getElementById('companyName').value = card.companyName || '';
    document.getElementById('contactPerson').value = card.contactPerson || '';
    document.getElementById('jobTitle').value = card.jobTitle || '';
    document.getElementById('email').value = card.email || '';
    document.getElementById('phone').value = card.phone || '';
    document.getElementById('website').value = card.website || '';
    document.getElementById('location').value = card.location || '';
    
    // Update image preview if exists
    if (card.imageData) {
        updateImagePreview(card.imageData, 'existing_card.jpg');
    }
    
    // Change save button to update
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.innerHTML = '<i class="fas fa-sync"></i><span>Update Card</span>';
    saveBtn.dataset.editing = cardId;
    saveBtn.onclick = function() { updateCard(cardId); };
    
    showToast('Card loaded for editing', 'info');
}

// Update Card
async function updateCard(cardId) {
    const cardIndex = savedCards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const updatedCard = {
        ...savedCards[cardIndex],
        companyName: document.getElementById('companyName').value.trim(),
        contactPerson: document.getElementById('contactPerson').value.trim(),
        jobTitle: document.getElementById('jobTitle').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        lastUpdated: Date.now()
    };
    
    // Update in Firebase if it has a Firebase ID
    let firebaseSuccess = true;
    if (updatedCard.firebaseId) {
        firebaseSuccess = await updateCardInFirebase(updatedCard.firebaseId, updatedCard);
    }
    
    if (firebaseSuccess) {
        savedCards[cardIndex] = updatedCard;
        saveLocalCards();
        updateUI();
        
        // Reset save button
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.innerHTML = '<i class="fas fa-save"></i><span>Save Card</span>';
        delete saveBtn.dataset.editing;
        saveBtn.onclick = saveCard;
        
        showToast('Card updated and synced!', 'success');
        clearForm();
    } else {
        // Update locally only if Firebase fails
        savedCards[cardIndex] = updatedCard;
        saveLocalCards();
        updateUI();
        
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.innerHTML = '<i class="fas fa-save"></i><span>Save Card</span>';
        delete saveBtn.dataset.editing;
        saveBtn.onclick = saveCard;
        
        showToast('Card updated locally. Will sync when online.', 'warning');
        clearForm();
    }
}

// Delete Card
async function deleteCard(cardId) {
    if (!confirm('Delete this card?')) return;
    
    const cardIndex = savedCards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const card = savedCards[cardIndex];
    
    // Delete from Firebase if it has a Firebase ID
    let firebaseSuccess = true;
    if (card.firebaseId) {
        firebaseSuccess = await deleteCardFromFirebase(card.firebaseId);
    }
    
    if (firebaseSuccess || !card.firebaseId) {
        savedCards.splice(cardIndex, 1);
        saveLocalCards();
        updateUI();
        showToast('Card deleted!', 'success');
    } else {
        showToast('Failed to delete card from cloud. Check your connection.', 'error');
    }
}

// Clear Form
function clearForm() {
    document.getElementById('companyName').value = '';
    document.getElementById('contactPerson').value = '';
    document.getElementById('jobTitle').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('website').value = '';
    document.getElementById('location').value = '';
    
    // Reset image preview
    const preview = document.getElementById('previewImage');
    const overlay = document.getElementById('previewOverlay');
    preview.src = '';
    preview.style.display = 'none';
    overlay.style.display = 'flex';
    document.getElementById('fileName').textContent = 'No image selected';
    
    // Clear OCR results
    clearOCRResults();
    
    // Reset save button if editing
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn.dataset.editing) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i><span>Save Card</span>';
        delete saveBtn.dataset.editing;
        saveBtn.onclick = saveCard;
    }
}

// Camera Functions (Remain the same as before)
async function openCamera(cameraType = 'back') {
    currentCamera = cameraType;
    const modal = document.getElementById('cameraModal');
    modal.style.display = 'flex';
    
    // Update active button
    document.querySelectorAll('.scanner-option').forEach(opt => opt.classList.remove('active'));
    document.getElementById('cameraBtn').classList.add('active');
    
    await startCamera();
}

async function startCamera() {
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                facingMode: currentCamera === 'back' ? { exact: 'environment' } : 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('cameraFeed').srcObject = currentStream;
        
    } catch (err) {
        console.error('Camera error:', err);
        showToast('Camera access denied', 'error');
        closeCamera();
    }
}

function switchCamera() {
    currentCamera = currentCamera === 'back' ? 'front' : 'back';
    startCamera();
}

async function toggleFlash() {
    if (!currentStream) return;
    
    const track = currentStream.getVideoTracks()[0];
    const flashBtn = document.getElementById('flashBtn');
    
    try {
        if (track.getCapabilities && track.getCapabilities().torch) {
            await track.applyConstraints({
                advanced: [{ torch: !flashEnabled }]
            });
            flashEnabled = !flashEnabled;
            flashBtn.style.background = flashEnabled ? 'linear-gradient(135deg, #ffd93d, #ff9f43)' : 'rgba(255, 255, 255, 0.15)';
        }
    } catch (err) {
        showToast('Flash not available', 'warning');
    }
}

function captureImage() {
    if (!currentStream) return;
    
    const video = document.getElementById('cameraFeed');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    updateImagePreview(imageData, 'camera_capture.jpg');
    
    closeCamera();
    showToast('Image captured!', 'success');
    
    // Auto-start OCR
    setTimeout(() => {
        startOCRScan();
    }, 1000);
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');
    modal.style.display = 'none';
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

// File Upload
function openFilePicker() {
    document.getElementById('cardImageInput').click();
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        updateImagePreview(e.target.result, file.name);
        showToast('Image uploaded', 'success');
        
        setTimeout(() => {
            startOCRScan();
        }, 500);
    };
    reader.readAsDataURL(file);
}

function updateImagePreview(imageData, fileName) {
    const preview = document.getElementById('previewImage');
    const overlay = document.getElementById('previewOverlay');
    
    preview.src = imageData;
    preview.style.display = 'block';
    overlay.style.display = 'none';
    
    document.getElementById('fileName').textContent = fileName;
    extractedData.imageData = imageData;
}

// OCR Functions (Remain the same as before)
async function startOCRScan() {
    const preview = document.getElementById('previewImage');
    const progress = document.getElementById('ocrProgress');
    const scanBtn = document.getElementById('scanBtn');
    
    if (!preview.src || preview.src.includes('preview-placeholder')) {
        showToast('Please upload or capture an image first', 'warning');
        return;
    }
    
    // Initialize OCR worker
    if (!ocrWorker) {
        await initializeOCR();
    }
    
    // Show progress
    scanBtn.disabled = true;
    progress.style.display = 'block';
    
    try {
        const result = await ocrWorker.recognize(preview.src);
        await processOCRResults(result.data);
        
        progress.style.display = 'none';
        scanBtn.disabled = false;
        
        showToast('Text extracted successfully!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        progress.style.display = 'none';
        scanBtn.disabled = false;
        showToast('OCR failed. Try again.', 'error');
    }
}

async function initializeOCR() {
    ocrWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => updateOCRProgress(m)
    });
    await ocrWorker.load();
    await ocrWorker.loadLanguage('eng');
    await ocrWorker.initialize('eng');
}

function updateOCRProgress(message) {
    if (message.status === 'recognizing text') {
        const progress = Math.round(message.progress * 100);
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `${progress}%`;
    }
}

async function processOCRResults(ocrData) {
    extractedData = {
        rawText: ocrData.text,
        confidence: ocrData.confidence,
        items: []
    };
    
    const lines = ocrData.text.split('\n').filter(line => line.trim().length > 2);
    
    // Pattern matching
    const patterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        website: /(www\.|https?:\/\/)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/,
        jobTitle: /(CEO|CTO|CFO|COO|Director|Manager|Engineer|Developer|Designer|Analyst)/i
    };
    
    // Process lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Company name (first substantial line)
        if (i === 0 && line.length > 2 && line.length < 50) {
            extractedData.companyName = line;
            extractedData.items.push({ type: 'companyName', value: line, confidence: 85 });
        }
        
        // Email
        const emailMatch = line.match(patterns.email);
        if (emailMatch) {
            extractedData.email = emailMatch[0];
            extractedData.items.push({ type: 'email', value: emailMatch[0], confidence: 95 });
        }
        
        // Phone
        const phoneMatch = line.match(patterns.phone);
        if (phoneMatch) {
            extractedData.phone = phoneMatch[0];
            extractedData.items.push({ type: 'phone', value: phoneMatch[0], confidence: 90 });
        }
        
        // Website
        const websiteMatch = line.match(patterns.website);
        if (websiteMatch) {
            extractedData.website = websiteMatch[0];
            extractedData.items.push({ type: 'website', value: websiteMatch[0], confidence: 85 });
        }
        
        // Job title
        if (patterns.jobTitle.test(line)) {
            extractedData.jobTitle = line;
            extractedData.items.push({ type: 'jobTitle', value: line, confidence: 80 });
        }
        
        // Contact person (look for names)
        if (!extractedData.contactPerson && i > 0 && line.length > 3 && line.length < 30) {
            const words = line.split(' ');
            if (words.length >= 2 && words.length <= 3) {
                if (words.every(w => w[0] === w[0].toUpperCase())) {
                    extractedData.contactPerson = line;
                    extractedData.items.push({ type: 'contactPerson', value: line, confidence: 75 });
                }
            }
        }
    }
    
    displayOCRResults();
}

function displayOCRResults() {
    const section = document.getElementById('ocrResultsSection');
    const container = document.getElementById('ocrResults');
    
    if (extractedData.items.length === 0) {
        container.innerHTML = '<div class="result-item"><span class="result-value">No data found</span></div>';
        section.style.display = 'block';
        return;
    }
    
    let html = '';
    const fieldLabels = {
        companyName: 'Company',
        contactPerson: 'Contact',
        email: 'Email',
        phone: 'Phone',
        website: 'Website',
        jobTitle: 'Job Title',
        location: 'Location'
    };
    
    extractedData.items.forEach(item => {
        html += `
            <div class="result-item">
                <span class="result-field">${fieldLabels[item.type] || item.type}</span>
                <span class="result-value">${item.value}</span>
                <span class="result-confidence">${item.confidence}%</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
    section.style.display = 'block';
}

function applyOCRResults() {
    if (!extractedData.items || extractedData.items.length === 0) {
        showToast('No data to apply', 'warning');
        return;
    }
    
    extractedData.items.forEach(item => {
        const field = document.getElementById(item.type);
        if (field) {
            field.value = item.value;
            
            // Animation
            field.style.transform = 'scale(1.05)';
            setTimeout(() => {
                field.style.transform = 'scale(1)';
            }, 300);
        }
    });
    
    showToast(`Applied ${extractedData.items.length} fields`, 'success');
}

function clearOCRResults() {
    document.getElementById('ocrResultsSection').style.display = 'none';
    extractedData.items = [];
}

// View Mode
function setViewMode(mode) {
    viewMode = mode;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    renderCards();
}

// Refresh cards
function refreshCards() {
    renderCards();
    showToast('Cards refreshed', 'info');
}

// Quick Actions
function startQuickScan() {
    openCamera('back');
}

function quickFill() {
    // Fill form with sample data
    document.getElementById('companyName').value = 'Tech Innovations Inc';
    document.getElementById('contactPerson').value = 'John Smith';
    document.getElementById('jobTitle').value = 'Senior Developer';
    document.getElementById('email').value = 'john@techinnovations.com';
    document.getElementById('phone').value = '+1 (555) 123-4567';
    document.getElementById('website').value = 'www.techinnovations.com';
    document.getElementById('location').value = 'Silicon Valley, CA';
    
    showToast('Form filled with sample data', 'info');
}

// Share Card
function shareCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    const text = `Business Card: ${card.companyName}\nContact: ${card.contactPerson}\nEmail: ${card.email}\nPhone: ${card.phone}`;
    
    if (navigator.share) {
        navigator.share({
            title: `${card.companyName} - Business Card`,
            text: text,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Card details copied', 'success'))
            .catch(() => showToast('Failed to share', 'error'));
    }
}

// Export All Cards
function exportAllCards() {
    if (savedCards.length === 0) {
        showToast('No cards to export', 'warning');
        return;
    }
    
    const dataStr = JSON.stringify(savedCards, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `business_cards_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showToast(`Exported ${savedCards.length} cards`, 'success');
}

// Clear All Cards
async function clearAllCards() {
    if (!confirm('Delete ALL cards? This cannot be undone.')) return;
    
    // Delete all cards from Firebase
    try {
        for (const card of savedCards) {
            if (card.firebaseId) {
                await deleteCardFromFirebase(card.firebaseId);
            }
        }
    } catch (error) {
        console.error('Error clearing cards from Firebase:', error);
    }
    
    savedCards = [];
    saveLocalCards();
    updateUI();
    showToast('All cards deleted!', 'success');
}

// Generate QR Code
function generateQR() {
    const cardData = {
        companyName: document.getElementById('companyName').value,
        contactPerson: document.getElementById('contactPerson').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        website: document.getElementById('website').value,
        location: document.getElementById('location').value,
        jobTitle: document.getElementById('jobTitle').value
    };
    
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = '';
    
    QRCode.toCanvas(qrContainer, JSON.stringify(cardData), { width: 200 }, function(error) {
        if (error) {
            showToast('Failed to generate QR code', 'error');
            return;
        }
        
        document.getElementById('qrModal').style.display = 'flex';
    });
}

// Download QR Code
function downloadQR() {
    const canvas = document.querySelector('#qrContainer canvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `business_card_qr_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    showToast('QR code downloaded', 'success');
}

// Close Modals
function closeCardModal() {
    document.getElementById('cardDetailsModal').style.display = 'none';
}

function closeQRModal() {
    document.getElementById('qrModal').style.display = 'none';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Show All Cards
function showAllCards() {
    setViewMode('grid');
    showPanel('cards');
}

// Show Panel
function showPanel(panelName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Scroll to panel
    const panel = document.querySelector(`.${panelName}-panel`);
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth' });
    }
}

// Show Settings
function showSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
}

// Toggle Menu
function toggleMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('active');
}

// Reset Settings
function resetSettings() {
    localStorage.removeItem('cardscan_settings');
    showToast('Settings reset to defaults', 'success');
}

// Clear All Data
function clearAllData() {
    if (!confirm('Clear ALL data including settings?')) return;
    
    localStorage.clear();
    savedCards = [];
    renderCards();
    updateCardCount();
    
    showToast('All data cleared', 'success');
}

// Handle online/offline status
function handleOnlineStatus() {
    isOnline = true;
    updateSyncStatus('Syncing...');
    showToast('Back online. Syncing...', 'info');
}

function handleOfflineStatus() {
    isOnline = false;
    updateSyncStatus('Offline');
    showToast('You are offline. Working locally.', 'warning');
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
            <div class="toast-time">${timeString}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

// Clean up
window.addEventListener('beforeunload', function() {
    if (ocrWorker) {
        ocrWorker.terminate();
    }
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    // Save before leaving
    saveLocalCards();
});
