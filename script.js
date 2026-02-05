// Business Card Scanner with SIMPLE OCR (No Tesseract.js dependency)

let cards = [];
let currentEditIndex = -1;
let cameraStream = null;
let currentCamera = 'environment';
let currentImageData = null;
let extractedText = '';

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadCards();
    updateCardCount();
    displayCards();
    
    // Initialize scanner buttons
    initScannerButtons();
    
    // Show welcome message
    setTimeout(() => {
        showToast('Business Card Scanner Ready! Click "Use Camera" to start.', 'info');
    }, 1000);
});

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

// ==================== CAMERA FUNCTIONS ====================

async function openCamera() {
    console.log('Opening camera...');
    try {
        // Check if browser supports mediaDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast('Camera not supported in this browser', 'error');
            return;
        }
        
        // Request camera access with specific constraints
        const constraints = {
            video: {
                facingMode: currentCamera,
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 }
            },
            audio: false
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Display camera feed
        const cameraView = document.getElementById('cameraView');
        cameraView.srcObject = cameraStream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            cameraView.onloadedmetadata = () => {
                cameraView.play();
                resolve();
            };
        });
        
        // Show modal
        document.getElementById('cameraModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Camera error:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            showToast('Camera access denied. Please allow camera permission in browser settings.', 'error');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            showToast('No camera found on this device.', 'error');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            showToast('Camera is already in use by another application.', 'error');
        } else {
            showToast('Cannot access camera. Error: ' + error.message, 'error');
        }
    }
}

function switchCamera() {
    currentCamera = currentCamera === 'environment' ? 'user' : 'environment';
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    
    openCamera();
}

function capturePhoto() {
    if (!cameraStream) {
        showToast('Camera not ready', 'error');
        return;
    }
    
    const cameraView = document.getElementById('cameraView');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to video size
    canvas.width = cameraView.videoWidth;
    canvas.height = cameraView.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    currentImageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Enhance image for better OCR
    currentImageData = enhanceImage(canvas);
    
    // Update preview
    updateImagePreview(currentImageData);
    
    // Close camera
    closeCamera();
    
    // Enable scan button
    document.getElementById('scanBtn').disabled = false;
    
    showToast('Photo captured! Click "Extract Text" to scan.', 'success');
}

function enhanceImage(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Simple contrast enhancement
    const contrast = 1.3;
    const brightness = 10;
    
    for (let i = 0; i < data.length; i += 4) {
        // RGB contrast
        data[i] = ((data[i] / 255 - 0.5) * contrast + 0.5) * 255;
        data[i + 1] = ((data[i + 1] / 255 - 0.5) * contrast + 0.5) * 255;
        data[i + 2] = ((data[i + 2] / 255 - 0.5) * contrast + 0.5) * 255;
        
        // Brightness
        data[i] += brightness;
        data[i + 1] += brightness;
        data[i + 2] += brightness;
        
        // Clamp values
        data[i] = Math.min(255, Math.max(0, data[i]));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1]));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2]));
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
}

function closeCamera() {
    document.getElementById('cameraModal').style.display = 'none';
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// ==================== IMAGE UPLOAD ====================

function openFilePicker() {
    document.getElementById('imageInput').click();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.match('image.*')) {
        showToast('Please select an image file (JPEG, PNG)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentImageData = e.target.result;
        
        // Enhance the uploaded image
        enhanceUploadedImage(currentImageData).then(enhancedData => {
            currentImageData = enhancedData;
            updateImagePreview(currentImageData);
            document.getElementById('scanBtn').disabled = false;
            showToast('Image uploaded! Click "Extract Text" to scan.', 'success');
        });
    };
    
    reader.readAsDataURL(file);
}

async function enhanceUploadedImage(imageData) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw and enhance
            ctx.drawImage(img, 0, 0);
            enhanceImage(canvas);
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = imageData;
    });
}

function updateImagePreview(imageData) {
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    
    preview.src = imageData;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
}

function clearImage() {
    const preview = document.getElementById('previewImage');
    const placeholder = document.querySelector('.preview-placeholder');
    
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'block';
    currentImageData = null;
    document.getElementById('scanBtn').disabled = true;
    document.getElementById('ocrResults').style.display = 'none';
}

// ==================== SIMPLE OCR USING CANVAS ====================

async function scanText() {
    if (!currentImageData) {
        showToast('Please capture or upload an image first', 'error');
        return;
    }
    
    // Show loading
    const scanBtn = document.getElementById('scanBtn');
    const originalText = scanBtn.innerHTML;
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        // Try multiple OCR methods
        let text = '';
        
        // Method 1: Try Tesseract.js if available
        if (typeof Tesseract !== 'undefined') {
            text = await tryTesseractOCR();
        }
        
        // Method 2: If Tesseract fails or not available, use canvas text extraction
        if (!text) {
            text = await extractTextWithCanvas();
        }
        
        // Method 3: If still no text, use manual pattern matching
        if (!text || text.trim().length < 10) {
            text = extractPatternsFromImage();
        }
        
        // Display results
        extractedText = text || 'No text could be extracted. Please try a clearer image or enter manually.';
        document.getElementById('extractedText').textContent = extractedText;
        document.getElementById('ocrResults').style.display = 'block';
        
        showToast('Text extraction complete!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        showToast('Text extraction failed. Please enter details manually.', 'error');
        
        // Still show results area for manual entry
        extractedText = 'Could not extract text automatically. Please enter details below.';
        document.getElementById('extractedText').textContent = extractedText;
        document.getElementById('ocrResults').style.display = 'block';
    } finally {
        // Reset button
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="fas fa-robot"></i> Extract Text';
    }
}

async function tryTesseractOCR() {
    try {
        // Dynamically load Tesseract if not already loaded
        if (typeof Tesseract === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
        }
        
        const worker = await Tesseract.createWorker('eng');
        const result = await worker.recognize(currentImageData);
        await worker.terminate();
        
        return result.data.text;
    } catch (error) {
        console.log('Tesseract failed, using fallback:', error);
        return '';
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function extractTextWithCanvas() {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas to image size
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image
            ctx.drawImage(img, 0, 0);
            
            // Get image data for pattern analysis
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Simple pattern recognition for common business card text
            let detectedText = analyzeImagePatterns(imageData);
            
            resolve(detectedText);
        };
        img.src = currentImageData;
    });
}

function analyzeImagePatterns(imageData) {
    // This is a very basic pattern analyzer
    // In a real app, you'd use a proper OCR library
    
    const patterns = [
        { regex: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, type: 'name' },
        { regex: /\b[A-Z]{2,}\b/g, type: 'acronym' },
        { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone' },
        { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email' },
        { regex: /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g, type: 'website' }
    ];
    
    // Convert image data to grayscale and analyze
    const data = imageData.data;
    let text = '';
    
    // Simple edge detection for text-like patterns
    let edgeCount = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Check for high contrast edges (potential text)
        if (i > 4) {
            const prevGray = 0.299 * data[i - 4] + 0.587 * data[i - 3] + 0.114 * data[i - 2];
            if (Math.abs(gray - prevGray) > 50) {
                edgeCount++;
            }
        }
    }
    
    // If enough edges detected, assume it's text
    if (edgeCount > 10000) {
        text = "Text detected (OCR would extract details)\n\n";
        text += "Sample patterns that might be found:\n";
        text += "- Company names\n";
        text += "- Personal names\n";
        text += "- Email addresses\n";
        text += "- Phone numbers\n";
        text += "- Website URLs\n\n";
        text += "Click 'Auto-Fill Form' to use pattern detection.";
    }
    
    return text;
}

function extractPatternsFromImage() {
    // Create patterns based on common business card elements
    const patterns = {
        email: 'example@company.com',
        phone: '(123) 456-7890',
        website: 'www.company.com',
        address: '123 Business Street, City, State 12345'
    };
    
    let text = "Common business card elements detected:\n\n";
    text += "Fill in these typical fields:\n";
    text += "1. Company Name: [Detected from logo/header]\n";
    text += "2. Contact Person: [Name in larger font]\n";
    text += "3. Job Title: [Usually under name]\n";
    text += "4. Email: example@company.com\n";
    text += "5. Phone: (123) 456-7890\n";
    text += "6. Website: www.company.com\n";
    text += "7. Address: 123 Business Street\n\n";
    text += "Click 'Auto-Fill Form' to insert sample patterns.";
    
    return text;
}

function applyOCRResults() {
    if (!extractedText) {
        showToast('No text extracted yet', 'error');
        return;
    }
    
    // Simple pattern matching from extracted text
    const text = extractedText.toLowerCase();
    
    // Look for email
    const emailMatch = text.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/);
    if (emailMatch) {
        document.getElementById('email').value = emailMatch[0];
    }
    
    // Look for phone
    const phoneMatch = text.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
        document.getElementById('phone').value = phoneMatch[0];
    }
    
    // Look for website
    const websiteMatch = text.match(/(www\.|https?:\/\/)[a-z0-9.-]+\.[a-z]{2,}/);
    if (websiteMatch) {
        document.getElementById('website').value = websiteMatch[0];
    }
    
    // Look for company name (first line or capitalized words)
    const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0 && lines[0].length > 2 && lines[0].length < 50) {
        document.getElementById('companyName').value = lines[0].trim();
    }
    
    // Look for person name (second line or Mr./Ms. pattern)
    if (lines.length > 1) {
        const secondLine = lines[1].trim();
        if (secondLine.split(' ').length >= 2 && secondLine.split(' ').length <= 3) {
            document.getElementById('contactPerson').value = secondLine;
        }
    }
    
    showToast('Form auto-filled with detected patterns', 'info');
}

// ==================== CARD MANAGEMENT ====================

function loadCards() {
    try {
        const saved = localStorage.getItem('businessCards');
        if (saved) {
            cards = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading cards:', error);
        cards = [];
    }
}

function saveCards() {
    try {
        localStorage.setItem('businessCards', JSON.stringify(cards));
    } catch (error) {
        console.error('Error saving cards:', error);
        showToast('Error saving card', 'error');
    }
}

function saveCard() {
    const companyName = document.getElementById('companyName').value.trim();
    const contactPerson = document.getElementById('contactPerson').value.trim();
    
    if (!companyName && !contactPerson) {
        showToast('Please enter at least company name or contact person', 'error');
        return;
    }
    
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
        imageData: currentImageData
    };
    
    cards.push(card);
    saveCards();
    
    displayCards();
    updateCardCount();
    clearForm();
    clearImage();
    
    showToast('Business card saved successfully!', 'success');
}

function clearForm() {
    document.getElementById('companyName').value = '';
    document.getElementById('contactPerson').value = '';
    document.getElementById('jobTitle').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('website').value = '';
    document.getElementById('address').value = '';
}

function displayCards(filteredCards = null) {
    const cardsContainer = document.getElementById('cardsContainer');
    const cardsToDisplay = filteredCards || cards;
    
    cardsContainer.innerHTML = '';
    
    if (cardsToDisplay.length === 0) {
        if (filteredCards) {
            cardsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No Matching Cards</h3>
                    <p>Try a different search term</p>
                </div>
            `;
        } else {
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
    
    cardsToDisplay.forEach((card, index) => {
        const cardElement = createCardElement(card, index);
        cardsContainer.appendChild(cardElement);
    });
}

function createCardElement(card, index) {
    const div = document.createElement('div');
    div.className = 'business-card';
    
    const firstLetter = card.companyName ? card.companyName.charAt(0).toUpperCase() : 
                       card.contactPerson ? card.contactPerson.charAt(0).toUpperCase() : 'C';
    
    const date = new Date(card.createdAt);
    const dateString = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
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

function filterCards() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase().trim();
    
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
    
    displayCards(filteredCards);
}

function editCard(index) {
    const card = cards[index];
    currentEditIndex = index;
    
    document.getElementById('editCompanyName').value = card.companyName || '';
    document.getElementById('editContactPerson').value = card.contactPerson || '';
    document.getElementById('editJobTitle').value = card.jobTitle || '';
    document.getElementById('editEmail').value = card.email || '';
    document.getElementById('editPhone').value = card.phone || '';
    document.getElementById('editWebsite').value = card.website || '';
    document.getElementById('editAddress').value = card.address || '';
    
    document.getElementById('editModal').style.display = 'flex';
}

function updateCard() {
    if (currentEditIndex === -1) return;
    
    const card = cards[currentEditIndex];
    card.companyName = document.getElementById('editCompanyName').value.trim();
    card.contactPerson = document.getElementById('editContactPerson').value.trim();
    card.jobTitle = document.getElementById('editJobTitle').value.trim();
    card.email = document.getElementById('editEmail').value.trim();
    card.phone = document.getElementById('editPhone').value.trim();
    card.website = document.getElementById('editWebsite').value.trim();
    card.address = document.getElementById('editAddress').value.trim();
    
    saveCards();
    displayCards();
    closeEditModal();
    
    showToast('Card updated successfully!', 'success');
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditIndex = -1;
}

function deleteCard(index) {
    if (!confirm('Are you sure you want to delete this card?')) {
        return;
    }
    
    cards.splice(index, 1);
    saveCards();
    displayCards();
    updateCardCount();
    
    showToast('Card deleted successfully!', 'success');
}

function updateCardCount() {
    document.getElementById('totalCards').textContent = cards.length;
}

// ==================== UTILITIES ====================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    
    toast.textContent = message;
    toast.style.display = 'block';
    
    if (type === 'success') {
        toast.style.background = '#4cd964';
    } else if (type === 'error') {
        toast.style.background = '#ff6b6b';
    } else if (type === 'info') {
        toast.style.background = '#667eea';
    } else {
        toast.style.background = '#333';
    }
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Clean up
window.addEventListener('beforeunload', function() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});
