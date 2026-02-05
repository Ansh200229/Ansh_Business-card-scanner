// Business Card Scanner with Camera and OCR

let cards = [];
let currentEditIndex = -1;
let cameraStream = null;
let currentCamera = 'user'; // 'user' for front, 'environment' for back
let ocrWorker = null;
let currentImageData = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadCards();
    updateCardCount();
    displayCards();
});

// Load cards from local storage
function loadCards() {
    const saved = localStorage.getItem('businessCards');
    if (saved) {
        cards = JSON.parse(saved);
    }
}

// Save cards to local storage
function saveCards() {
    localStorage.setItem('businessCards', JSON.stringify(cards));
}

// Camera Functions
function openCamera() {
    document.getElementById('cameraModal').style.display = 'flex';
    startCamera();
}

async function startCamera() {
    try {
        // Stop any existing stream
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        
        // Request camera access
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentCamera,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        
        // Display camera feed
        const cameraView = document.getElementById('cameraView');
        cameraView.srcObject = cameraStream;
        
    } catch (error) {
        console.error('Camera error:', error);
        showToast('Cannot access camera. Please check permissions.', 'error');
        closeCamera();
    }
}

function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    startCamera();
}

function capturePhoto() {
    if (!cameraStream) return;
    
    const cameraView = document.getElementById('cameraView');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = cameraView.videoWidth;
    canvas.height = cameraView.videoHeight;
    
    // Draw current video frame to canvas
    context.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
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
    document.getElementById('cameraModal').style.display = 'none';
    
    // Stop camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// Image Upload
function openFilePicker() {
    document.getElementById('imageInput').click();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentImageData = e.target.result;
        updateImagePreview(currentImageData);
        document.getElementById('scanBtn').disabled = false;
        showToast('Image uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
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
}

// OCR Functions
async function startOCR() {
    if (!currentImageData) {
        showToast('Please capture or upload an image first', 'error');
        return;
    }
    
    const scanBtn = document.getElementById('scanBtn');
    const progress = document.getElementById('ocrProgress');
    
    // Disable scan button and show progress
    scanBtn.disabled = true;
    progress.style.display = 'block';
    
    try {
        // Initialize Tesseract worker
        if (!ocrWorker) {
            ocrWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => updateOCRProgress(m)
            });
        }
        
        // Perform OCR
        const result = await ocrWorker.recognize(currentImageData);
        
        // Process OCR results
        processOCRResults(result.data.text);
        
        // Hide progress
        progress.style.display = 'none';
        scanBtn.disabled = false;
        
        showToast('Text extracted successfully!', 'success');
        
    } catch (error) {
        console.error('OCR Error:', error);
        progress.style.display = 'none';
        scanBtn.disabled = false;
        showToast('OCR failed. Please try again.', 'error');
    }
}

function updateOCRProgress(message) {
    if (message.status === 'recognizing text') {
        const progress = Math.round(message.progress * 100);
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressPercent').textContent = `${progress}%`;
    }
}

function processOCRResults(text) {
    console.log('OCR Text:', text);
    
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Simple parsing logic (you can improve this)
    let companyName = '';
    let contactPerson = '';
    let jobTitle = '';
    let email = '';
    let phone = '';
    let website = '';
    let address = '';
    
    // Look for email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    for (let line of lines) {
        const emailMatch = line.match(emailRegex);
        if (emailMatch) {
            email = emailMatch[0];
            break;
        }
    }
    
    // Look for phone
    const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    for (let line of lines) {
        const phoneMatch = line.match(phoneRegex);
        if (phoneMatch) {
            phone = phoneMatch[0];
            break;
        }
    }
    
    // Look for website
    const websiteRegex = /(www\.|https?:\/\/)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/;
    for (let line of lines) {
        const websiteMatch = line.match(websiteRegex);
        if (websiteMatch) {
            website = websiteMatch[0];
            break;
        }
    }
    
    // Simple heuristics for other fields
    // First substantial line might be company name
    if (lines.length > 0 && lines[0].trim().length > 2 && lines[0].trim().length < 50) {
        companyName = lines[0].trim();
    }
    
    // Look for job titles
    const jobTitleRegex = /(CEO|CTO|CFO|COO|Director|Manager|Engineer|Developer|Designer|Analyst|President|Vice President)/i;
    for (let line of lines) {
        if (jobTitleRegex.test(line)) {
            jobTitle = line.trim();
            break;
        }
    }
    
    // Look for names (simple heuristic - lines with 2-3 words)
    for (let line of lines) {
        const words = line.trim().split(' ');
        if (words.length >= 2 && words.length <= 3) {
            if (!contactPerson && !jobTitleRegex.test(line)) {
                contactPerson = line.trim();
            }
        }
    }
    
    // Fill form with extracted data
    document.getElementById('companyName').value = companyName;
    document.getElementById('contactPerson').value = contactPerson;
    document.getElementById('jobTitle').value = jobTitle;
    document.getElementById('email').value = email;
    document.getElementById('phone').value = phone;
    document.getElementById('website').value = website;
    
    showToast('Form auto-filled with extracted data. Please verify.', 'info');
}

// Card Management Functions
function saveCard() {
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
            <img src="${card.imageData}" alt="Scanned card" style="max-width: 100px; max-height: 80px; border-radius: 5px; margin-top: 5px; cursor: pointer;" 
                 onclick="showImage('${card.imageData}')">
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
    const img = new Image();
    img.src = imageData;
    img.style.maxWidth = '90vw';
    img.style.maxHeight = '90vh';
    img.style.borderRadius = '10px';
    
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2000';
    modal.style.cursor = 'pointer';
    
    modal.onclick = function() {
        document.body.removeChild(modal);
    };
    
    modal.appendChild(img);
    document.body.appendChild(modal);
}

// Filter cards based on search input
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

// Edit card
function editCard(index) {
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
    if (currentEditIndex === -1) return;
    
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
    document.getElementById('editModal').style.display = 'none';
    currentEditIndex = -1;
}

// Delete card
function deleteCard(index) {
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

// Show toast notification
function showToast(message, type = 'info') {
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
    // Stop camera if active
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    
    // Terminate OCR worker
    if (ocrWorker) {
        ocrWorker.terminate();
    }
});
