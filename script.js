// Configuration
const CONFIG = {
    SYNC_INTERVAL: 30000,
    MAX_CARDS_DISPLAY: 50, // Limit displayed cards
    PAGINATION_SIZE: 10
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
let currentPage = 1;
let filteredCards = [];
let currentSearch = '';

// Card data from your images
const SAMPLE_CARDS = [
    {
        id: 'card_1',
        companyName: 'TechCorp Solutions',
        contactPerson: 'Alex Johnson',
        jobTitle: 'CEO',
        email: 'alex@techcorp.com',
        phone: '+1 (555) 123-4567',
        website: 'www.techcorp.com',
        location: 'San Francisco, CA',
        createdAt: '2026-02-04T10:30:00Z',
        imageData: null
    },
    {
        id: 'card_2',
        companyName: 'Innovate Labs',
        contactPerson: 'Sarah Williams',
        jobTitle: 'CTO',
        email: 'sarah@innovatelabs.com',
        phone: '+1 (555) 987-6543',
        website: 'www.innovatelabs.com',
        location: 'New York, NY',
        createdAt: '2026-02-04T11:15:00Z',
        imageData: null
    },
    {
        id: 'card_3',
        companyName: 'Sligent',
        contactPerson: 'Manish Joshi',
        jobTitle: 'India Country Manager',
        email: 'manish.joshi@sligient.com',
        phone: '',
        website: '',
        location: 'India',
        createdAt: '2026-02-04T12:00:00Z',
        imageData: null
    },
    {
        id: 'card_4',
        companyName: 'Revintech',
        contactPerson: 'Amit Kradke',
        jobTitle: 'Sr Manager',
        email: 'amit.kradke@revintech.com',
        phone: '',
        website: '',
        location: '',
        createdAt: '2026-02-04T12:45:00Z',
        imageData: null
    },
    {
        id: 'card_5',
        companyName: 'Interface',
        contactPerson: 'HEMANT DAROLI',
        jobTitle: '',
        email: 'sales@interfaceandc.com',
        phone: '9373040053',
        website: '',
        location: '',
        createdAt: '2026-02-04T13:30:00Z',
        imageData: null
    },
    {
        id: 'card_6',
        companyName: 'Faulhaber',
        contactPerson: '',
        jobTitle: '',
        email: '',
        phone: '',
        website: '',
        location: '',
        createdAt: '2026-02-04T14:15:00Z',
        imageData: null
    }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1000);
    
    // Initialize app
    await initializeApp();
    
    // Setup responsive listeners
    setupResponsiveListeners();
    
    // Show welcome
    setTimeout(() => {
        showToast('Card Scanner is ready!', 'success');
    }, 1500);
});

// Initialize the app
async function initializeApp() {
    // Load local cards
    loadLocalCards();
    
    // If no cards, load samples
    if (savedCards.length === 0) {
        savedCards = [...SAMPLE_CARDS];
        saveLocalCards();
    }
    
    // Initialize UI
    updateUI();
    
    // Start auto-sync
    startAutoSync();
    
    // Handle online/offline status
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    // Update mobile badge
    updateMobileBadge();
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
    updateMobileBadge();
}

function updateCardCount() {
    const count = savedCards.length;
    document.getElementById('cardCount').textContent = count;
    document.getElementById('totalCards').textContent = count;
    document.getElementById('mobileCardCount').textContent = count;
}

function updateMobileBadge() {
    const badge = document.getElementById('mobileCardCount');
    if (badge) {
        badge.textContent = savedCards.length;
        badge.style.display = savedCards.length > 0 ? 'flex' : 'none';
    }
}

function updateLastSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('lastSync').textContent = timeString;
}

// Card rendering with responsive logic
function renderCards() {
    const gridView = document.getElementById('cardsGrid');
    const listView = document.getElementById('cardsList');
    const listBody = document.getElementById('cardsListBody');
    const emptyState = document.getElementById('emptyState');
    
    if (savedCards.length === 0) {
        gridView.innerHTML = '';
        listBody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Apply search filter if any
    filteredCards = currentSearch ? 
        savedCards.filter(card => 
            (card.companyName && card.companyName.toLowerCase().includes(currentSearch)) ||
            (card.contactPerson && card.contactPerson.toLowerCase().includes(currentSearch)) ||
            (card.email && card.email.toLowerCase().includes(currentSearch))
        ) : savedCards;
    
    // Paginate
    const startIndex = (currentPage - 1) * CONFIG.PAGINATION_SIZE;
    const endIndex = startIndex + CONFIG.PAGINATION_SIZE;
    const cardsToDisplay = filteredCards.slice(startIndex, endIndex);
    
    if (viewMode === 'grid') {
        renderGridView(gridView, cardsToDisplay);
        listView.style.display = 'none';
        gridView.style.display = 'grid';
    } else {
        renderListView(listBody, cardsToDisplay);
        gridView.style.display = 'none';
        listView.style.display = 'flex';
    }
    
    // Add pagination if needed
    addPagination();
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
    
    // Format date
    const date = new Date(card.createdAt);
    const dateString = date.toLocaleDateString();
    
    cardElement.innerHTML = `
        <div class="card-header">
            <div class="company-info">
                <div class="company-logo" style="background: ${getCardGradient(card.id)};">
                    ${card.companyName ? card.companyName.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                    <div class="company-name">${card.companyName || 'Unnamed Company'}</div>
                    <div class="card-date">${dateString}</div>
                </div>
            </div>
            <div class="card-status">
                <i class="fas fa-cloud" style="color: #667eea;"></i>
            </div>
        </div>
        
        <div class="card-details">
            <div class="card-detail">
                <i class="fas fa-user-tie"></i>
                <span>${card.contactPerson || '—'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-id-badge"></i>
                <span>${card.jobTitle || '—'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-envelope"></i>
                <span>${card.email || '—'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-phone"></i>
                <span>${card.phone || '—'}</span>
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

function addPagination() {
    const totalPages = Math.ceil(filteredCards.length / CONFIG.PAGINATION_SIZE);
    if (totalPages <= 1) return;
    
    const container = document.querySelector('.cards-container');
    let pagination = container.querySelector('.pagination');
    
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.className = 'pagination';
        container.appendChild(pagination);
    }
    
    pagination.innerHTML = `
        <button class="page-btn" onclick="previousPage()" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
        <button class="page-btn" onclick="nextPage()" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderCards();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredCards.length / CONFIG.PAGINATION_SIZE);
    if (currentPage < totalPages) {
        currentPage++;
        renderCards();
    }
}

// Setup responsive listeners
function setupResponsiveListeners() {
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            adjustLayoutForScreenSize();
        }, 250);
    });
    
    // Initial adjustment
    adjustLayoutForScreenSize();
}

function adjustLayoutForScreenSize() {
    const width = window.innerWidth;
    const cardsGrid = document.getElementById('cardsGrid');
    
    if (width < 768) {
        // Mobile: Single column, smaller cards
        if (cardsGrid) {
            cardsGrid.style.gridTemplateColumns = '1fr';
        }
        // Show mobile nav, hide desktop features
        document.querySelector('.bottom-nav').style.display = 'flex';
        document.querySelector('.quick-actions').style.display = 'flex';
        document.querySelector('.header-stats').style.display = 'none';
    } else if (width < 1200) {
        // Tablet: Two columns
        if (cardsGrid) {
            cardsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
        }
        // Show/hide appropriate elements
        document.querySelector('.bottom-nav').style.display = 'none';
        document.querySelector('.quick-actions').style.display = 'none';
        document.querySelector('.header-stats').style.display = 'flex';
    } else {
        // Desktop: Three columns
        if (cardsGrid) {
            cardsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        }
        document.querySelector('.bottom-nav').style.display = 'none';
        document.querySelector('.quick-actions').style.display = 'none';
        document.querySelector('.header-stats').style.display = 'flex';
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
    
    const cardId = 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const cardData = {
        id: cardId,
        companyName,
        contactPerson,
        jobTitle: document.getElementById('jobTitle').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        createdAt: new Date().toISOString(),
        imageData: extractedData.imageData || null
    };
    
    // Save locally
    savedCards.push(cardData);
    saveLocalCards();
    
    // Reset pagination
    currentPage = 1;
    
    // Update UI
    renderCards();
    updateCardCount();
    updateMobileBadge();
    
    // Clear form
    clearForm();
    
    // Show success animation
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    setTimeout(() => {
        saveBtn.style.background = 'linear-gradient(135deg, #4cd964, #2ecc71)';
    }, 1000);
    
    showToast('Business card saved!', 'success');
}

// View Card
function viewCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    const modal = document.getElementById('cardDetailsModal');
    const content = document.getElementById('cardDetailsContent');
    
    // Format date
    const date = new Date(card.createdAt);
    const dateString = date.toLocaleDateString();
    const timeString = date.toLocaleTimeString();
    
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
                        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">Added: ${dateString} ${timeString}</div>
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
    
    savedCards[cardIndex] = {
        ...savedCards[cardIndex],
        companyName: document.getElementById('companyName').value.trim(),
        contactPerson: document.getElementById('contactPerson').value.trim(),
        jobTitle: document.getElementById('jobTitle').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        updatedAt: new Date().toISOString()
    };
    
    saveLocalCards();
    
    // Reset pagination
    currentPage = 1;
    
    renderCards();
    
    // Reset save button
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.innerHTML = '<i class="fas fa-save"></i><span>Save Card</span>';
    delete saveBtn.dataset.editing;
    saveBtn.onclick = saveCard;
    
    showToast('Card updated!', 'success');
    clearForm();
}

// Delete Card
async function deleteCard(cardId) {
    if (!confirm('Delete this card?')) return;
    
    savedCards = savedCards.filter(card => card.id !== cardId);
    saveLocalCards();
    
    // Reset pagination
    currentPage = 1;
    
    renderCards();
    updateCardCount();
    updateMobileBadge();
    
    showToast('Card deleted', 'success');
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

// View Mode
function setViewMode(mode) {
    viewMode = mode;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Reset pagination
    currentPage = 1;
    
    renderCards();
}

// Refresh cards
function refreshCards() {
    // Reset search and pagination
    currentSearch = '';
    currentPage = 1;
    
    renderCards();
    showToast('Cards refreshed', 'info');
}

// Search cards
function searchCards(query) {
    currentSearch = query.toLowerCase();
    currentPage = 1;
    renderCards();
    
    if (currentSearch && filteredCards.length > 0) {
        showToast(`Found ${filteredCards.length} cards`, 'info');
    }
}

// Show All Cards
function showAllCards() {
    // Reset search
    currentSearch = '';
    currentPage = 1;
    
    // Set grid view
    setViewMode('grid');
    
    // Show cards panel
    showPanel('cards');
    
    // Update mobile nav
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.nav-btn:nth-child(3)').classList.add('active');
}

// Show Panel
function showPanel(panelName) {
    // Hide all panels
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Show selected panel
    const panel = document.getElementById(panelName + 'Panel');
    if (panel) {
        panel.classList.add('active');
    }
    
    // Update navigation
    if (window.innerWidth < 768) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }
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
    
    savedCards = [];
    saveLocalCards();
    
    // Reset pagination
    currentPage = 1;
    
    renderCards();
    updateCardCount();
    updateMobileBadge();
    
    showToast('All cards deleted', 'success');
}

// Copy URL
function copyURL() {
    const url = 'https://ansh200229.github.io/Ansh_Business-card-scanner/';
    navigator.clipboard.writeText(url)
        .then(() => showToast('URL copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy URL', 'error'));
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
    currentPage = 1;
    
    renderCards();
    updateCardCount();
    updateMobileBadge();
    
    showToast('All data cleared', 'success');
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
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

// Start auto-sync
function startAutoSync() {
    if (syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(async () => {
        if (isOnline) {
            await syncWithCloud();
        }
    }, CONFIG.SYNC_INTERVAL);
}

// Update sync status
function updateSyncStatus(status) {
    const syncElement = document.getElementById('syncStatus');
    if (syncElement) {
        syncElement.textContent = status;
        
        if (status === 'Synced' || status === 'Live') {
            syncElement.style.color = '#4cd964';
        } else if (status.includes('Failed')) {
            syncElement.style.color = '#ff6b6b';
        } else {
            syncElement.style.color = '#ffd93d';
        }
    }
}

// Handle online/offline status
function handleOnlineStatus() {
    isOnline = true;
    showToast('Back online. Syncing...', 'info');
    updateSyncStatus('Syncing...');
    syncWithCloud();
}

function handleOfflineStatus() {
    isOnline = false;
    showToast('You are offline. Working locally.', 'warning');
    updateSyncStatus('Offline');
}

// Camera and OCR functions remain the same...
// [Previous camera and OCR code here - unchanged]

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
    
    // Save before leaving
    saveLocalCards();
});
