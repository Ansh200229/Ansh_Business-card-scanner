// Business Card Manager - Simple Local Storage Version

let cards = [];
let currentEditIndex = -1;

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

// Save new card
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
        id: Date.now(), // Unique ID based on timestamp
        companyName: companyName,
        contactPerson: contactPerson,
        jobTitle: document.getElementById('jobTitle').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        website: document.getElementById('website').value.trim(),
        address: document.getElementById('address').value.trim(),
        createdAt: new Date().toISOString()
    };
    
    // Add to cards array
    cards.push(card);
    
    // Save to local storage
    saveCards();
    
    // Update UI
    displayCards();
    updateCardCount();
    
    // Clear form
    clearForm();
    
    // Show success message
    showToast('Business card saved successfully!', 'success');
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
    closeModal();
    
    // Show success message
    showToast('Card updated successfully!', 'success');
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

// Clear form
function clearForm() {
    document.getElementById('companyName').value = '';
    document.getElementById('contactPerson').value = '';
    document.getElementById('jobTitle').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('website').value = '';
    document.getElementById('address').value = '';
}

// Close modal
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditIndex = -1;
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
    } else {
        toast.style.background = '#333';
    }
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Add CSS for card footer
const style = document.createElement('style');
style.textContent = `
    .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #f0f0f0;
    }
    
    .card-date {
        font-size: 12px;
        color: #999;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .card-date i {
        font-size: 14px;
    }
`;
document.head.appendChild(style);
