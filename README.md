# Business Card Scanner

A responsive web application that scans business cards using OCR (Optical Character Recognition) and extracts contact information.

## Features

### 🎯 Core Features
- **OCR Scanning**: Extract text from business card images using Tesseract.js
- **AI-Powered Extraction**: Smart parsing of extracted text into structured data
- **Mobile Camera Support**: Capture images directly from your device camera
- **Cross-Device Sync**: Share data between devices using QR codes
- **Responsive Design**: Works perfectly on mobile, tablet, and desktop

### 📱 Mobile Optimized
- Touch-friendly interface
- Camera auto-rotates for mobile
- Stacked table view on small screens
- Automatic camera closing after capture

### 🔄 Data Management
- Save data to browser storage
- Export to Excel
- Import/Export via QR codes
- Search functionality
- Manual correction interface

## How to Use

### 1. Upload or Capture Images
- **Upload**: Use the "Upload Image" tab to select images from your device
- **Camera**: Use the "Use Camera" tab to capture images directly

### 2. Scan Cards
1. Upload/Capture front image (required)
2. Upload/Capture back image (optional)
3. Click "Scan Card"
4. AI will extract information automatically
5. Verify and correct if needed

### 3. Manage Data
- **Save Data**: Click "Save Data" to store in browser
- **Load Data**: Click "Load Data" to retrieve saved data
- **Export Excel**: Download data as Excel file
- **Clear Data**: Remove all data from current device

### 4. Sync Across Devices
1. Click "Sync" button
2. **Export**: Generate QR code with your data
3. **Import**: Scan QR code from another device or paste data
4. Data will merge with existing records

## Setup

### Option 1: Use GitHub Pages (Easiest)
1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Your app will be live at: `username.github.io/repository-name`

### Option 2: Local Deployment
1. Save `index.html` to your computer
2. Open in any modern browser
3. No server needed - works offline!

## Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Mobile Chrome/Firefox/Safari

## Privacy & Security
- All processing happens in your browser
- Images never leave your device
- Data stored locally in browser storage
- No external servers required

## Tips for Best Results

### Image Quality
- Use clear, well-lit images
- Avoid glare and shadows
- Keep card flat and straight
- Crop to just the card if possible

### OCR Accuracy
- Higher resolution images work better
- Plain backgrounds improve accuracy
- Standard fonts extract more reliably
- Multiple attempts may be needed

### Data Sync
- Export QR codes for backup
- Scan QR codes in good lighting
- Data merges automatically
- Duplicates are prevented

## Troubleshooting

### Camera Not Working
- Ensure camera permissions are granted
- Try a different browser
- Check if camera is being used by another app
- Use file upload as alternative

### OCR Not Accurate
- Improve image quality
- Try different lighting
- Rotate image if text is sideways
- Use manual correction feature

### Data Not Saving
- Check browser storage permissions
- Try a different browser
- Export data as backup before clearing

## License
MIT License - Free to use and modify

## Support
For issues or questions:
1. Check troubleshooting section
2. Ensure browser is updated
3. Try in incognito/private mode
4. Contact developer for assistance
