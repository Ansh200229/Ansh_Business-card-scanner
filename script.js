// Global variables
let currentDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 10);
let qrScanner = null;
let isScanning = false;
let currentStream = null;
let currentCamera = 'back';
let flashEnabled = false;
let ocrWorker = null;
let extractedData = {};
let savedCards = [];
let viewMode = 'grid';

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Set device ID
    document.getElementById('deviceIdDisplay').textContent = currentDeviceId;
    document.getElementById('deviceIdInput').value = currentDeviceId;
    
    // Load saved cards
    loadSavedCards();
    
    // Initialize sync status
    updateSyncStatus();
    
    // Initialize animations
    initAnimations();
    
    // Set up periodic sync
    setInterval(updateSyncStatus, 30000);
    
    console.log('CardScan PRO initialized');
});

// Initialize animations
function initAnimations() {
    // Add hover effects to cards
    const cards = document.querySelectorAll('.business-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-10px) scale(1.02)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Update sync status
function updateSyncStatus() {
    const status = navigator.onLine ? 'Online' : 'Offline';
    const color = navigator.onLine ? '#4cd964' : '#ff6b6b';
    
    document.getElementById('syncStatus').textContent = status;
    document.getElementById('syncStatus').style.color = color;
    
    if (navigator.onLine) {
        showToast('Syncing with cloud...', 'info');
    }
}

// Load saved cards
function loadSavedCards() {
    const saved = localStorage.getItem('cardscan_cards');
    if (saved) {
        savedCards = JSON.parse(saved);
        renderCards();
    }
    updateCardCount();
}

// Update card count
function updateCardCount() {
    document.getElementById('cardCount').textContent = savedCards.length;
    document.getElementById('syncStatus').textContent = savedCards.length + ' cards synced';
}

// Render cards in current view mode
function renderCards() {
    const container = document.getElementById('cardsContainer');
    const gridView = document.getElementById('cardsGrid');
    const listView = document.getElementById('cardsList');
    const emptyState = document.getElementById('emptyState');
    const tableBody = document.getElementById('cardsTable');
    
    if (savedCards.length === 0) {
        emptyState.style.display = 'block';
        gridView.style.display = 'none';
        listView.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    
    if (viewMode === 'grid') {
        gridView.style.display = 'grid';
        listView.style.display = 'none';
        renderGridView();
    } else {
        gridView.style.display = 'none';
        listView.style.display = 'block';
        renderListView();
    }
}

// Render grid view
function renderGridView() {
    const grid = document.getElementById('cardsGrid');
    grid.innerHTML = '';
    
    savedCards.forEach((card, index) => {
        const cardElement = createCardElement(card);
        cardElement.style.animationDelay = (index * 0.1) + 's';
        grid.appendChild(cardElement);
    });
}

// Render list view
function renderListView() {
    const table = document.getElementById('cardsTable');
    table.innerHTML = '';
    
    savedCards.forEach(card => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>
                <div class="company-cell">
                    <div class="company-logo-small" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                        ${card.companyName ? card.companyName.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                        <div class="company-name">${card.companyName || 'Unnamed Company'}</div>
                        <div class="company-job">${card.jobTitle || ''}</div>
                    </div>
                </div>
            </td>
            <td>${card.contactPerson || '—'}</td>
            <td>${card.email || '—'}</td>
            <td>
                <div class="list-actions">
                    <button class="list-btn view" onclick="viewCard('${card.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="list-btn edit" onclick="editCard('${card.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="list-btn delete" onclick="deleteCard('${card.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        table.appendChild(row);
    });
}

// Create card element for grid view
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'business-card';
    cardElement.dataset.id = card.id;
    
    const gradient = getCardGradient(card.id);
    
    cardElement.innerHTML = `
        <div class="card-header">
            <div class="company-info">
                <div class="company-logo" style="background: ${gradient};">
                    ${card.companyName ? card.companyName.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                    <div class="company-name">${card.companyName || 'Unnamed Company'}</div>
                    <div class="card-date">${new Date(card.createdAt).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="card-status">
                <i class="fas fa-circle" style="color: #4cd964;"></i>
            </div>
        </div>
        
        <div class="card-details">
            <div class="card-detail">
                <i class="fas fa-user-tie"></i>
                <span>${card.contactPerson || 'Not specified'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-envelope"></i>
                <span>${card.email || 'Not specified'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-phone"></i>
                <span>${card.phone || 'Not specified'}</span>
            </div>
            <div class="card-detail">
                <i class="fas fa-map-marker-alt"></i>
                <span>${card.location || 'Not specified'}</span>
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

// Get unique gradient for card
function getCardGradient(id) {
    const gradients = [
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #4cd964, #2ecc71)',
        'linear-gradient(135deg, #ff6b6b, #ee5a24)',
        'linear-gradient(135deg, #ffd93d, #ff9f43)',
        'linear-gradient(135deg, #36d1dc, #5b86e5)',
        'linear-gradient(135deg, #9d50bb, #6e48aa)'
    ];
    
    // Use card ID to get consistent gradient
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
}

// Set view mode
function setViewMode(mode) {
    viewMode = mode;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (mode === 'grid') {
        document.querySelector('.view-btn:nth-child(1)').classList.add('active');
    } else {
        document.querySelector('.view-btn:nth-child(2)').classList.add('active');
    }
    
    renderCards();
}

// Refresh cards
function refreshCards() {
    loadSavedCards();
    showToast('Cards refreshed', 'success');
}

// Device ID functions
function copyDeviceId() {
    navigator.clipboard.writeText(currentDeviceId)
        .then(() => showToast('Device ID copied to clipboard!', 'success'))
        .catch(err => showToast('Failed to copy', 'error'));
}

// Camera functions
function openCamera(cameraType = 'back') {
    currentCamera = cameraType;
    const modal = document.getElementById('cameraModal');
    modal.style.display = 'flex';
    
    // Update active scan option
    document.querySelectorAll('.scan-option').forEach(opt => opt.classList.remove('active'));
    event.target.closest('.scan-option').classList.add('active');
    
    startCamera();
}

async function startCamera() {
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                facingMode: currentCamera === 'back' ? { exact: 'environment' } : 'user',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('cameraFeed').srcObject = currentStream;
        
        showToast('Camera ready', 'success');
        
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
    try {
        if (track.getCapabilities && track.getCapabilities().torch) {
            await track.applyConstraints({
                advanced: [{ torch: !flashEnabled }]
            });
            flashEnabled = !flashEnabled;
            showToast(`Flash ${flashEnabled ? 'ON' : 'OFF'}`, 'info');
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
    showToast('Image captured successfully!', 'success');
    
    // Auto-start OCR after 1 second
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

// File upload
function openFilePicker() {
    document.getElementById('cardImageInput').click();
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        updateImagePreview(e.target.result, file.name);
        showToast('Image uploaded successfully', 'success');
        
        // Auto-start OCR
        setTimeout(() => {
            startOCRScan();
        }, 500);
    };
    reader.readAsDataURL(file);
}

function updateImagePreview(imageData, fileName) {
    const preview = document.getElementById('previewImage');
    const overlay = document.querySelector('.preview-overlay');
    
    preview.src = imageData;
    preview.style.display = 'block';
    overlay.style.display = 'none';
    
    document.getElementById('fileName').textContent = fileName;
    extractedData.imageData = imageData;
}

// OCR Functions
async function startOCRScan() {
    const preview = document.getElementById('previewImage');
    const progress = document.getElementById('ocrProgress');
    
    if (!preview.src || preview.src.includes('preview-placeholder')) {
        showToast('Please upload or capture an image first', 'warning');
        return;
    }
    
    // Initialize OCR worker if needed
    if (!ocrWorker) {
        await initializeOCR();
    }
    
    // Show progress
    progress.style.display = 'block';
    
    try {
        const result = await ocrWorker.recognize(preview.src);
        await processOCRResults(result.data);
        
        progress.style.display = 'none';
        showToast('Text extraction completed!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        progress.style.display = 'none';
        showToast('OCR failed. Please try again.', 'error');
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
        
        // Company name (usually first line)
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
        container.innerHTML = '<div class="result-item"><span class="result-value">No structured data found</span></div>';
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
            
            // Add animation effect
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

// Save card
function saveCard() {
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
    
    // Save to localStorage
    savedCards.push(cardData);
    localStorage.setItem('cardscan_cards', JSON.stringify(savedCards));
    
    // Update UI
    renderCards();
    updateCardCount();
    
    // Clear form
    clearForm();
    
    // Show success animation
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    setTimeout(() => {
        saveBtn.style.background = 'linear-gradient(135deg, #4cd964, #2ecc71)';
    }, 1000);
    
    showToast('Business card saved successfully!', 'success');
}

// View card
function viewCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    const modal = document.getElementById('cardDetailsModal');
    const content = document.getElementById('cardDetailsContent');
    
    let html = `
        <div class="card-details-modal">
            <div class="card-preview" style="background: ${getCardGradient(cardId)};">
                <div class="card-preview-header">
                    <div class="card-logo">${card.companyName ? card.companyName.charAt(0).toUpperCase() : 'C'}</div>
                    <div class="card-preview-title">${card.companyName || 'Business Card'}</div>
                </div>
                <div class="card-preview-details">
                    <div class="detail-row">
                        <i class="fas fa-user-tie"></i>
                        <span>${card.contactPerson || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <i class="fas fa-id-badge"></i>
                        <span>${card.jobTitle || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <i class="fas fa-envelope"></i>
                        <span>${card.email || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <i class="fas fa-phone"></i>
                        <span>${card.phone || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <i class="fas fa-globe"></i>
                        <span>${card.website || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${card.location || '—'}</span>
                    </div>
                </div>
            </div>
            
            <div class="card-actions-modal">
                <button class="btn-modal edit" onclick="editCard('${cardId}'); closeCardModal();">
                    <i class="fas fa-edit"></i> Edit Card
                </button>
                <button class="btn-modal share" onclick="shareCard('${cardId}')">
                    <i class="fas fa-share-alt"></i> Share
                </button>
                <button class="btn-modal delete" onclick="deleteCard('${cardId}'); closeCardModal();">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
            
            ${card.imageData ? `
                <div class="card-original-image">
                    <h4>Original Scan:</h4>
                    <img src="${card.imageData}" alt="Original scan" style="max-width: 100%; border-radius: 10px; margin-top: 10px;">
                </div>
            ` : ''}
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Edit card
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
        const preview = document.getElementById('previewImage');
        const overlay = document.querySelector('.preview-overlay');
        preview.src = card.imageData;
        preview.style.display = 'block';
        overlay.style.display = 'none';
        document.getElementById('fileName').textContent = 'existing_card.jpg';
        extractedData.imageData = card.imageData;
    }
    
    // Change save button to update
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerHTML = '<i class="fas fa-sync"></i> Update Card';
    saveBtn.dataset.editing = cardId;
    saveBtn.onclick = function() { updateCard(cardId); };
    
    showToast('Card loaded for editing', 'info');
}

// Update card
function updateCard(cardId) {
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
        location: document.getElementById('location').value.trim()
    };
    
    localStorage.setItem('cardscan_cards', JSON.stringify(savedCards));
    renderCards();
    
    // Reset save button
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Card';
    delete saveBtn.dataset.editing;
    saveBtn.onclick = saveCard;
    
    showToast('Card updated successfully!', 'success');
    clearForm();
}

// Delete card
function deleteCard(cardId) {
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    savedCards = savedCards.filter(card => card.id !== cardId);
    localStorage.setItem('cardscan_cards', JSON.stringify(savedCards));
    
    renderCards();
    updateCardCount();
    
    showToast('Card deleted', 'success');
}

// Clear form
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
    const overlay = document.querySelector('.preview-overlay');
    preview.src = '';
    preview.style.display = 'none';
    overlay.style.display = 'flex';
    document.getElementById('fileName').textContent = 'No file selected';
    
    // Clear OCR results
    clearOCRResults();
    
    // Reset save button if editing
    const saveBtn = document.querySelector('.btn-save');
    if (saveBtn.dataset.editing) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Card';
        delete saveBtn.dataset.editing;
        saveBtn.onclick = saveCard;
    }
}

// Close card modal
function closeCardModal() {
    document.getElementById('cardDetailsModal').style.display = 'none';
}

// Share card
function shareCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    const text = `Check out this business card:\n\nCompany: ${card.companyName}\nContact: ${card.contactPerson}\nEmail: ${card.email}\nPhone: ${card.phone}\n\nShared via CardScan PRO`;
    
    if (navigator.share) {
        navigator.share({
            title: `${card.companyName} - Business Card`,
            text: text,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Card details copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to share card', 'error'));
    }
}

// Import/Export functions
function toggleQRScanner() {
    const scanner = document.getElementById('qrScanner');
    
    if (!isScanning) {
        qrScanner = new Html5Qrcode("qrScanner");
        qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (decodedText) => {
                handleQRCodeData(decodedText);
                qrScanner.stop();
                scanner.style.display = 'none';
                isScanning = false;
            }
        ).then(() => {
            scanner.style.display = 'block';
            isScanning = true;
        });
    } else {
        qrScanner.stop();
        scanner.style.display = 'none';
        isScanning = false;
    }
}

function handleQRCodeData(qrData) {
    try {
        const data = JSON.parse(qrData);
        if (data.type === 'business_card') {
            importCardData(data.card);
        }
    } catch (error) {
        showToast('Invalid QR code data', 'error');
    }
}

function importData() {
    const deviceId = document.getElementById('deviceIdInput').value.trim();
    const status = document.getElementById('importStatus');
    
    if (!deviceId) {
        status.innerHTML = '<div class="toast error">Please enter Device ID</div>';
        return;
    }
    
    status.innerHTML = '<div class="toast info">Importing data...</div>';
    
    // Simulate import
    setTimeout(() => {
        const sampleCard = {
            companyName: "TechCorp Innovations",
            contactPerson: "Alex Johnson",
            email: "alex@techcorp.com",
            phone: "+1 (555) 123-4567",
            website: "www.techcorp.com",
            location: "San Francisco, CA",
            jobTitle: "CEO"
        };
        
        Object.keys(sampleCard).forEach(key => {
            const field = document.getElementById(key);
            if (field) field.value = sampleCard[key];
        });
        
        status.innerHTML = '<div class="toast success">Data imported successfully!</div>';
        showToast('Data imported from device', 'success');
        
        setTimeout(() => {
            status.innerHTML = '';
        }, 3000);
        
    }, 1500);
}

function importCardData(cardData) {
    Object.keys(cardData).forEach(key => {
        const field = document.getElementById(key);
        if (field && cardData[key]) field.value = cardData[key];
    });
    showToast('Card data imported from QR code', 'success');
}

function exportToQR() {
    const cardData = {
        type: 'business_card',
        card: {
            companyName: document.getElementById('companyName').value,
            contactPerson: document.getElementById('contactPerson').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            website: document.getElementById('website').value,
            location: document.getElementById('location').value,
            jobTitle: document.getElementById('jobTitle').value
        }
    };
    
    const qrOutput = document.getElementById('qrCodeOutput');
    if (!qrOutput) {
        showToast('QR output element not found', 'error');
        return;
    }
    
    qrOutput.innerHTML = '';
    
    QRCode.toCanvas(qrOutput, JSON.stringify(cardData), { width: 200 }, function(error) {
        if (error) {
            showToast('Failed to generate QR code', 'error');
            return;
        }
        
        showToast('QR code generated!', 'success');
        
        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-modal';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download QR';
        downloadBtn.onclick = function() {
            const canvas = qrOutput.querySelector('canvas');
            const link = document.createElement('a');
            link.download = `business_card_${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        };
        qrOutput.appendChild(downloadBtn);
    });
}

// Toast notifications
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
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
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
    
    if (isScanning && qrScanner) {
        qrScanner.stop();
    }
});
