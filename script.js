// Global variables
let currentDeviceId;
let qrScanner = null;
let isScanning = false;
let currentStream = null;
let currentCamera = 'back';
let ocrWorker = null;
let extractedData = {};
let savedCards = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    await initializeOCR();
    loadSavedCards();
    updateCardCount();
    
    // Set default device ID in input
    document.getElementById('deviceIdInput').value = currentDeviceId;
    
    // Add event listeners
    document.getElementById('cardImageInput')?.addEventListener('change', previewImage);
    
    // Initialize sync status
    updateLastSyncTime();
});

// Initialize the app
async function initializeApp() {
    // Generate or retrieve device ID
    currentDeviceId = getDeviceId();
    document.getElementById('deviceIdDisplay').textContent = currentDeviceId;
    
    console.log('App initialized with Device ID:', currentDeviceId);
}

// Initialize Tesseract OCR
async function initializeOCR() {
    try {
        ocrWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => updateOCRProgress(m),
            errorHandler: err => console.error('OCR Error:', err)
        });
        await ocrWorker.load();
        await ocrWorker.loadLanguage('eng');
        await ocrWorker.initialize('eng');
        console.log('OCR Worker initialized');
    } catch (error) {
        console.error('Failed to initialize OCR:', error);
    }
}

// Device ID Management
function getDeviceId() {
    let deviceId = localStorage.getItem('businessCardDeviceId');
    
    if (!deviceId) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 12);
        deviceId = `device_${timestamp}_${randomStr}`;
        localStorage.setItem('businessCardDeviceId', deviceId);
    }
    
    return deviceId;
}

function copyDeviceId() {
    const deviceId = document.getElementById('deviceIdDisplay').textContent;
    navigator.clipboard.writeText(deviceId).then(() => {
        showNotification('Device ID copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Failed to copy Device ID', 'error');
    });
}

// Image Upload and Camera Functions
function openFilePicker() {
    document.getElementById('cardImageInput').click();
}

function previewImage(event) {
    const file = event.target.files[0];
    const fileName = document.getElementById('fileName');
    
    if (file) {
        fileName.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            updateImagePreview(e.target.result, file.name);
        };
        reader.readAsDataURL(file);
    }
}

// Camera Functions
async function openCamera(cameraType = 'back') {
    currentCamera = cameraType;
    const modal = document.getElementById('cameraModal');
    modal.style.display = 'flex';
    
    try {
        // Stop any existing stream
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        // Get camera constraints
        const constraints = {
            video: {
                facingMode: cameraType === 'back' ? { exact: 'environment' } : 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        // Access camera
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('cameraFeed');
        video.srcObject = currentStream;
        
    } catch (err) {
        console.error('Camera error:', err);
        
        // Fallback to user camera if environment fails
        if (err.name === 'OverconstrainedError') {
            try {
                const fallbackConstraints = {
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };
                
                currentStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                const video = document.getElementById('cameraFeed');
                video.srcObject = currentStream;
                currentCamera = 'front';
                showNotification('Using front camera', 'info');
            } catch (fallbackErr) {
                showNotification('Could not access camera', 'error');
                closeCamera();
            }
        } else {
            showNotification('Could not access camera', 'error');
            closeCamera();
        }
    }
}

function switchCamera() {
    const newCamera = currentCamera === 'back' ? 'front' : 'back';
    closeCamera();
    setTimeout(() => openCamera(newCamera), 500);
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    modal.style.display = 'none';
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
    
    showNotification('Image captured successfully!', 'success');
    closeCamera();
    
    // Auto-start OCR
    setTimeout(() => {
        startOCRScan();
    }, 1000);
}

function updateImagePreview(imageData, fileName) {
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    
    preview.src = imageData;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    
    document.getElementById('fileName').textContent = fileName;
    
    // Store image data
    extractedData.imageData = imageData;
}

// OCR Functions
async function startOCRScan() {
    const preview = document.getElementById('previewImage');
    const ocrBtn = document.getElementById('ocrBtn');
    const progressContainer = document.getElementById('ocrProgress');
    
    if (!preview.src || preview.src.includes('preview-placeholder')) {
        showNotification('Please upload or capture an image first', 'warning');
        return;
    }
    
    if (!ocrWorker) {
        showNotification('OCR engine is initializing...', 'info');
        await initializeOCR();
    }
    
    // Show progress
    ocrBtn.disabled = true;
    ocrBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    progressContainer.style.display = 'flex';
    
    try {
        const result = await ocrWorker.recognize(preview.src);
        await processOCRResults(result.data);
        
        ocrBtn.innerHTML = '<i class="fas fa-search"></i> Scan Text with AI';
        ocrBtn.disabled = false;
        progressContainer.style.display = 'none';
        
        showNotification('Text scanning completed!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        ocrBtn.innerHTML = '<i class="fas fa-search"></i> Scan Text with AI';
        ocrBtn.disabled = false;
        progressContainer.style.display = 'none';
        showNotification('OCR scanning failed. Please try again.', 'error');
    }
}

function updateOCRProgress(message) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (message.status === 'recognizing text') {
        const progress = Math.round(message.progress * 100);
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
    }
}

async function processOCRResults(ocrData) {
    extractedData = {
        rawText: ocrData.text,
        confidence: ocrData.confidence,
        items: []
    };
    
    // Extract information from text
    const lines = ocrData.text.split('\n').filter(line => line.trim().length > 2);
    
    // Patterns for business card information
    const patterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        website: /(www\.|https?:\/\/)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/,
        company: /(Inc\.|Corp\.|Corporation|Company|Co\.|Ltd\.|LLC|GmbH)/i
    };
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Company name (usually at the top)
        if (i < 2 && line.length > 2 && line.length < 50) {
            if (!extractedData.companyName) {
                extractedData.companyName = line;
                extractedData.items.push({
                    type: 'companyName',
                    value: line,
                    confidence: 80
                });
            }
        }
        
        // Email
        const emailMatch = line.match(patterns.email);
        if (emailMatch) {
            extractedData.email = emailMatch[0];
            extractedData.items.push({
                type: 'email',
                value: emailMatch[0],
                confidence: 95
            });
        }
        
        // Phone
        const phoneMatch = line.match(patterns.phone);
        if (phoneMatch) {
            extractedData.phone = phoneMatch[0];
            extractedData.items.push({
                type: 'phone',
                value: phoneMatch[0],
                confidence: 90
            });
        }
        
        // Website
        const websiteMatch = line.match(patterns.website);
        if (websiteMatch) {
            extractedData.website = websiteMatch[0];
            extractedData.items.push({
                type: 'website',
                value: websiteMatch[0],
                confidence: 85
            });
        }
        
        // Look for names (2-3 words, title case)
        if (!extractedData.contactPerson && 
            line.length > 3 && line.length < 30 &&
            !patterns.email.test(line) &&
            !patterns.phone.test(line) &&
            !patterns.website.test(line)) {
            
            const words = line.split(' ');
            if (words.length >= 2 && words.length <= 3) {
                const isName = words.every(word => 
                    word.length > 1 && 
                    word[0] === word[0].toUpperCase()
                );
                
                if (isName) {
                    extractedData.contactPerson = line;
                    extractedData.items.push({
                        type: 'contactPerson',
                        value: line,
                        confidence: 70
                    });
                }
            }
        }
    }
    
    // Display results
    displayOCRResults();
}

function displayOCRResults() {
    const resultsSection = document.getElementById('ocrResultsSection');
    const resultsContainer = document.getElementById('ocrResults');
    
    if (extractedData.items.length === 0) {
        resultsContainer.innerHTML = `
            <div class="ocr-result-item">
                <span>No structured data found</span>
            </div>
        `;
        resultsSection.style.display = 'block';
        return;
    }
    
    let resultsHTML = '';
    const fieldLabels = {
        companyName: 'Company',
        contactPerson: 'Contact',
        email: 'Email',
        phone: 'Phone',
        website: 'Website',
        location: 'Location',
        jobTitle: 'Job Title'
    };
    
    extractedData.items.forEach(item => {
        resultsHTML += `
            <div class="ocr-result-item">
                <span>${fieldLabels[item.type] || item.type}: ${item.value}</span>
                <small>${item.confidence}%</small>
            </div>
        `;
    });
    
    resultsContainer.innerHTML = resultsHTML;
    resultsSection.style.display = 'block';
}

function applyOCRResults() {
    if (!extractedData.items || extractedData.items.length === 0) {
        showNotification('No OCR results to apply', 'warning');
        return;
    }
    
    // Apply extracted data to form fields
    extractedData.items.forEach(item => {
        const field = document.getElementById(item.type);
        if (field && !field.value.trim()) {
            field.value = item.value;
            field.style.borderColor = '#667eea';
            field.style.backgroundColor = '#f0f4ff';
        }
    });
    
    showNotification(`Applied ${extractedData.items.length} fields from OCR`, 'success');
}

function clearOCRResults() {
    const resultsSection = document.getElementById('ocrResultsSection');
    resultsSection.style.display = 'none';
    extractedData.items = [];
}

// Save Card Function
function saveCard() {
    // Get form values
    const companyName = document.getElementById('companyName').value.trim();
    const contactPerson = document.getElementById('contactPerson').value.trim();
    
    if (!companyName && !contactPerson) {
        showNotification('Please enter company name or contact person', 'warning');
        return;
    }
    
    // Create card object
    const cardId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const cardData = {
        id: cardId,
        companyName,
        contactPerson,
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        jobTitle: document.getElementById('jobTitle').value.trim(),
        createdAt: new Date().toISOString(),
        imageData: extractedData.imageData || null
    };
    
    // Save to localStorage
    savedCards.push(cardData);
    localStorage.setItem('businessCards', JSON.stringify(savedCards));
    
    // Update UI
    addCardToTable(cardData);
    updateCardCount();
    updateLastSyncTime();
    
    // Clear form
    clearForm();
    
    // Show success message
    showNotification('Business card saved successfully!', 'success');
    
    console.log('Card saved:', cardData);
}

// Load saved cards
function loadSavedCards() {
    const saved = localStorage.getItem('businessCards');
    if (saved) {
        savedCards = JSON.parse(saved);
        savedCards.forEach(card => addCardToTable(card));
    }
}

// Add card to table
function addCardToTable(card) {
    const tableBody = document.getElementById('cardsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    // Hide empty state
    emptyState.style.display = 'none';
    
    // Create table row
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>${card.companyName || '—'}</td>
        <td>${card.contactPerson || '—'}</td>
        <td>${card.phone || '—'}</td>
        <td>${card.email || '—'}</td>
        <td class="action-cell">
            <button class="btn-view" onclick="viewCard('${card.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-edit-row" onclick="editCard('${card.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-delete" onclick="deleteCard('${card.id}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </td>
    `;
    
    tableBody.appendChild(row);
}

// Update card count
function updateCardCount() {
    const count = savedCards.length;
    document.getElementById('cardCount').textContent = `${count} cards saved`;
}

// View card details
function viewCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    const modalContent = document.getElementById('cardDetailsContent');
    
    let html = `
        <div class="card-details">
            <div class="detail-row">
                <strong>Company:</strong> ${card.companyName || '—'}
            </div>
            <div class="detail-row">
                <strong>Contact:</strong> ${card.contactPerson || '—'}
            </div>
            <div class="detail-row">
                <strong>Job Title:</strong> ${card.jobTitle || '—'}
            </div>
            <div class="detail-row">
                <strong>Email:</strong> ${card.email || '—'}
            </div>
            <div class="detail-row">
                <strong>Phone:</strong> ${card.phone || '—'}
            </div>
            <div class="detail-row">
                <strong>Website:</strong> ${card.website || '—'}
            </div>
            <div class="detail-row">
                <strong>Location:</strong> ${card.location || '—'}
            </div>
            <div class="detail-row">
                <strong>Date Saved:</strong> ${new Date(card.createdAt).toLocaleDateString()}
            </div>
    `;
    
    if (card.imageData) {
        html += `
            <div class="detail-row">
                <strong>Card Image:</strong>
                <img src="${card.imageData}" alt="Card" style="max-width: 100%; margin-top: 10px; border-radius: 5px;">
            </div>
        `;
    }
    
    html += `</div>`;
    
    modalContent.innerHTML = html;
    document.getElementById('cardDetailsModal').style.display = 'flex';
}

// Edit card
function editCard(cardId) {
    const card = savedCards.find(c => c.id === cardId);
    if (!card) return;
    
    // Populate form with card data
    document.getElementById('companyName').value = card.companyName || '';
    document.getElementById('contactPerson').value = card.contactPerson || '';
    document.getElementById('website').value = card.website || '';
    document.getElementById('location').value = card.location || '';
    document.getElementById('email').value = card.email || '';
    document.getElementById('phone').value = card.phone || '';
    document.getElementById('jobTitle').value = card.jobTitle || '';
    
    // Update image preview if exists
    if (card.imageData) {
        const preview = document.getElementById('previewImage');
        const placeholder = document.querySelector('.preview-placeholder');
        preview.src = card.imageData;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        document.getElementById('fileName').textContent = 'existing_card.jpg';
        extractedData.imageData = card.imageData;
    }
    
    // Change save button to update
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerHTML = '<i class="fas fa-sync"></i> Update Card';
    saveBtn.dataset.editing = cardId;
    saveBtn.onclick = function() { updateCard(cardId); };
    
    showNotification('Card loaded for editing', 'info');
}

// Update card
function updateCard(cardId) {
    const cardIndex = savedCards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    // Update card data
    savedCards[cardIndex] = {
        ...savedCards[cardIndex],
        companyName: document.getElementById('companyName').value.trim(),
        contactPerson: document.getElementById('contactPerson').value.trim(),
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        jobTitle: document.getElementById('jobTitle').value.trim()
    };
    
    // Update localStorage
    localStorage.setItem('businessCards', JSON.stringify(savedCards));
    
    // Update table
    refreshTable();
    
    // Reset save button
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Card';
    delete saveBtn.dataset.editing;
    saveBtn.onclick = saveCard;
    
    showNotification('Card updated successfully!', 'success');
    clearForm();
}

// Delete card
function deleteCard(cardId) {
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    savedCards = savedCards.filter(card => card.id !== cardId);
    localStorage.setItem('businessCards', JSON.stringify(savedCards));
    
    refreshTable();
    updateCardCount();
    
    showNotification('Card deleted successfully!', 'success');
}

// Refresh table
function refreshTable() {
    const tableBody = document.getElementById('cardsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    tableBody.innerHTML = '';
    
    if (savedCards.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        savedCards.forEach(card => addCardToTable(card));
    }
}

// Clear form
function clearForm() {
    document.getElementById('companyName').value = '';
    document.getElementById('contactPerson').value = '';
    document.getElementById('website').value = '';
    document.getElementById('location').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('jobTitle').value = '';
    
    // Clear image preview
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    document.getElementById('fileName').textContent = 'No file chosen';
    
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

// Import/Export Functions
function toggleQRScanner() {
    const scannerContainer = document.getElementById('qrScanner');
    const toggleBtn = document.getElementById('toggleScannerBtn');
    
    if (!isScanning) {
        qrScanner = new Html5Qrcode("qrScanner");
        const qrCodeSuccessCallback = (decodedText) => {
            if (decodedText) {
                handleQRCodeData(decodedText);
                qrScanner.stop();
                scannerContainer.style.display = 'none';
                isScanning = false;
                toggleBtn.innerHTML = '<i class="fas fa-qrcode"></i> Start QR Scanner';
            }
        };
        
        qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            qrCodeSuccessCallback
        ).then(() => {
            scannerContainer.style.display = 'block';
            isScanning = true;
            toggleBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Scanner';
        });
    } else {
        qrScanner.stop();
        scannerContainer.style.display = 'none';
        isScanning = false;
        toggleBtn.innerHTML = '<i class="fas fa-qrcode"></i> Start QR Scanner';
    }
}

function handleQRCodeData(qrData) {
    try {
        const data = JSON.parse(qrData);
        if (data.type === 'business_card') {
            // Import card data
            importCardData(data.card);
        }
    } catch (error) {
        showNotification('Invalid QR code data', 'error');
    }
}

function importData() {
    const deviceId = document.getElementById('deviceIdInput').value.trim();
    const importStatus = document.getElementById('importStatus');
    
    if (!deviceId) {
        importStatus.innerHTML = '<div class="error">Please enter a Device ID</div>';
        return;
    }
    
    importStatus.innerHTML = '<div class="info">Importing data...</div>';
    
    // Simulate import process
    setTimeout(() => {
        // This would normally fetch data from server using deviceId
        // For demo, we'll create a sample card
        const sampleCard = {
            companyName: "TechCorp Inc.",
            contactPerson: "John Doe",
            email: "john@techcorp.com",
            phone: "+1 (555) 123-4567",
            website: "www.techcorp.com",
            location: "New York, NY",
            jobTitle: "CEO"
        };
        
        // Populate form with imported data
        Object.keys(sampleCard).forEach(key => {
            const field = document.getElementById(key);
            if (field) field.value = sampleCard[key];
        });
        
        importStatus.innerHTML = '<div class="success">Data imported successfully!</div>';
        showNotification('Data imported from device', 'success');
        
    }, 1500);
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
    qrOutput.innerHTML = '';
    
    QRCode.toCanvas(qrOutput, JSON.stringify(cardData), { width: 200 }, function(error) {
        if (error) {
            showNotification('Failed to generate QR code', 'error');
            return;
        }
        
        showNotification('QR code generated successfully!', 'success');
    });
}

function importCardData(cardData) {
    Object.keys(cardData).forEach(key => {
        const field = document.getElementById(key);
        if (field && cardData[key]) field.value = cardData[key];
    });
    
    showNotification('Card data imported from QR code', 'success');
}

// Export to CSV
function exportToCSV() {
    if (savedCards.length === 0) {
        showNotification('No cards to export', 'warning');
        return;
    }
    
    const headers = ['Company Name', 'Contact Person', 'Email', 'Phone', 'Website', 'Location', 'Job Title'];
    const rows = savedCards.map(card => [
        card.companyName || '',
        card.contactPerson || '',
        card.email || '',
        card.phone || '',
        card.website || '',
        card.location || '',
        card.jobTitle || ''
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `business_cards_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Exported ${savedCards.length} cards to CSV`, 'success');
}

// Sync Functions
function updateLastSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('lastSync').textContent = timeString;
}

// Notification Function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                         type === 'error' ? 'exclamation-circle' : 
                         type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 300px;
        max-width: 400px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set background color
    const colors = {
        success: '#38a169',
        error: '#e53e3e',
        warning: '#ed8936',
        info: '#4299e1'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Add animation styles if not present
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Clean up on page unload
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
