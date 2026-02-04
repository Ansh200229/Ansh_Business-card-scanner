// Global variables
let currentDeviceId;
let qrScanner = null;
let isScanning = false;
let lastSyncTime = null;

// Mock database (replace with actual backend/database)
const mockDatabase = {
    cards: {},
    devices: {}
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Generate or retrieve device ID
    currentDeviceId = getDeviceId();
    document.getElementById('deviceIdDisplay').textContent = currentDeviceId;
    document.getElementById('deviceIdInput').value = currentDeviceId;
    
    // Check sync status
    checkSyncStatus();
    
    // Load any existing data
    loadSavedData();
    
    // Set up periodic sync
    setInterval(performBackgroundSync, 30000); // Sync every 30 seconds
    
    console.log('App initialized with Device ID:', currentDeviceId);
}

// Device ID Management
function getDeviceId() {
    let deviceId = localStorage.getItem('businessCardDeviceId');
    
    if (!deviceId) {
        // Generate new device ID
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 12);
        deviceId = `device_${timestamp}_${randomStr}`;
        localStorage.setItem('businessCardDeviceId', deviceId);
        
        // Register device in mock database
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

// Image Handling
function openFilePicker() {
    document.getElementById('cardImageInput').click();
}

function previewImage(event) {
    const file = event.target.files[0];
    const fileName = document.getElementById('fileName');
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    
    if (file) {
        fileName.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            
            // Auto-extract text from image (placeholder for OCR functionality)
            setTimeout(() => {
                showNotification('Image uploaded successfully. Ready for scanning.', 'success');
            }, 500);
        };
        reader.readAsDataURL(file);
    }
}

// Camera Functions
function openCamera() {
    const modal = document.getElementById('cameraModal');
    modal.style.display = 'flex';
    
    // Access camera
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            const video = document.getElementById('cameraFeed');
            video.srcObject = stream;
        })
        .catch(err => {
            console.error('Camera error:', err);
            showNotification('Could not access camera. Please check permissions.', 'error');
            closeCamera();
        });
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraFeed');
    const stream = video.srcObject;
    
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
    
    video.srcObject = null;
    modal.style.display = 'none';
}

function captureImage() {
    const video = document.getElementById('cameraFeed');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    const imageData = canvas.toDataURL('image/png');
    
    // Update preview
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    preview.src = imageData;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    
    document.getElementById('fileName').textContent = 'camera_capture.png';
    
    showNotification('Image captured successfully!', 'success');
    closeCamera();
}

// QR Code Scanner
function toggleQRScanner() {
    const scannerContainer = document.getElementById('qrScanner');
    const toggleBtn = document.getElementById('toggleScannerBtn');
    
    if (!isScanning) {
        // Start scanning
        qrScanner = new Html5Qrcode("qrScanner");
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            if (decodedText) {
                handleQRCodeData(decodedText);
                qrScanner.stop().then(() => {
                    scannerContainer.style.display = 'none';
                    isScanning = false;
                    toggleBtn.innerHTML = '<i class="fas fa-qrcode"></i> Start QR Scanner';
                    showNotification('QR Code scanned successfully!', 'success');
                }).catch(err => console.error('Scanner stop error:', err));
            }
        };
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        qrScanner.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback
        ).then(() => {
            scannerContainer.style.display = 'block';
            isScanning = true;
            toggleBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Scanner';
        }).catch(err => {
            console.error('Scanner start error:', err);
            showNotification('Failed to start QR scanner. Try manual entry.', 'error');
        });
    } else {
        // Stop scanning
        qrScanner.stop().then(() => {
            scannerContainer.style.display = 'none';
            isScanning = false;
            toggleBtn.innerHTML = '<i class="fas fa-qrcode"></i> Start QR Scanner';
        }).catch(err => console.error('Scanner stop error:', err));
    }
}

function handleQRCodeData(qrData) {
    try {
        // Parse QR data
        const data = JSON.parse(qrData);
        
        if (data.type === 'business_card_export' && data.deviceId) {
            // Import data from another device
            importDataFromDevice(data.deviceId);
        } else if (data.deviceId) {
            // Direct device ID import
            document.getElementById('deviceIdInput').value = data.deviceId;
            showNotification('Device ID extracted from QR code', 'info');
        }
    } catch (error) {
        // If not JSON, treat as direct device ID
        document.getElementById('deviceIdInput').value = qrData;
        showNotification('Device ID extracted from QR code', 'info');
    }
}

// Import/Export Functions
function importData() {
    const deviceIdInput = document.getElementById('deviceIdInput').value.trim();
    const importStatus = document.getElementById('importStatus');
    
    if (!deviceIdInput) {
        importStatus.innerHTML = '<div class="error">Please enter a Device ID</div>';
        return;
    }
    
    // Validate device ID format
    if (!deviceIdInput.startsWith('device_')) {
        importStatus.innerHTML = '<div class="error">Invalid Device ID format. Should start with "device_"</div>';
        return;
    }
    
    importStatus.innerHTML = '<div class="info"><i class="fas fa-sync fa-spin"></i> Importing data...</div>';
    
    // Simulate network delay
    setTimeout(() => {
        importDataFromDevice(deviceIdInput);
    }, 1500);
}

function importDataFromDevice(sourceDeviceId) {
    const importStatus = document.getElementById('importStatus');
    
    // Check if source device exists in database
    if (!mockDatabase.devices[sourceDeviceId]) {
        importStatus.innerHTML = '<div class="error">Device not found or no data available</div>';
        return;
    }
    
    const sourceCards = mockDatabase.devices[sourceDeviceId].cards;
    
    if (!sourceCards || sourceCards.length === 0) {
        importStatus.innerHTML = '<div class="warning">No data found on the source device</div>';
        return;
    }
    
    // Import the most recent card
    const latestCardId = sourceCards[sourceCards.length - 1];
    const cardData = mockDatabase.cards[latestCardId];
    
    if (cardData) {
        // Populate form with imported data
        document.getElementById('companyName').value = cardData.companyName || '';
        document.getElementById('contactPerson').value = cardData.contactPerson || '';
        document.getElementById('website').value = cardData.website || '';
        document.getElementById('location').value = cardData.location || '';
        
        // Update image preview if available
        if (cardData.imageData) {
            const preview = document.getElementById('previewImage');
            const placeholder = document.querySelector('.preview-placeholder');
            preview.src = cardData.imageData;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            document.getElementById('fileName').textContent = 'imported_card.png';
        }
        
        // Save to current device
        const cardId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        mockDatabase.cards[cardId] = {
            ...cardData,
            importedFrom: sourceDeviceId,
            importedAt: new Date().toISOString()
        };
        
        mockDatabase.devices[currentDeviceId].cards.push(cardId);
        
        // Update sync status
        updateLastSyncTime();
        
        importStatus.innerHTML = '<div class="success">Data imported successfully!</div>';
        showNotification('Data imported from ' + sourceDeviceId, 'success');
        
        // Trigger auto-save
        setTimeout(saveCard, 500);
    } else {
        importStatus.innerHTML = '<div class="error">Could not retrieve card data</div>';
    }
}

function exportToQR() {
    // Get current form data
    const cardData = {
        type: 'business_card_export',
        deviceId: currentDeviceId,
        companyName: document.getElementById('companyName').value,
        contactPerson: document.getElementById('contactPerson').value,
        website: document.getElementById('website').value,
        location: document.getElementById('location').value,
        timestamp: new Date().toISOString()
    };
    
    // Add image data if available
    const preview = document.getElementById('previewImage');
    if (preview.src && !preview.src.includes('preview-placeholder')) {
        cardData.hasImage = true;
    }
    
    // Generate QR code
    const qrOutput = document.getElementById('qrCodeOutput');
    qrOutput.innerHTML = '';
    
    QRCode.toCanvas(qrOutput, JSON.stringify(cardData), { width: 200 }, function(error) {
        if (error) {
            showNotification('Failed to generate QR code', 'error');
            console.error('QR generation error:', error);
            return;
        }
        
        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-save';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download QR Code';
        downloadBtn.onclick = function() {
            const canvas = qrOutput.querySelector('canvas');
            const link = document.createElement('a');
            link.download = `business_card_${currentDeviceId}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        
        qrOutput.appendChild(downloadBtn);
        showNotification('QR code generated successfully!', 'success');
    });
}

// Sync Functions
function checkSyncStatus() {
    // In a real app, this would check server connectivity
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
    
    // Simulate sync process
    setTimeout(() => {
        performBackgroundSync();
        syncBtn.innerHTML = originalText;
        syncBtn.disabled = false;
        showNotification('Sync completed successfully!', 'success');
    }, 2000);
}

function performBackgroundSync() {
    if (!checkSyncStatus()) return;
    
    // In a real app, this would sync with a backend server
    updateLastSyncTime();
    
    // Update device last active time
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

// Form Functions
function saveCard() {
    const companyName = document.getElementById('companyName').value.trim();
    const contactPerson = document.getElementById('contactPerson').value.trim();
    
    if (!companyName && !contactPerson) {
        showNotification('Please enter at least company name or contact person', 'warning');
        return;
    }
    
    // Get image data
    const preview = document.getElementById('previewImage');
    let imageData = null;
    if (preview.src && !preview.src.includes('preview-placeholder')) {
        imageData = preview.src;
    }
    
    // Create card object
    const cardId = `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const cardData = {
        id: cardId,
        companyName,
        contactPerson,
        website: document.getElementById('website').value.trim(),
        location: document.getElementById('location').value.trim(),
        imageData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Save to database
    mockDatabase.cards[cardId] = cardData;
    
    // Associate with current device
    if (!mockDatabase.devices[currentDeviceId].cards) {
        mockDatabase.devices[currentDeviceId].cards = [];
    }
    mockDatabase.devices[currentDeviceId].cards.push(cardId);
    
    // Update sync
    updateLastSyncTime();
    
    // Show success message
    showNotification('Business card saved successfully!', 'success');
    
    // Log for debugging
    console.log('Card saved:', cardData);
    console.log('Database state:', mockDatabase);
}

function clearForm() {
    if (!confirm('Are you sure you want to clear all fields?')) return;
    
    document.getElementById('companyName').value = '';
    document.getElementById('contactPerson').value = '';
    document.getElementById('website').value = '';
    document.getElementById('location').value = '';
    
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    
    document.getElementById('fileName').textContent = 'No file chosen';
    
    showNotification('Form cleared', 'info');
}

function loadSavedData() {
    // In a real app, this would load from localStorage or backend
    // For now, we'll just check if there's any data
    const deviceCards = mockDatabase.devices[currentDeviceId]?.cards || [];
    
    if (deviceCards.length > 0) {
        const latestCardId = deviceCards[deviceCards.length - 1];
        const cardData = mockDatabase.cards[latestCardId];
        
        if (cardData) {
            document.getElementById('companyName').value = cardData.companyName || '';
            document.getElementById('contactPerson').value = cardData.contactPerson || '';
            document.getElementById('website').value = cardData.website || '';
            document.getElementById('location').value = cardData.location || '';
            
            if (cardData.imageData) {
                const preview = document.getElementById('previewImage');
                const placeholder = document.querySelector('.preview-placeholder');
                preview.src = cardData.imageData;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                document.getElementById('fileName').textContent = 'saved_card.png';
            }
        }
    }
}

// Utility Functions
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
    
    // Set background color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add to page
    document.body.appendChild(notification);
    
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

// Add CSS animations for notifications
const style = document.createElement('style');
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

// Event Listeners
window.addEventListener('online', checkSyncStatus);
window.addEventListener('offline', checkSyncStatus);
window.addEventListener('beforeunload', function() {
    if (isScanning && qrScanner) {
        qrScanner.stop();
    }
});
