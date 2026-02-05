// Business Card Scanner with Working Camera and OCR

let cards = [];
let currentEditIndex = -1;
let cameraStream = null;
let currentCamera = 'environment'; // Start with back camera
let ocrWorker = null;
let currentImageData = null;
let extractedText = '';

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadCards();
    updateCardCount();
    displayCards();
    
    // Initialize scanner buttons
    initScannerButtons();
});

// Initialize scanner button states
function initScannerButtons() {
    const cameraBtn = document.getElementById('cameraBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    
    cameraBtn.addEventListener('click', function() {
        cameraBtn.classList.add('active');
        uploadBtn.classList.remove('active');
    });
    
    uploadBtn.addEventListener('click', function() {
        uploadBtn.classList.add('active');
        cameraBtn.classList.remove('active');
    });
}

// Load cards from local storage
function loadCards() {
    try {
        const saved = localStorage.getItem('businessCards');
        if (saved) {
            cards = JSON.parse(saved);
            console.log(`Loaded ${cards.length} cards from storage`);
        }
    } catch (error) {
        console.error('Error loading cards:', error);
        cards = [];
    }
}

// Save cards to local storage
function saveCards() {
    try {
        localStorage.setItem('businessCards', JSON.stringify(cards));
        console.log(`Saved ${cards.length} cards to storage`);
    } catch (error) {
        console.error('Error saving cards:', error);
        showToast('Error saving card. Please try again.', 'error');
    }
}

// ==================== CAMERA FUNCTIONS ====================

async function openCamera() {
    console.log('Opening camera...');
    try {
        // Request camera access
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentCamera,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        
        console.log('Camera access granted');
        
        // Display camera feed
        const cameraView = document.getElementById('cameraView');
        cameraView.srcObject = cameraStream;
        
        // Show modal
        document.getElementById('cameraModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Camera error:', error);
        
        if (error.name === 'NotAllowedError') {
            showToast('Camera access denied. Please allow camera permission.', 'error');
        } else if (error.name === 'NotFoundError') {
            showToast('No camera found on this device.', 'error');
        } else {
            showToast('Cannot access camera. Please try again.', 'error');
        }
    }
}

function switchCamera() {
    console.log('Switching camera...');
    currentCamera = currentCamera === 'environment' ? 'user' : 'environment';
    
    if (cameraStream) {
        // Stop current stream
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    // Restart camera with new facing mode
    openCamera();
}

function capturePhoto() {
    console.log('Capturing photo...');
    if (!cameraStream) {
        showToast('Camera not ready. Please try again.', 'error');
        return;
    }
    
    const cameraView = document.getElementById('cameraView');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = cameraView.videoWidth;
    canvas.height = cameraView.videoHeight;
    
    // Draw current video frame to canvas
    context.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL (JPEG format)
    currentImageData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Update preview
    updateImagePreview(currentImageData);
    
    // Close camera
    closeCamera();
    
    // Enable scan button
    document.getElementById('scanBtn').disabled = false;
    
    showToast('Photo captured successfully!', 'success');
}

function closeCamera() {
    console.log('Closing camera...');
    document.getElementById('cameraModal').style.display = 'none';
    
    // Stop camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// ==================== IMAGE UPLOAD FUNCTIONS ====================

function openFilePicker() {
    console.log('Opening file picker...');
    document.getElementById('imageInput').click();
}

function handleImageUpload(event) {
    console.log('Handling image upload...');
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    console.log('File selected:', file.name, file.type, file.size);
    
    // Check if file is an image
    if (!file.type.match('image.*')) {
        showToast('Please select an image file.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('File read successfully');
        currentImageData = e.target.result;
        updateImagePreview(currentImageData);
        document.getElementById('scanBtn').disabled = false;
        showToast('Image uploaded successfully!', 'success');
    };
    
    reader.onerror = function() {
        console.error('Error reading file');
        showToast('Error reading image file.', 'error');
    };
    
    reader.readAsDataURL(file);
}

function updateImagePreview(imageData) {
    console.log('Updating image preview...');
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    
    preview.src = imageData;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
}

function clearImage() {
    console.log('Clearing image...');
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'block';
    currentImageData = null;
    document.getElementById('scanBtn').disabled = true;
    
    // Hide OCR results
    document.getElementById('ocrResults').style.display = 'none';
}

// ==================== OCR FUNCTIONS ====================

async function startOCR() {
    console.log('Starting OCR...');
    if (!currentImageData) {
        showToast('Please capture or upload an image first', 'error');
        return;
    }
    
    const scanBtn = document.getElementById('scanBtn');
    const progress = document.getElementById('ocrProgress');
    const results = document.getElementById('ocrResults');
    
    // Disable scan button and show progress
    scanBtn.disabled = true;
    progress.style.display = 'block';
    results.style.display = 'none';
    
    // Reset progress bar
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    
    try {
        console.log('Initializing OCR worker...');
        
        // Initialize Tesseract worker with better configuration
        ocrWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                console.log('OCR Progress:', m);
                updateOCRProgress(m);
            },
            errorHandler: err => {
                console.error('OCR Error:', err);
                showToast('OCR processing error. Please try again.', 'error');
            }
        });
        
        // Set worker parameters for better recognition
        await ocrWorker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            preserve_interword_spaces: '1',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-@()/\\:& '
        });
        
        console.log('Performing OCR...');
        
        // Perform OCR with better configuration
        const result = await ocrWorker.recognize(currentImageData, {
            rectangle: { top: 0, left: 0, width: 100, height: 100 }
        });
        
        console.log('OCR Result:', result.data);
        
        // Store extracted text
        extractedText = result.data.text;
        
        // Display extracted text
        document.getElementById('extractedText').textContent = extractedText;
        
        // Hide progress and show results
        progress.style.display = 'none';
        results.style.display = 'block';
        scanBtn.disabled = false;
        
        showToast('Text extracted successfully!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        progress.style.display = 'none';
        scanBtn.disabled = false;
        
        if (error.message.includes('network')) {
            showToast('Network error. Please check your internet connection.', 'error');
        } else {
            showToast('OCR failed. Please try again with a clearer image.', 'error');
        }
    }
}

function updateOCRProgress(message) {
    if (message.status === 'recognizing text') {
        const progress = Math.round(message.progress * 100);
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressPercent').textContent = `${progress}%`;
    }
}

function applyOCRResults() {
    console.log('Applying OCR results...');
    
    if (!extractedText) {
        showToast('No text extracted. Please scan again.', 'error');
        return;
    }
    
    // Simple parsing logic - you can improve this
    const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
    console.log('Parsing lines:', lines);
    
    let companyName = '';
    let contactPerson = '';
    let jobTitle = '';
    let email = '';
    let phone = '';
    let website = '';
    let addressLines = [];
    
    // Patterns for detection
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const websiteRegex = /(www\.|https?:\/\/)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
    const jobTitleRegex = /(CEO|CTO|CFO|COO|Director|Manager|Engineer|Developer|Designer|Analyst|President|Vice President|Head of|Lead|Specialist)/i;
    
    // Find email
    const emailMatches = extractedText.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
        email = emailMatches[0];
        console.log('Found email:', email);
    }
    
    // Find phone
    const phoneMatches = extractedText.match(phoneRegex);
    if (phoneMatches && phoneMatches.length > 0) {
        phone = phoneMatches[0];
        console.log('Found phone:', phone);
    }
    
    // Find website
    const websiteMatches = extractedText.match(websiteRegex);
    if (websiteMatches && websiteMatches.length > 0) {
        website = websiteMatches[0];
        console.log('Found website:', website);
    }
    
    // Analyze each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // First substantial line might be company name
        if (!companyName && line.length > 2 && line.length < 50) {
            companyName = line;
            console.log('Possible company name:', companyName);
        }
        
        // Look for job titles
        if (!jobTitle && jobTitleRegex.test(line)) {
            jobTitle = line;
            console.log('Possible job title:', jobTitle);
        }
        
        // Look for names (lines with 2-3 words, capitalized)
        if (!contactPerson && line.split(' ').length >= 2 && line.split(' ').length <= 3) {
            const words = line.split(' ');
            if (words.every(word => word[0] === word[0].toUpperCase())) {
                contactPerson = line;
                console.log('Possible contact person:', contactPerson);
            }
        }
        
        // Address lines (lines that don't match other patterns)
        if (!emailRegex.test(line) && !phoneRegex.test(line) && !websiteRegex.test(line) && 
            !jobTitleRegex.test(line) && line.length > 5) {
            addressLines.push(line);
        }
    }
    
    // Join address lines
    const address = addressLines.join(', ');
    
    // Fill form with detected information
    document.getElementById('companyName').value = companyName || '';
    document.getElementById('contactPerson').value = contactPerson || '';
    document.getElementById('jobTitle').value = jobTitle || '';
    document.getElementById('email').value = email || '';
    document.getElementById('phone').value = phone || '';
    document.getElementById('website').value = website || '';
    document.getElementById('address').value = address || '';
    
    showToast('Form auto-filled with extracted data. Please verify and edit.', 'info');
}

// ==================== CARD MANAGEMENT FUNCTIONS ====================

function saveCard() {
    console.log('Saving card...');
    
    // Get form values
    const companyName = document.getElementById('companyName').value.trim();
    const contactPerson = document.getElementById('contactPerson').value.trim();
    
    // Check if at least company name or contact person is provided
    if (!companyName && !contactPerson) {
        showToast('Please enter at least company name or contact person', 'error');
        return;
    }
    
    // Create card object
    const card = {
        id: Date.now(),
        companyName: companyName,
        contactPerson: contactPerson,
        jobTitle: document.getElementById('jobTitle').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        website: document.getElementById('website').value.trim(),
        address: document.getElementById('address').value.trim(),
        createdAt: new Date().toISOString(),
        imageData: currentImageData // Save the scanned image
    };
    
    console.log('Card created:', card);
    
    // Add to cards array
    cards.push(card);
    
    // Save to local storage
    saveCards();
    
    // Update UI
    displayCards();
    updateCardCount();
    
    // Clear form and image
    clearForm();
    clearImage();
    
    // Show success message
    showToast('Business card saved successfully!', 'success');
}

function clearForm() {
    console.log('Clearing form...');
    document.getElementById('companyName').value = '';
    document.getElementById('contactPerson').value = '';
    document.getElementById('jobTitle').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('website').value = '';
    document.getElementById('address').value = '';
}

// Display all cards
function displayCards(filteredCards = null) {
    console.log('Displaying cards...');
    const cardsContainer = document.getElementById('cardsContainer');
    const cardsToDisplay = filteredCards || cards;
    
    // Clear container
    cardsContainer.innerHTML = '';
    
    // Check if there are any cards
    if (cardsToDisplay.length === 0) {
        if (filteredCards) {
            // Show no results message
            cardsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No Matching Cards</h3>
                    <p>Try a different search term</p>
                </div>
            `;
        } else {
            // Show empty state
            cardsContainer.innerHTML = `
                <div class="empty-state" id="emptyState">
                    <i class="fas fa-id-card"></i>
                    <h3>No Cards Yet</h3>
                    <p>Add your first business card to get started</p>
                </div>
            `;
        }
        return;
    }
    
    console.log(`Displaying ${cardsToDisplay.length} cards`);
    
    // Display cards
    cardsToDisplay.forEach((card, index) => {
        const cardElement = createCardElement(card, index);
        cardsContainer.appendChild(cardElement);
    });
}

// Create card HTML element
function createCardElement(card, index) {
    const div = document.createElement('div');
    div.className = 'business-card';
    div.setAttribute('data-index', index);
    
    // Create first letter for logo
    const firstLetter = card.companyName ? card.companyName.charAt(0).toUpperCase() : 
                         card.contactPerson ? card.contactPerson.charAt(0).toUpperCase() : 'C';
    
    // Format date
    const date = new Date(card.createdAt);
    const dateString = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    // Create card image preview if exists
    const imagePreview = card.imageData ? `
        <div class="card-image" style="margin-top: 15px;">
            <small><i class="fas fa-image"></i> Scanned Image:</small>
            <div style="margin-top: 5px;">
                <img src="${card.imageData}" alt="Scanned card" 
                     style="max-width: 100px; max-height: 80px; border-radius: 5px; cursor: pointer; border: 1px solid #ddd;" 
                     onclick="showImage('${card.imageData}')">
            </div>
        </div>
    ` : '';
    
    div.innerHTML = `
        <div class="card-header">
            <div class="company-info">
                <div class="company-logo">${firstLetter}</div>
                <div>
                    <div class="company-name">${card.companyName || 'No Company Name'}</div>
                    <div class="contact-person">${card.contactPerson || 'No Contact Name'}</div>
                </div>
            </div>
            <div class="job-title">${card.jobTitle || 'Not specified'}</div>
        </div>
        
        <div class="card-details">
            ${card.email ? `
                <div class="detail-item">
                    <i class="fas fa-envelope"></i>
                    <span>${card.email}</span>
                </div>
            ` : ''}
            
            ${card.phone ? `
                <div class="detail-item">
                    <i class="fas fa-phone"></i>
                    <span>${card.phone}</span>
                </div>
            ` : ''}
            
            ${card.website ? `
                <div class="detail-item">
                    <i class="fas fa-globe"></i>
                    <span>${card.website}</span>
                </div>
            ` : ''}
            
            ${card.address ? `
                <div class="detail-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${card.address.length > 30 ? card.address.substring(0, 30) + '...' : card.address}</span>
                </div>
            ` : ''}
        </div>
        
        ${imagePreview}
        
        <div class="card-footer">
            <div class="card-date">
                <i class="far fa-calendar"></i> Added: ${dateString}
            </div>
            <div class="card-actions">
                <button class="btn-edit" onclick="editCard(${index})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-delete" onclick="deleteCard(${index})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    
    return div;
}

function showImage(imageData) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.9)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2000';
    modal.style.cursor = 'pointer';
    
    const img = new Image();
    img.src = imageData;
    img.style.maxWidth = '90vw';
    img.style.maxHeight = '90vh';
    img.style.borderRadius = '10px';
    img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    
    modal.appendChild(img);
    document.body.appendChild(modal);
    
    modal.onclick = function() {
        document.body.removeChild(modal);
    };
}

// Filter cards based on search input
function filterCards() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase().trim();
    console.log('Searching for:', searchInput);
    
    if (!searchInput) {
        displayCards();
        return;
    }
    
    const filteredCards = cards.filter(card => {
        return (
            (card.companyName && card.companyName.toLowerCase().includes(searchInput)) ||
            (card.contactPerson && card.contactPerson.toLowerCase().includes(searchInput)) ||
            (card.jobTitle && card.jobTitle.toLowerCase().includes(searchInput)) ||
            (card.email && card.email.toLowerCase().includes(searchInput)) ||
            (card.phone && card.phone.includes(searchInput)) ||
            (card.website && card.website.toLowerCase().includes(searchInput)) ||
            (card.address && card.address.toLowerCase().includes(searchInput))
        );
    });
    
    console.log(`Found ${filteredCards.length} matching cards`);
    displayCards(filteredCards);
}

// Edit card
function editCard(index) {
    console.log('Editing card at index:', index);
    const card = cards[index];
    currentEditIndex = index;
    
    // Fill modal with card data
    document.getElementById('editCompanyName').value = card.companyName || '';
    document.getElementById('editContactPerson').value = card.contactPerson || '';
    document.getElementById('editJobTitle').value = card.jobTitle || '';
    document.getElementById('editEmail').value = card.email || '';
    document.getElementById('editPhone').value = card.phone || '';
    document.getElementById('editWebsite').value = card.website || '';
    document.getElementById('editAddress').value = card.address || '';
    
    // Show modal
    document.getElementById('editModal').style.display = 'flex';
}

// Update card
function updateCard() {
    if (currentEditIndex === -1) {
        console.error('No card selected for editing');
        return;
    }
    
    console.log('Updating card at index:', currentEditIndex);
    
    // Get updated values
    const card = cards[currentEditIndex];
    card.companyName = document.getElementById('editCompanyName').value.trim();
    card.contactPerson = document.getElementById('editContactPerson').value.trim();
    card.jobTitle = document.getElementById('editJobTitle').value.trim();
    card.email = document.getElementById('editEmail').value.trim();
    card.phone = document.getElementById('editPhone').value.trim();
    card.website = document.getElementById('editWebsite').value.trim();
    card.address = document.getElementById('editAddress').value.trim();
    
    // Save to local storage
    saveCards();
    
    // Update UI
    displayCards();
    
    // Close modal
    closeEditModal();
    
    // Show success message
    showToast('Card updated successfully!', 'success');
}

function closeEditModal() {
    console.log('Closing edit modal');
    document.getElementById('editModal').style.display = 'none';
    currentEditIndex = -1;
}

// Delete card
function deleteCard(index) {
    console.log('Deleting card at index:', index);
    
    if (!confirm('Are you sure you want to delete this card?')) {
        return;
    }
    
    // Remove card from array
    cards.splice(index, 1);
    
    // Save to local storage
    saveCards();
    
    // Update UI
    displayCards();
    updateCardCount();
    
    // Show success message
    showToast('Card deleted successfully!', 'success');
}

// Update card count
function updateCardCount() {
    document.getElementById('totalCards').textContent = cards.length;
}

// ==================== UTILITY FUNCTIONS ====================

// Show toast notification
function showToast(message, type = 'info') {
    console.log(`Toast (${type}): ${message}`);
    const toast = document.getElementById('toast');
    
    // Set message and style
    toast.textContent = message;
    toast.style.display = 'block';
    
    // Set color based on type
    if (type === 'success') {
        toast.style.background = '#4cd964';
    } else if (type === 'error') {
        toast.style.background = '#ff6b6b';
    } else if (type === 'info') {
        toast.style.background = '#667eea';
    } else {
        toast.style.background = '#333';
    }
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    console.log('Cleaning up...');
    
    // Stop camera if active
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    
    // Terminate OCR worker
    if (ocrWorker) {
        ocrWorker.terminate();
    }
});

// Add helper for mobile camera rotation
window.addEventListener('orientationchange', function() {
    if (cameraStream) {
        // Restart camera on orientation change for better mobile support
        setTimeout(() => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                openCamera();
            }
        }, 300);
    }
});
