// Global variables
let currentDeviceId;
let qrScanner = null;
let isScanning = false;
let lastSyncTime = null;
let currentStream = null;
let currentCamera = 'back'; // 'front' or 'back'
let flashEnabled = false;
let ocrWorker = null;
let extractedData = {};
let autoCaptureInterval = null;

// Mock database
const mockDatabase = {
    cards: {},
    devices: {}
};

// Initialize Tesseract OCR worker
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
        showNotification('OCR initialization failed. Please refresh the page.', 'error');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    await initializeOCR();
});

async function initializeApp() {
    // Generate or retrieve device ID
    currentDeviceId = getDeviceId();
    document.getElementById('deviceIdDisplay').textContent = currentDeviceId;
    document.getElementById('deviceIdInput').value = currentDeviceId;
    
    // Check sync status
    checkSyncStatus();
    
    // Load any existing data
    loadSavedData();
    
    // Set up periodic sync
    setInterval(performBackgroundSync, 30000);
    
    console.log('App initialized with Device ID:', currentDeviceId);
}

// Device ID Management
function getDeviceId() {
    let deviceId = localStorage.getItem('businessCardDeviceId');
    
    if (!deviceId) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 12);
        deviceId = `device_${timestamp}_${randomStr}`;
        localStorage.setItem('businessCardDeviceId', deviceId);
        
        mockDatabase.devices[deviceId] = {
            created: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            cards: []
        };
    }
    
    return deviceId;
}

function copyDeviceId() {
    const deviceId = document.getElementById('deviceIdDisplay').textContent;
    navigator.clipboard.writeText(deviceId).then(() => {
        showNotification('Device ID copied to clipboard!', 'success');
    }).catch(err => {
        showNotification('Failed to copy Device ID', 'error');
        console.error('Copy failed:', err);
    });
}

// Camera Functions with Back Camera Support
async function openCamera(cameraType = 'back') {
    currentCamera = cameraType;
    const modal = document.getElementById('cameraModal');
    const cameraTypeLabel = document.getElementById('cameraType');
    
    cameraTypeLabel.textContent = cameraType === 'back' ? 'Back Camera' : 'Front Camera';
    modal.style.display = 'flex';
    
    try {
        // Stop any existing stream
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        // Get camera constraints based on type
        const constraints = {
            video: {
                facingMode: cameraType === 'back' ? { exact: 'environment' } : 'user',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };
        
        // Access camera
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('cameraFeed');
        video.srcObject = currentStream;
        
        // Try to get camera capabilities for flash
        const track = currentStream.getVideoTracks()[0];
        if (track.getCapabilities && track.getCapabilities().torch) {
            document.getElementById('flashBtn').style.display = 'flex';
        } else {
            document.getElementById('flashBtn').style.display = 'none';
        }
        
    } catch (err) {
        console.error('Camera error:', err);
        
        // Fallback to default facingMode if environment is not available
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
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
                cameraTypeLabel.textContent = 'Front Camera';
                showNotification('Back camera not available. Using front camera.', 'warning');
            } catch (fallbackErr) {
                showNotification('Could not access camera. Please check permissions.', 'error');
                closeCamera();
            }
        } else {
            showNotification('Could not access camera. Please check permissions.', 'error');
            closeCamera();
        }
    }
}

function switchCamera() {
    const newCamera = currentCamera === 'back' ? 'front' : 'back';
    closeCamera();
    setTimeout(() => openCamera(newCamera), 500);
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
            flashBtn.innerHTML = `<i class="fas fa-bolt"></i> Flash ${flashEnabled ? 'On' : 'Off'}`;
            flashBtn.style.background = flashEnabled ? '#ffeb3b' : '#ff9800';
            flashBtn.style.color = flashEnabled ? '#333' : 'white';
        }
    } catch (err) {
        console.error('Flash toggle error:', err);
    }
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        currentStream = null;
    }
    
    const video = document.getElementById('cameraFeed');
    video.srcObject = null;
    modal.style.display = 'none';
    flashEnabled = false;
    
    // Reset flash button
    const flashBtn = document.getElementById('flashBtn');
    flashBtn.innerHTML = '<i class="fas fa-bolt"></i> Flash Off';
    flashBtn.style.background = '#ff9800';
    flashBtn.style.color = 'white';
}

function captureImage() {
    if (!currentStream) return;
    
    const video = document.getElementById('cameraFeed');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Update preview
    updateImagePreview(imageData, 'camera_capture.jpg');
    
    showNotification('Image captured successfully!', 'success');
    
    // Auto-start OCR scanning
    setTimeout(() => {
        startOCRScan();
    }, 1000);
    
    // Close camera after capture
    setTimeout(closeCamera, 500);
}

// Auto Capture and Scan
async function captureAndScanAutomatically() {
    showNotification('Starting auto-capture in 3 seconds...', 'info');
    
    // Open back camera
    await openCamera('back');
    
    // Wait for camera to stabilize
    setTimeout(async () => {
        showNotification('Capturing image for analysis...', 'info');
        
        // Capture image
        const video = document.getElementById('cameraFeed');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        
        // Update preview
        updateImagePreview(imageData, 'auto_capture.jpg');
        
        // Close camera
        closeCamera();
        
        // Start OCR scanning
        setTimeout(async () => {
            await startOCRScan();
        }, 500);
        
    }, 3000);
}

function updateImagePreview(imageData, fileName) {
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    preview.src = imageData;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    
    document.getElementById('fileName').textContent = fileName;
    
    // Store image data for OCR
    extractedData.imageData = imageData;
}

// OCR Text Scanning Functions
async function startOCRScan() {
    const preview = document.getElementById('previewImage');
    const ocrBtn = document.getElementById('ocrBtn');
    const progressContainer = document.getElementById('ocrProgress');
    
    if (!preview.src || preview.src.includes('preview-placeholder')) {
        showNotification('Please upload or capture an image first', 'warning');
        return;
    }
    
    if (!ocrWorker) {
        showNotification('OCR engine is initializing. Please wait...', 'warning');
        await initializeOCR();
        if (!ocrWorker) {
            showNotification('OCR failed to initialize', 'error');
            return;
        }
    }
    
    // Show progress
    ocrBtn.disabled = true;
    ocrBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    progressContainer.style.display = 'flex';
    
    try {
        // Perform OCR
        const result = await ocrWorker.recognize(preview.src);
        
        // Process and extract business card information
        await processOCRResults(result.data);
        
        ocrBtn.innerHTML = '<i class="fas fa-search"></i> Scan Text from Image';
        ocrBtn.disabled = false;
        progressContainer.style.display = 'none';
        
        showNotification('Text scanning completed successfully!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        ocrBtn.innerHTML = '<i class="fas fa-search"></i> Scan Text from Image';
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
        
        // Update button text during recognition
        if (progress < 100) {
            document.getElementById('ocrBtn').innerHTML = 
                `<i class="fas fa-spinner fa-spin"></i> Scanning ${progress}%`;
        }
    }
}

async function processOCRResults(ocrData) {
    extractedData = {
        rawText: ocrData.text,
        confidence: ocrData.confidence,
        items: []
    };
    
    // Extract information using patterns
    const lines = ocrData.text.split('\n').filter(line => line.trim().length > 0);
    
    // Pattern matching for business card information
    const patterns = {
        companyName: /(Inc\.|Corp\.|Corporation|Company|Co\.|Ltd\.|LLC|GmbH)/i,
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        website: /(www\.|https?:\/\/)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/,
        jobTitle: /(CEO|CTO|CFO|COO|Director|Manager|Engineer|Developer|Designer|Analyst)/i,
        location: /(Street|St\.|Avenue|Ave\.|Road|Rd\.|Boulevard|Blvd\.|Drive|Dr\.|Lane|Ln\.)/i
    };
    
    // Analyze each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for company name (usually at the top)
        if (i < 3 && line.length > 2 && line.length < 50) {
            if (!extractedData.companyName) {
                extractedData.companyName = line;
                extractedData.items.push({
                    type: 'companyName',
                    value: line,
                    confidence: 80
                });
            }
        }
        
        // Check for email
        const emailMatch = line.match(patterns.email);
        if (emailMatch) {
            extractedData.email = emailMatch[0];
            extractedData.items.push({
                type: 'email',
                value: emailMatch[0],
                confidence: 95
            });
        }
        
        // Check for phone
        const phoneMatch = line.match(patterns.phone);
        if (phoneMatch) {
            extractedData.phone = phoneMatch[0];
            extractedData.items.push({
                type: 'phone',
                value: phoneMatch[0],
                confidence: 90
            });
        }
        
        // Check for website
        const websiteMatch = line.match(patterns.website);
        if (websiteMatch) {
            extractedData.website = websiteMatch[0];
            extractedData.items.push({
                type: 'website',
                value: websiteMatch[0],
                confidence: 85
            });
        }
        
        // Check for job title (often near name)
        if (line.includes(',') && patterns.jobTitle.test(line)) {
            const parts = line.split(',');
            if (parts.length > 1) {
                extractedData.jobTitle = parts[1].trim();
                extractedData.items.push({
                    type: 'jobTitle',
                    value: parts[1].trim(),
                    confidence: 75
                });
                
                // The part before comma might be the name
                if (parts[0].trim().split(' ').length >= 2) {
                    extractedData.contactPerson = parts[0].trim();
                    extractedData.items.push({
                        type: 'contactPerson',
                        value: parts[0].trim(),
                        confidence: 70
                    });
                }
            }
        }
        
        // Check for location (address lines)
        if (patterns.location.test(line) && line.length > 10) {
            extractedData.location = line;
            extractedData.items.push({
                type: 'location',
                value: line,
                confidence: 75
            });
        }
        
        // Look for person name (not already found, not company, not email/phone/website)
        if (!extractedData.contactPerson && 
            line.length > 3 && line.length < 30 &&
            !patterns.email.test(line) &&
            !patterns.phone.test(line) &&
            !patterns.website.test(line) &&
            !patterns.companyName.test(line)) {
            
            // Check if it looks like a person name (title case, 2-3 words)
            const words = line.split(' ');
            if (words.length >= 2 && words.length <= 3) {
                const isTitleCase = words.every(word => 
                    word.length > 0 && 
                    word[0] === word[0].toUpperCase() &&
                    word.slice(1) === word.slice(1).toLowerCase()
                );
                
                if (isTitleCase) {
                    extractedData.contactPerson = line;
                    extractedData.items.push({
                        type: 'contactPerson',
                        value: line,
                        confidence: 65
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
                <span class="field-type">No structured data found</span>
                <span class="field-value">Please check the image quality</span>
            </div>
        `;
        resultsSection.style.display = 'block';
        return;
    }
    
    let resultsHTML = '';
    const fieldLabels = {
        companyName: 'Company Name',
        contactPerson: 'Contact Person',
        email: 'Email',
        phone: 'Phone',
        website: 'Website',
        jobTitle: 'Job Title',
        location: 'Location'
    };
    
    extractedData.items.forEach(item => {
        resultsHTML += `
            <div class="ocr-result-item" data-type="${item.type}" data-value="${item.value}">
                <span class="field-type">${fieldLabels[item.type] || item.type}</span>
                <span class="field-value">${item.value}</span>
                <span class="confidence">${item.confidence}%</span>
                <button class="btn-apply-single-small" onclick="applyOCRField('${item.type}', '${item.value.replace(/'/g, "\\'")}')">
                    <i class="fas fa-magic"></i>
                </button>
            </div>
        `;
    });
    
    resultsContainer.innerHTML = resultsHTML;
    resultsSection.style.display = 'block';
    
    // Show apply buttons on individual fields
    document.querySelectorAll('.btn-apply-single').forEach(btn => {
        btn.style.display = 'inline-block';
    });
}

function applyOCRResults() {
    if (!extractedData.items || extractedData.items.length === 0) {
        showNotification('No OCR results to apply', 'warning');
        return;
    }
    
    // Apply all detected fields
    extractedData.items.forEach(item => {
        const fieldId = item.type;
        const fieldElement = document.getElementById(fieldId);
        
        if (fieldElement && !fieldElement.value.trim()) {
            fieldElement.value = item.value;
            fieldElement.style.borderColor = '#6a11cb';
            fieldElement.style.backgroundColor = '#f8f0ff';
            
            // Add animation
            fieldElement.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.02)' },
                { transform: 'scale(1)' }
            ], {
                duration: 300,
                iterations: 1
            });
        }
    });
    
    showNotification(`Applied ${extractedData.items.length} fields from OCR`, 'success');
    
    // Clear results display after applying
    setTimeout(() => {
        clearOCRResults();
    }, 1000);
}

function applyOCRField(fieldType, fieldValue) {
    const fieldElement = document.getElementById(fieldType);
    if (fieldElement) {
        fieldElement.value = fieldValue;
        fieldElement.style.borderColor = '#6a11cb';
        fieldElement.style.backgroundColor = '#f8f0ff';
        
        // Visual feedback
        fieldElement.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.02)' },
            { transform: 'scale(1)' }
        ], {
            duration: 300,
            iterations: 1
        });
        
        showNotification(`Applied ${fieldType} from OCR`, 'success');
    }
}

function clearOCRResults() {
    const resultsSection = document.getElementById('ocrResultsSection');
    const resultsContainer = document.getElementById('ocrResults');
    
    resultsContainer.innerHTML = '';
    resultsSection.style.display = 'none';
    
    // Hide apply buttons
    document.querySelectorAll('.btn-apply-single').forEach(btn => {
        btn.style.display = 'none';
    });
    
    extractedData = {};
}

function applySingleField(fieldId) {
    const fieldValue = extractedData[fieldId];
    if (fieldValue) {
        document.getElementById(fieldId).value = fieldValue;
        showNotification(`Applied ${fieldId} from OCR`, 'success');
    }
}

// Image Upload Handling
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
            
            // Auto-start OCR for uploaded images
            setTimeout(() => {
                startOCRScan();
            }, 500);
        };
        reader.readAsDataURL(file);
    }
}

// Save Card Function
function saveCard() {
    const companyName = document.getElementById('companyName').value.trim();
    const contactPerson = document.getElementById('contactPerson').value.trim();
    
    if (!companyName && !contactPerson) {
        showNotification('Please enter at least company name or contact person', 'warning');
        return;
    }
    
    // Get all field values
    const cardData = {
        id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        companyName,
        contactPerson,
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        jobTitle: document.getElementById('jobTitle').value.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Add image data if available
    const preview = document.getElementById('previewImage');
    if (preview.src && !preview.src.includes('preview-placeholder')) {
        cardData.imageData = preview.src;
    }
    
    // Save to database
    mockDatabase.cards[cardData.id] = cardData;
    
    // Associate with current device
    if (!mockDatabase.devices[currentDeviceId].cards) {
        mockDatabase.devices[currentDeviceId].cards = [];
    }
    mockDatabase.devices[currentDeviceId].cards.push(cardData.id);
    
    // Update sync
    updateLastSyncTime();
    
    // Show success with details
    const fieldCount = Object.values(cardData).filter(val => val && typeof val === 'string' && val.trim()).length;
    showNotification(`Business card saved with ${fieldCount} fields!`, 'success');
    
    console.log('Card saved:', cardData);
}

// Clear Form
function clearForm() {
    if (!confirm('Are you sure you want to clear all fields?')) return;
    
    // Clear input fields
    document.querySelectorAll('#details-section input').forEach(input => {
        input.value = '';
        input.style.borderColor = '';
        input.style.backgroundColor = '';
    });
    
    // Clear image preview
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    
    document.getElementById('fileName').textContent = 'No file chosen';
    
    // Clear OCR results
    clearOCRResults();
    
    showNotification('Form cleared', 'info');
}

// Load Saved Data
function loadSavedData() {
    const deviceCards = mockDatabase.devices[currentDeviceId]?.cards || [];
    
    if (deviceCards.length > 0) {
        const latestCardId = deviceCards[deviceCards.length - 1];
        const cardData = mockDatabase.cards[latestCardId];
        
        if (cardData) {
            document.getElementById('companyName').value = cardData.companyName || '';
            document.getElementById('contactPerson').value = cardData.contactPerson || '';
            document.getElementById('website').value = cardData.website || '';
            document.getElementById('location').value = cardData.location || '';
            document.getElementById('email').value = cardData.email || '';
            document.getElementById('phone').value = cardData.phone || '';
            document.getElementById('jobTitle').value = cardData.jobTitle || '';
            
            if (cardData.imageData) {
                const preview = document.getElementById('previewImage');
                const placeholder = document.querySelector('.preview-placeholder');
                preview.src = cardData.imageData;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                document.getElementById('fileName').textContent = 'saved_card.jpg';
            }
        }
    }
}

// Sync Functions (Keep from previous version)
function checkSyncStatus() {
    const statusIndicator = document.getElementById('statusIndicator');
    const isOnline = navigator.onLine;
    
    if (isOnline) {
        statusIndicator.className = 'status-indicator online';
        statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Online';
    } else {
        statusIndicator.className = 'status-indicator offline';
        statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Offline';
    }
    
    return isOnline;
}

function forceSync() {
    if (!checkSyncStatus()) {
        showNotification('Cannot sync while offline', 'error');
        return;
    }
    
    const syncBtn = document.querySelector('.btn-sync');
    const originalText = syncBtn.innerHTML;
    
    syncBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Syncing...';
    syncBtn.disabled = true;
    
    setTimeout(() => {
        performBackgroundSync();
        syncBtn.innerHTML = originalText;
        syncBtn.disabled = false;
        showNotification('Sync completed successfully!', 'success');
    }, 2000);
}

function performBackgroundSync() {
    if (!checkSyncStatus()) return;
    
    updateLastSyncTime();
    
    if (mockDatabase.devices[currentDeviceId]) {
        mockDatabase.devices[currentDeviceId].lastActive = new Date().toISOString();
    }
    
    console.log('Background sync performed at:', new Date().toISOString());
}

function updateLastSyncTime() {
    lastSyncTime = new Date();
    const timeString = lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('lastSync').textContent = `Last sync: ${timeString}`;
}

// QR Code Functions (Keep from previous version)
function toggleQRScanner() {
    // Same as before
}

function importData() {
    // Same as before
}

function exportToQR() {
    // Same as before
}

// Notification Function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                         type === 'error' ? 'exclamation-circle' : 
                         type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
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
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
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
