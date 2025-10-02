import { QRGenerator } from './qrGenerator.js';
import { UIController } from './uiController.js';
import { DownloadManager } from './downloadManager.js';
import { HistoryManager } from './historyManager.js';
import { ThemeManager } from './themeManager.js';
import { InstallPromptManager } from './installPrompt.js';
import { FileUploadManager } from './fileUploadManager.js';

// Default color configuration for each QR type
const QR_TYPE_COLORS = {
    text: { dark: '#000000', light: '#FFFFFF' },
    url: { dark: '#007AFF', light: '#FFFFFF' },
    email: { dark: '#5856D6', light: '#FFFFFF' },
    phone: { dark: '#34C759', light: '#FFFFFF' },
    sms: { dark: '#32D74B', light: '#FFFFFF' },
    whatsapp: { dark: '#25D366', light: '#FFFFFF' },
    youtube: { dark: '#FF0000', light: '#FFFFFF' },
    wifi: { dark: '#FF9500', light: '#FFFFFF' },
    vcard: { dark: '#AF52DE', light: '#FFFFFF' },
    maps: { dark: '#FF3B30', light: '#FFFFFF' },
    event: { dark: '#FFD60A', light: '#000000' },
    upi: { dark: '#6B3AA5', light: '#FFFFFF' },
    attendance: { dark: '#00C853', light: '#FFFFFF' },
    file: { dark: '#FF5722', light: '#FFFFFF' },
    ar: { dark: '#FF00FF', light: '#FFFFFF' }
};

class QRCodeApp {
    constructor() {
        this.qrGenerator = new QRGenerator();
        this.uiController = new UIController();
        this.downloadManager = new DownloadManager();
        this.historyManager = new HistoryManager();
        this.themeManager = new ThemeManager();
        this.installPromptManager = new InstallPromptManager();
        this.fileUploadManager = new FileUploadManager();
        
        this.currentQRCode = null;
        this.isMobile = this.checkMobile();
        this.init();
    }

    checkMobile() {
        return window.innerWidth <= 768 || 
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    init() {
        this.registerServiceWorker();
        this.setupEventListeners();
        this.loadHistory();
        this.themeManager.init();
        this.uiController.init();

        // Apply default colors for the initial QR type
        const initialType = document.getElementById('qrType').value;
        this.applyDefaultColors(initialType);

        // Check if URL has attendance parameters
        this.handleAttendanceMode();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered successfully:', registration);
                
                // Check for updates on page load
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available
                            this.uiController.showNotification('New version available! Refresh to update.', 'info', 5000);
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    setupEventListeners() {
        document.getElementById('generateBtn').addEventListener('click', () => this.generateQRCode());
        
        document.getElementById('qrType').addEventListener('change', (e) => {
            this.uiController.switchInputType(e.target.value);
            this.updateSidebarActiveState(e.target.value);
            this.applyDefaultColors(e.target.value);
            this.resetCustomizationOptions();
            this.uiController.hideQRCode();
        });
        
        // Add event listeners for sidebar navigation buttons
        const typeMenuItems = document.querySelectorAll('.type-menu-item');
        typeMenuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const type = e.currentTarget.getAttribute('data-type');
                document.getElementById('qrType').value = type;
                this.uiController.switchInputType(type);
                this.updateSidebarActiveState(type);
                this.applyDefaultColors(type);
                this.resetCustomizationOptions();
                this.uiController.hideQRCode();
            });
        });
        
        document.getElementById('qrSize').addEventListener('change', () => {
            // Dropdown change event - no need to update display value
        });
        
        document.getElementById('margin').addEventListener('change', () => {
            // Dropdown change event - no need to update display value
        });
        
        document.getElementById('colorDark').addEventListener('input', (e) => {
            document.getElementById('colorDarkHex').value = e.target.value;
        });
        
        document.getElementById('colorDarkHex').addEventListener('input', (e) => {
            const value = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                document.getElementById('colorDark').value = value;
            }
        });
        
        document.getElementById('colorLight').addEventListener('input', (e) => {
            document.getElementById('colorLightHex').value = e.target.value;
        });
        
        document.getElementById('colorLightHex').addEventListener('input', (e) => {
            const value = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                document.getElementById('colorLight').value = value;
            }
        });
        
        document.getElementById('frameOption').addEventListener('change', (e) => {
            const customFrameGroup = document.getElementById('customFrameTextGroup');
            const autoFrameOptions = document.getElementById('autoFrameOptions');
            
            if (e.target.value === 'custom') {
                customFrameGroup.classList.remove('hidden');
                autoFrameOptions.classList.add('hidden');
            } else if (e.target.value === 'auto') {
                customFrameGroup.classList.add('hidden');
                autoFrameOptions.classList.remove('hidden');
                this.updateAutoFrameOptions();
            } else {
                customFrameGroup.classList.add('hidden');
                autoFrameOptions.classList.add('hidden');
            }
        });
        
        document.getElementById('qrType').addEventListener('change', () => {
            // Update auto frame options when QR type changes
            if (document.getElementById('frameOption').value === 'auto') {
                this.updateAutoFrameOptions();
            }
        });

        // YouTube URL input listener for real-time type detection
        document.getElementById('youtubeUrl').addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url) {
                const ytData = this.qrGenerator.parseYouTubeURL(url);
                this.updateYouTubeTypeIndicator(ytData);
            } else {
                document.getElementById('youtubeTypeIndicator').style.display = 'none';
            }
        });

        // Attendance action type listeners
        document.querySelectorAll('input[name="attendanceAction"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const customActionRow = document.getElementById('customActionRow');
                if (e.target.value === 'custom') {
                    customActionRow.classList.remove('hidden');
                } else {
                    customActionRow.classList.add('hidden');
                    document.getElementById('attendanceCustomAction').value = '';
                }
            });
        });

        // Attendance contact method listeners
        document.querySelectorAll('input[name="attendanceContact"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const phoneInput = document.getElementById('attendancePhone');
                const emailInput = document.getElementById('attendanceEmail');
                const contactLabel = document.getElementById('attendanceContactLabel');
                const contactHint = document.getElementById('attendanceContactHint');

                if (e.target.value === 'whatsapp') {
                    phoneInput.style.display = 'block';
                    emailInput.style.display = 'none';
                    contactLabel.innerHTML = 'WhatsApp Number <span style="color: var(--error-color);">*</span>';
                    contactHint.textContent = 'Enter the WhatsApp number to receive attendance data.';
                } else {
                    phoneInput.style.display = 'none';
                    emailInput.style.display = 'block';
                    contactLabel.innerHTML = 'Email Address <span style="color: var(--error-color);">*</span>';
                    contactHint.textContent = 'Enter the email address to receive attendance data.';
                }
            });
        });

        // AR marker type change listener
        document.getElementById('arMarkerType').addEventListener('change', (e) => {
            const markerType = e.target.value;
            const customPatternRow = document.getElementById('arCustomPatternRow');

            if (markerType === 'custom') {
                customPatternRow.classList.remove('hidden');
            } else {
                customPatternRow.classList.add('hidden');
            }
        });

        document.getElementById('downloadPNG').addEventListener('click', () => {
            if (this.currentQRCode) {
                const downloadOptions = { ...this.currentQRCode.options };
                downloadOptions.width = downloadOptions.actualWidth || downloadOptions.width;
                downloadOptions.height = downloadOptions.actualHeight || downloadOptions.height;
                this.downloadManager.downloadPNG({ ...this.currentQRCode, options: downloadOptions });
            }
        });
        
        document.getElementById('downloadSVG').addEventListener('click', () => {
            if (this.currentQRCode) {
                const downloadOptions = { ...this.currentQRCode.options };
                downloadOptions.width = downloadOptions.actualWidth || downloadOptions.width;
                downloadOptions.height = downloadOptions.actualHeight || downloadOptions.height;
                this.downloadManager.downloadSVG({ ...this.currentQRCode, options: downloadOptions });
            }
        });
        
        document.getElementById('copyImage').addEventListener('click', () => {
            if (this.currentQRCode) {
                const downloadOptions = { ...this.currentQRCode.options };
                downloadOptions.width = downloadOptions.actualWidth || downloadOptions.width;
                downloadOptions.height = downloadOptions.actualHeight || downloadOptions.height;
                this.downloadManager.copyToClipboard({ ...this.currentQRCode, options: downloadOptions });
            }
        });
        
        document.getElementById('clearHistory').addEventListener('click', () => {
            const itemCount = this.historyManager.getItems().length;
            if (itemCount === 0) {
                this.uiController.showNotification('History is already empty', 'info');
                return;
            }
            
            const message = `Are you sure you want to delete all ${itemCount} QR code${itemCount > 1 ? 's' : ''} from history? This action cannot be undone.`;
            
            if (confirm(message)) {
                this.historyManager.clearHistory();
                this.loadHistory();
                this.uiController.showNotification('History cleared', 'success');
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.generateQRCode();
            }
        });
    }

    generateQRCode() {
        const type = document.getElementById('qrType').value;
        const data = this.getInputData(type);
        
        if (!data) {
            this.uiController.showNotification('Please enter valid data', 'error');
            return;
        }
        
        const actualSize = parseInt(document.getElementById('qrSize').value);
        const previewSize = this.isMobile ? Math.min(200, actualSize) : actualSize;
        
        const frameOption = document.getElementById('frameOption').value;
        const customFrameText = document.getElementById('customFrameText').value;
        
        // Get selected auto frame type if auto frame is selected
        let autoFrameType = 'generic';
        if (frameOption === 'auto') {
            const selectedOption = document.querySelector('input[name="autoFrameType"]:checked');
            if (selectedOption) {
                autoFrameType = selectedOption.value;
            }
        }
        
        const options = {
            width: previewSize,
            height: previewSize,
            actualWidth: actualSize,
            actualHeight: actualSize,
            colorDark: document.getElementById('colorDark').value,
            colorLight: document.getElementById('colorLight').value,
            correctLevel: QRCode.CorrectLevel[document.getElementById('errorCorrection').value],
            margin: parseInt(document.getElementById('margin').value),
            moduleShape: document.getElementById('moduleShape').value,
            frameOption: frameOption,
            customFrameText: customFrameText,
            autoFrameType: autoFrameType,
            qrType: type,
            qrData: data
        };

        // Add file metadata if available
        if (type === 'file' && this.currentFileMetadata) {
            options.fileMetadata = this.currentFileMetadata;
        }

        // Add AR experience name if available
        if (type === 'ar') {
            const experienceName = document.getElementById('arExperienceName').value.trim();
            if (experienceName) {
                options.arExperienceName = experienceName;
            }
        }
        
        try {
            this.qrGenerator.generate(data, options).then((qrCode) => {
                this.currentQRCode = qrCode;
                this.uiController.showQRCode();
                
                const historyItem = {
                    type,
                    data,
                    options,
                    timestamp: Date.now()
                };
                
                this.historyManager.addItem(historyItem);
                this.loadHistory();
                
                this.uiController.showNotification('QR Code generated successfully', 'success');
            });
        } catch (error) {
            console.error('Error generating QR code:', error);
            this.uiController.showNotification('Failed to generate QR code', 'error');
        }
    }

    getInputData(type) {
        switch (type) {
            case 'text':
                return document.getElementById('textInput').value.trim();
            
            case 'url':
                const url = document.getElementById('urlInput').value.trim();
                if (url && !url.match(/^https?:\/\//)) {
                    return 'https://' + url;
                }
                return url;
            
            case 'email':
                const email = document.getElementById('emailAddress').value.trim();
                if (!email) return null;
                
                const subject = document.getElementById('emailSubject').value.trim();
                const body = document.getElementById('emailBody').value.trim();
                
                let mailto = `mailto:${email}`;
                const params = [];
                if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
                if (body) params.push(`body=${encodeURIComponent(body)}`);
                if (params.length) mailto += '?' + params.join('&');
                
                return mailto;
            
            case 'phone':
                const phone = document.getElementById('phoneNumber').value.trim();
                return phone ? `tel:${phone}` : null;
            
            case 'sms':
                const smsNumber = document.getElementById('smsNumber').value.trim();
                const smsMessage = document.getElementById('smsMessage').value.trim();
                if (!smsNumber) return null;
                
                return smsMessage ? `sms:${smsNumber}?body=${encodeURIComponent(smsMessage)}` : `sms:${smsNumber}`;
            
            case 'whatsapp':
                const whatsappNumber = document.getElementById('whatsappNumber').value.trim();
                const whatsappMessage = document.getElementById('whatsappMessage').value.trim();
                if (!whatsappNumber) return null;

                const cleanNumber = whatsappNumber.replace(/[^\d]/g, '');

                let waUrl = `https://wa.me/${cleanNumber}`;
                if (whatsappMessage) {
                    waUrl += `?text=${encodeURIComponent(whatsappMessage)}`;
                }

                return waUrl;

            case 'youtube':
                const youtubeUrl = document.getElementById('youtubeUrl').value.trim();
                if (!youtubeUrl) return null;

                // Validate and normalize YouTube URL
                const ytUrlData = this.qrGenerator.parseYouTubeURL(youtubeUrl);
                if (!ytUrlData || !ytUrlData.valid) {
                    this.uiController.showNotification('Please enter a valid YouTube URL', 'error');
                    return null;
                }

                // Update the type indicator
                this.updateYouTubeTypeIndicator(ytUrlData);

                return ytUrlData.normalizedUrl;

            case 'wifi':
                const ssid = document.getElementById('wifiSSID').value.trim();
                const password = document.getElementById('wifiPassword').value.trim();
                const security = document.getElementById('wifiSecurity').value;
                const hidden = document.getElementById('wifiHidden').checked;
                
                if (!ssid) return null;
                
                let wifiString = `WIFI:T:${security};S:${ssid};`;
                if (security !== 'nopass' && password) {
                    wifiString += `P:${password};`;
                }
                if (hidden) {
                    wifiString += 'H:true;';
                }
                wifiString += ';';
                
                return wifiString;
            
            case 'maps':
                const mapsLink = document.getElementById('mapsLink').value.trim();
                if (!mapsLink) return null;
                
                // Validate that it's a Google Maps or Apple Maps link
                const isValidMapLink = 
                    mapsLink.includes('maps.google.com') ||
                    mapsLink.includes('maps.app.goo.gl') ||
                    mapsLink.includes('goo.gl/maps') ||
                    mapsLink.includes('maps.apple.com') ||
                    mapsLink.includes('apple.co') ||
                    (mapsLink.startsWith('https://') && 
                     (mapsLink.includes('google') || mapsLink.includes('apple')) && 
                     mapsLink.includes('map'));
                
                if (!isValidMapLink) {
                    this.uiController.showNotification('Please enter a valid Google Maps or Apple Maps link', 'error');
                    return null;
                }
                
                return mapsLink;
            
            case 'vcard':
                const vcardName = document.getElementById('vcardName').value.trim();
                const vcardMobile = document.getElementById('vcardMobile').value.trim();
                const vcardEmail = document.getElementById('vcardEmail').value.trim();

                if (!vcardName || !vcardMobile || !vcardEmail) {
                    this.uiController.showNotification('Name, Mobile, and Email are required fields', 'error');
                    return null;
                }

                const vcardCompany = document.getElementById('vcardCompany').value.trim();
                const vcardJobTitle = document.getElementById('vcardJobTitle').value.trim();
                const vcardStreet = document.getElementById('vcardStreet').value.trim();
                const vcardCity = document.getElementById('vcardCity').value.trim();
                const vcardZip = document.getElementById('vcardZip').value.trim();
                const vcardState = document.getElementById('vcardState').value.trim();
                const vcardCountry = document.getElementById('vcardCountry').value.trim();
                const vcardWebsite = document.getElementById('vcardWebsite').value.trim();

                const vcardData = {
                    name: vcardName,
                    phone: vcardMobile,
                    email: vcardEmail,
                    org: vcardCompany,
                    title: vcardJobTitle,
                    street: vcardStreet,
                    city: vcardCity,
                    state: vcardState,
                    zip: vcardZip,
                    country: vcardCountry,
                    url: vcardWebsite
                };

                return this.qrGenerator.generateVCard(vcardData);

            case 'event':
                const eventName = document.getElementById('eventName').value.trim();
                const eventStartDate = document.getElementById('eventStartDate').value;
                const eventEndDate = document.getElementById('eventEndDate').value;

                if (!eventName || !eventStartDate || !eventEndDate) {
                    this.uiController.showNotification('Event Name, Start Date, and End Date are required fields', 'error');
                    return null;
                }

                const eventLocation = document.getElementById('eventLocation').value.trim();
                const eventDescription = document.getElementById('eventDescription').value.trim();
                const eventOrganizer = document.getElementById('eventOrganizer').value.trim();

                const eventData = {
                    name: eventName,
                    location: eventLocation,
                    startDate: eventStartDate,
                    endDate: eventEndDate,
                    description: eventDescription,
                    organizer: eventOrganizer
                };

                return this.qrGenerator.generateVEvent(eventData);

            case 'upi':
                const upiId = document.getElementById('upiId').value.trim();
                const upiName = document.getElementById('upiName').value.trim();
                const upiAmount = document.getElementById('upiAmount').value.trim();
                const upiNote = document.getElementById('upiNote').value.trim();

                // Validation
                if (!upiId) {
                    this.uiController.showNotification('UPI ID is required', 'error');
                    return null;
                }

                if (!upiName) {
                    this.uiController.showNotification('Payee Name is required', 'error');
                    return null;
                }

                // Basic UPI ID validation
                const upiPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
                if (!upiPattern.test(upiId)) {
                    this.uiController.showNotification('Invalid UPI ID format. Use format: username@upi', 'error');
                    return null;
                }

                // Build UPI deep link URL
                let upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}`;

                // Add optional amount if provided
                if (upiAmount && parseFloat(upiAmount) > 0) {
                    upiUrl += `&am=${parseFloat(upiAmount).toFixed(2)}`;
                }

                // Add transaction note if provided
                if (upiNote) {
                    upiUrl += `&tn=${encodeURIComponent(upiNote)}`;
                }

                // Always add currency as INR for UPI
                upiUrl += '&cu=INR';

                return upiUrl;

            case 'attendance':
                const attendanceLocation = document.getElementById('attendanceLocation').value.trim();
                const attendanceActionType = document.querySelector('input[name="attendanceAction"]:checked')?.value;
                const attendanceCustomAction = document.getElementById('attendanceCustomAction').value.trim();
                const attendanceEvent = document.getElementById('attendanceEvent').value.trim();
                const attendanceAskName = document.getElementById('attendanceAskName').checked;
                const attendanceContactMethod = document.querySelector('input[name="attendanceContact"]:checked')?.value;
                const attendancePhone = document.getElementById('attendancePhone').value.trim();
                const attendanceEmail = document.getElementById('attendanceEmail').value.trim();

                // Validation
                if (!attendanceLocation) {
                    this.uiController.showNotification('Location name is required', 'error');
                    return null;
                }

                if (!attendanceActionType) {
                    this.uiController.showNotification('Action type is required', 'error');
                    return null;
                }

                if (attendanceActionType === 'custom' && !attendanceCustomAction) {
                    this.uiController.showNotification('Custom action text is required', 'error');
                    return null;
                }

                if (!attendanceContactMethod) {
                    this.uiController.showNotification('Contact method is required', 'error');
                    return null;
                }

                if (attendanceContactMethod === 'whatsapp' && !attendancePhone) {
                    this.uiController.showNotification('WhatsApp number is required', 'error');
                    return null;
                }

                if (attendanceContactMethod === 'email' && !attendanceEmail) {
                    this.uiController.showNotification('Email address is required', 'error');
                    return null;
                }

                // Build attendance URL with parameters
                const attendanceParams = new URLSearchParams();
                attendanceParams.set('attendance', '1');
                attendanceParams.set('loc', attendanceLocation);
                attendanceParams.set('action', attendanceActionType === 'custom' ? attendanceCustomAction : attendanceActionType);
                if (attendanceEvent) attendanceParams.set('event', attendanceEvent);
                attendanceParams.set('askName', attendanceAskName ? 'true' : 'false');
                attendanceParams.set('contact', attendanceContactMethod);
                attendanceParams.set(attendanceContactMethod === 'whatsapp' ? 'phone' : 'email',
                          attendanceContactMethod === 'whatsapp' ? attendancePhone : attendanceEmail);

                return `${window.location.origin}/?${attendanceParams.toString()}`;

            case 'file':
                const fileUploadData = this.fileUploadManager.getUploadedFileData();

                // Check if file has been uploaded
                if (!fileUploadData.url) {
                    // Check if a file is selected
                    if (this.fileUploadManager.selectedFile) {
                        this.uiController.showNotification('Please upload the file first by clicking "Upload File"', 'info');
                    } else {
                        this.uiController.showNotification('Please select a file to upload', 'error');
                    }
                    return null;
                }

                // Store metadata for contextual frame
                if (fileUploadData.metadata) {
                    this.currentFileMetadata = fileUploadData.metadata;
                }

                return fileUploadData.url;

            case 'ar':
                const markerType = document.getElementById('arMarkerType').value;
                const modelUrl = document.getElementById('arModelUrl').value.trim();
                const experienceName = document.getElementById('arExperienceName').value.trim();

                // Validate model URL
                if (!modelUrl) {
                    this.uiController.showNotification('3D Model URL is required', 'error');
                    return null;
                }

                if (!modelUrl.match(/\.(glb|gltf)$/i)) {
                    this.uiController.showNotification('Model must be a .glb or .gltf file', 'error');
                    return null;
                }

                // Determine marker parameter
                let markerParam = markerType;
                if (markerType === 'custom') {
                    const patternUrl = document.getElementById('arPatternUrl').value.trim();
                    if (!patternUrl) {
                        this.uiController.showNotification('Pattern File URL is required for custom markers', 'error');
                        return null;
                    }
                    if (!patternUrl.match(/\.patt$/i)) {
                        this.uiController.showNotification('Pattern file must be a .patt file', 'error');
                        return null;
                    }
                    markerParam = patternUrl;
                }

                // Build AR viewer URL
                const baseUrl = 'https://van007.github.io/QR-Code-Generator/ar.html';
                const arParams = new URLSearchParams({
                    marker: markerParam,
                    model: modelUrl
                });

                if (experienceName) {
                    arParams.append('title', experienceName);
                }

                return `${baseUrl}?${arParams.toString()}`;

            default:
                return null;
        }
    }

    loadHistory(showAll = false) {
        const items = this.historyManager.getItems();
        const historyList = document.getElementById('historyList');
        
        if (items.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <svg class="history-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="9" y="9" width="6" height="6"></rect>
                    </svg>
                    <div class="history-empty-text">
                        <div class="history-empty-title">Your QR history will appear here</div>
                        <div class="history-empty-subtitle">Generate your first QR code above ↑</div>
                    </div>
                </div>
            `;
            return;
        }
        
        historyList.innerHTML = '';
        
        const itemsToShow = showAll ? items : items.slice(0, 5);
        
        itemsToShow.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item fade-in';
            historyItem.style.animationDelay = `${index * 50}ms`;
            
            const preview = document.createElement('div');
            preview.className = 'history-item-preview';
            preview.id = `history-preview-${item.timestamp}`;
            
            const details = document.createElement('div');
            details.className = 'history-item-details';
            
            const type = document.createElement('div');
            type.className = 'history-item-type';
            type.innerHTML = `<span class="history-type-badge type-${item.type}"></span>${item.type.toUpperCase()}`;
            
            const content = document.createElement('div');
            content.className = 'history-item-content';
            content.textContent = this.truncateText(item.data, 30);
            
            const date = document.createElement('div');
            date.className = 'history-item-date';
            date.textContent = this.formatRelativeDate(item.timestamp);
            
            details.appendChild(type);
            details.appendChild(content);
            details.appendChild(date);
            
            const actions = document.createElement('div');
            actions.className = 'history-item-actions';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'history-action-btn';
            downloadBtn.title = 'Download PNG';
            downloadBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            `;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'history-action-btn';
            deleteBtn.title = 'Delete';
            deleteBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadHistoryItem(item);
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.historyManager.removeItem(item.timestamp);
                this.loadHistory(showAll);
            });
            
            actions.appendChild(downloadBtn);
            actions.appendChild(deleteBtn);
            
            historyItem.appendChild(preview);
            historyItem.appendChild(details);
            historyItem.appendChild(actions);
            
            historyItem.addEventListener('click', () => {
                this.restoreFromHistory(item);
            });
            
            historyList.appendChild(historyItem);
            
            setTimeout(() => {
                const previewContainer = document.getElementById(`history-preview-${item.timestamp}`);
                if (previewContainer) {
                    new QRCode(previewContainer, {
                        text: item.data,
                        width: 64,
                        height: 64,
                        colorDark: item.options.colorDark,
                        colorLight: item.options.colorLight,
                        correctLevel: item.options.correctLevel
                    });
                }
            }, 0);
        });
        
        if (items.length > 5 && !showAll) {
            const showMoreDiv = document.createElement('div');
            showMoreDiv.className = 'history-show-more';
            const showMoreBtn = document.createElement('button');
            showMoreBtn.textContent = `Show ${items.length - 5} more`;
            showMoreBtn.addEventListener('click', () => {
                this.loadHistory(true);
            });
            showMoreDiv.appendChild(showMoreBtn);
            historyList.appendChild(showMoreDiv);
        } else if (items.length > 5 && showAll) {
            const showLessDiv = document.createElement('div');
            showLessDiv.className = 'history-show-more';
            const showLessBtn = document.createElement('button');
            showLessBtn.textContent = 'Show less';
            showLessBtn.addEventListener('click', () => {
                this.loadHistory(false);
            });
            showLessDiv.appendChild(showLessBtn);
            historyList.appendChild(showLessDiv);
        }
    }

    downloadHistoryItem(item) {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);
        
        const qr = new QRCode(tempContainer, {
            text: item.data,
            width: item.options.width,
            height: item.options.width,
            colorDark: item.options.colorDark,
            colorLight: item.options.colorLight,
            correctLevel: item.options.correctLevel
        });
        
        setTimeout(() => {
            const canvas = tempContainer.querySelector('canvas');
            if (canvas) {
                this.downloadManager.downloadPNG(canvas);
            }
            document.body.removeChild(tempContainer);
        }, 100);
    }
    
    copyHistoryItem(item) {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);
        
        const qr = new QRCode(tempContainer, {
            text: item.data,
            width: item.options.width,
            height: item.options.width,
            colorDark: item.options.colorDark,
            colorLight: item.options.colorLight,
            correctLevel: item.options.correctLevel
        });
        
        setTimeout(() => {
            const canvas = tempContainer.querySelector('canvas');
            if (canvas) {
                this.downloadManager.copyToClipboard(canvas);
                this.uiController.showNotification('QR code copied to clipboard', 'success');
            }
            document.body.removeChild(tempContainer);
        }, 100);
    }
    
    restoreFromHistory(item) {
        document.getElementById('qrType').value = item.type;
        this.uiController.switchInputType(item.type);
        this.updateSidebarActiveState(item.type);
        
        setTimeout(() => {
            this.restoreInputData(item.type, item.data);
            
            document.getElementById('qrSize').value = item.options.width;
            document.getElementById('colorDark').value = item.options.colorDark;
            document.getElementById('colorDarkHex').value = item.options.colorDark;
            document.getElementById('colorLight').value = item.options.colorLight;
            document.getElementById('colorLightHex').value = item.options.colorLight;
            
            const correctLevelKey = Object.keys(QRCode.CorrectLevel).find(
                key => QRCode.CorrectLevel[key] === item.options.correctLevel
            );
            if (correctLevelKey) {
                document.getElementById('errorCorrection').value = correctLevelKey;
            }
            
            if (item.options.margin !== undefined) {
                document.getElementById('margin').value = item.options.margin;
            }
            
            if (item.options.moduleShape) {
                document.getElementById('moduleShape').value = item.options.moduleShape;
            }
            
            // Restore frame options if present (backwards compatibility)
            if (item.options.frameOption) {
                document.getElementById('frameOption').value = item.options.frameOption;
                const customFrameGroup = document.getElementById('customFrameTextGroup');
                const autoFrameOptions = document.getElementById('autoFrameOptions');
                
                if (item.options.frameOption === 'custom') {
                    customFrameGroup.classList.remove('hidden');
                    autoFrameOptions.classList.add('hidden');
                    if (item.options.customFrameText) {
                        document.getElementById('customFrameText').value = item.options.customFrameText;
                    }
                } else if (item.options.frameOption === 'auto') {
                    customFrameGroup.classList.add('hidden');
                    autoFrameOptions.classList.remove('hidden');
                    this.updateAutoFrameOptions();
                    
                    // Restore auto frame type selection if available
                    if (item.options.autoFrameType) {
                        setTimeout(() => {
                            const radioOption = document.querySelector(`input[name="autoFrameType"][value="${item.options.autoFrameType}"]`);
                            if (radioOption) {
                                radioOption.checked = true;
                            } else {
                                // If radio option not found, try again after a short delay
                                setTimeout(() => {
                                    const retryOption = document.querySelector(`input[name="autoFrameType"][value="${item.options.autoFrameType}"]`);
                                    if (retryOption) {
                                        retryOption.checked = true;
                                    }
                                }, 100);
                            }
                        }, 250);
                    }
                } else {
                    customFrameGroup.classList.add('hidden');
                    autoFrameOptions.classList.add('hidden');
                }
            } else {
                // Default to 'none' for backwards compatibility
                document.getElementById('frameOption').value = 'none';
                document.getElementById('customFrameTextGroup').classList.add('hidden');
                document.getElementById('autoFrameOptions').classList.add('hidden');
            }
            
            // Delay QR code generation to ensure all options (including auto frame type) are set
            setTimeout(() => {
                this.generateQRCode();
            }, 400);
        }, 100);
    }

    restoreInputData(type, data) {
        switch (type) {
            case 'text':
                document.getElementById('textInput').value = data;
                break;
            
            case 'url':
                document.getElementById('urlInput').value = data;
                break;
            
            case 'email':
                const emailMatch = data.match(/mailto:([^?]+)(\?(.+))?/);
                if (emailMatch) {
                    document.getElementById('emailAddress').value = emailMatch[1];
                    if (emailMatch[3]) {
                        const params = new URLSearchParams(emailMatch[3]);
                        document.getElementById('emailSubject').value = params.get('subject') || '';
                        document.getElementById('emailBody').value = params.get('body') || '';
                    }
                }
                break;
            
            case 'phone':
                document.getElementById('phoneNumber').value = data.replace('tel:', '');
                break;
            
            case 'sms':
                const smsMatch = data.match(/sms:([^?]+)(\?body=(.+))?/);
                if (smsMatch) {
                    document.getElementById('smsNumber').value = smsMatch[1];
                    document.getElementById('smsMessage').value = smsMatch[3] ? decodeURIComponent(smsMatch[3]) : '';
                }
                break;
            
            case 'whatsapp':
                const waMatch = data.match(/https:\/\/wa\.me\/(\d+)(\?text=(.+))?/);
                if (waMatch) {
                    document.getElementById('whatsappNumber').value = '+' + waMatch[1];
                    document.getElementById('whatsappMessage').value = waMatch[3] ? decodeURIComponent(waMatch[3]) : '';
                }
                break;

            case 'youtube':
                document.getElementById('youtubeUrl').value = data;
                // Parse and show type indicator
                const ytData = this.qrGenerator.parseYouTubeURL(data);
                if (ytData && ytData.valid) {
                    this.updateYouTubeTypeIndicator(ytData);
                }
                break;

            case 'wifi':
                const wifiData = this.parseWifiString(data);
                document.getElementById('wifiSSID').value = wifiData.ssid || '';
                document.getElementById('wifiPassword').value = wifiData.password || '';
                document.getElementById('wifiSecurity').value = wifiData.security || 'WPA';
                document.getElementById('wifiHidden').checked = wifiData.hidden || false;
                break;
            
            case 'maps':
                document.getElementById('mapsLink').value = data;
                break;
            
            case 'vcard':
                const vcardData = this.parseVCardString(data);
                document.getElementById('vcardName').value = vcardData.name || '';
                document.getElementById('vcardMobile').value = vcardData.phone || '';
                document.getElementById('vcardEmail').value = vcardData.email || '';
                document.getElementById('vcardCompany').value = vcardData.org || '';
                document.getElementById('vcardJobTitle').value = vcardData.title || '';
                document.getElementById('vcardStreet').value = vcardData.street || '';
                document.getElementById('vcardCity').value = vcardData.city || '';
                document.getElementById('vcardZip').value = vcardData.zip || '';
                document.getElementById('vcardState').value = vcardData.state || '';
                document.getElementById('vcardCountry').value = vcardData.country || '';
                document.getElementById('vcardWebsite').value = vcardData.url || '';
                break;

            case 'event':
                const eventData = this.parseEventString(data);
                document.getElementById('eventName').value = eventData.name || '';
                document.getElementById('eventLocation').value = eventData.location || '';
                document.getElementById('eventStartDate').value = eventData.startDate || '';
                document.getElementById('eventEndDate').value = eventData.endDate || '';
                document.getElementById('eventDescription').value = eventData.description || '';
                document.getElementById('eventOrganizer').value = eventData.organizer || '';
                break;

            case 'upi':
                // Parse the UPI deep link URL
                const upiData = this.parseUpiUrl(data);
                document.getElementById('upiId').value = upiData.pa || '';
                document.getElementById('upiName').value = upiData.pn || '';
                document.getElementById('upiAmount').value = upiData.am || '';
                document.getElementById('upiNote').value = upiData.tn || '';
                break;

            case 'attendance':
                // Parse the attendance URL parameters
                const attendanceUrl = new URL(data);
                const attendanceUrlParams = new URLSearchParams(attendanceUrl.search);

                document.getElementById('attendanceLocation').value = attendanceUrlParams.get('loc') || '';
                document.getElementById('attendanceEvent').value = attendanceUrlParams.get('event') || '';
                document.getElementById('attendanceAskName').checked = attendanceUrlParams.get('askName') === 'true';

                // Set action type
                const attendanceAction = attendanceUrlParams.get('action');
                if (attendanceAction === 'check-in' || attendanceAction === 'check-out') {
                    document.querySelector(`input[name="attendanceAction"][value="${attendanceAction}"]`).checked = true;
                    document.getElementById('customActionRow').classList.add('hidden');
                } else {
                    document.querySelector('input[name="attendanceAction"][value="custom"]').checked = true;
                    document.getElementById('attendanceCustomAction').value = attendanceAction || '';
                    document.getElementById('customActionRow').classList.remove('hidden');
                }

                // Set contact method
                const attendanceContactMethod = attendanceUrlParams.get('contact');
                if (attendanceContactMethod) {
                    document.querySelector(`input[name="attendanceContact"][value="${attendanceContactMethod}"]`).checked = true;

                    if (attendanceContactMethod === 'whatsapp') {
                        document.getElementById('attendancePhone').value = attendanceUrlParams.get('phone') || '';
                        document.getElementById('attendancePhone').style.display = 'block';
                        document.getElementById('attendanceEmail').style.display = 'none';
                        document.getElementById('attendanceContactLabel').textContent = 'WhatsApp Number *';
                        document.getElementById('attendanceContactHint').textContent = 'Enter the WhatsApp number to receive attendance data.';
                    } else {
                        document.getElementById('attendanceEmail').value = attendanceUrlParams.get('email') || '';
                        document.getElementById('attendancePhone').style.display = 'none';
                        document.getElementById('attendanceEmail').style.display = 'block';
                        document.getElementById('attendanceContactLabel').textContent = 'Email Address *';
                        document.getElementById('attendanceContactHint').textContent = 'Enter the email address to receive attendance data.';
                    }
                }
                break;

            case 'file':
                // Display the file URL and metadata if available
                const fileDownloadUrl = document.getElementById('fileDownloadUrl');
                const uploadSuccessRow = document.getElementById('uploadSuccessRow');
                const uploadBtnText = document.getElementById('uploadBtnText');

                if (fileDownloadUrl) {
                    fileDownloadUrl.href = data;
                    fileDownloadUrl.textContent = data;
                }

                if (uploadSuccessRow) {
                    uploadSuccessRow.style.display = 'block';
                }

                if (uploadBtnText) {
                    uploadBtnText.textContent = 'Generate QR Code';
                }

                // Store the URL for re-generation
                this.fileUploadManager.uploadedFileUrl = data;

                // Note: Cannot restore actual file, only the URL
                this.uiController.showNotification('File URL restored. Original file cannot be restored.', 'info');
                break;

            case 'ar':
                // Parse AR viewer URL parameters
                try {
                    const url = new URL(data);
                    const params = new URLSearchParams(url.search);

                    const markerParam = params.get('marker');
                    const modelParam = params.get('model');
                    const titleParam = params.get('title');

                    // Restore marker type
                    if (markerParam === 'hiro' || markerParam === 'kanji') {
                        document.getElementById('arMarkerType').value = markerParam;
                    } else if (markerParam && markerParam.startsWith('http')) {
                        document.getElementById('arMarkerType').value = 'custom';
                        document.getElementById('arPatternUrl').value = markerParam;
                        document.getElementById('arMarkerType').dispatchEvent(new Event('change'));
                    } else {
                        document.getElementById('arMarkerType').value = 'hiro';
                    }

                    // Restore model URL
                    if (modelParam) {
                        document.getElementById('arModelUrl').value = modelParam;
                    }

                    // Restore experience name
                    if (titleParam) {
                        document.getElementById('arExperienceName').value = decodeURIComponent(titleParam);
                    } else {
                        document.getElementById('arExperienceName').value = '';
                    }
                } catch (e) {
                    console.error('Failed to parse AR URL:', e);
                }
                break;
        }
    }

    parseWifiString(wifiString) {
        const result = {};
        const matches = wifiString.match(/WIFI:T:([^;]+);S:([^;]+);(P:([^;]+);)?(H:([^;]+);)?/);
        
        if (matches) {
            result.security = matches[1];
            result.ssid = matches[2];
            result.password = matches[4] || '';
            result.hidden = matches[6] === 'true';
        }
        
        return result;
    }

    parseVCardString(vcardString) {
        const result = {};
        const lines = vcardString.split('\n');

        lines.forEach(line => {
            if (line.startsWith('FN:')) {
                result.name = line.substring(3);
            } else if (line.startsWith('TEL:')) {
                result.phone = line.substring(4);
            } else if (line.startsWith('EMAIL:')) {
                result.email = line.substring(6);
            } else if (line.startsWith('ORG:')) {
                result.org = line.substring(4);
            } else if (line.startsWith('TITLE:')) {
                result.title = line.substring(6);
            } else if (line.startsWith('URL:')) {
                result.url = line.substring(4);
            } else if (line.startsWith('ADR:')) {
                const addrParts = line.substring(4).split(';');
                if (addrParts.length >= 7) {
                    result.street = addrParts[2] || '';
                    result.city = addrParts[3] || '';
                    result.state = addrParts[4] || '';
                    result.zip = addrParts[5] || '';
                    result.country = addrParts[6] || '';
                }
            }
        });

        return result;
    }

    parseEventString(eventString) {
        const result = {};
        const lines = eventString.split('\n');

        lines.forEach(line => {
            if (line.startsWith('SUMMARY:')) {
                result.name = line.substring(8);
            } else if (line.startsWith('LOCATION:')) {
                result.location = line.substring(9);
            } else if (line.startsWith('DTSTART:')) {
                // Convert from UTC format to datetime-local format
                const dtstart = line.substring(8);
                result.startDate = this.convertToDateTimeLocal(dtstart);
            } else if (line.startsWith('DTEND:')) {
                // Convert from UTC format to datetime-local format
                const dtend = line.substring(6);
                result.endDate = this.convertToDateTimeLocal(dtend);
            } else if (line.startsWith('DESCRIPTION:')) {
                result.description = line.substring(12);
            } else if (line.startsWith('ORGANIZER:')) {
                result.organizer = line.substring(10);
            }
        });

        return result;
    }

    convertToDateTimeLocal(utcString) {
        // Convert YYYYMMDDTHHMMSSZ to YYYY-MM-DDTHH:MM format
        if (!utcString || utcString.length < 15) return '';

        const year = utcString.substring(0, 4);
        const month = utcString.substring(4, 6);
        const day = utcString.substring(6, 8);
        const hour = utcString.substring(9, 11);
        const minute = utcString.substring(11, 13);

        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    parseUpiUrl(upiUrl) {
        const result = {};

        // Extract parameters from UPI URL
        if (upiUrl && upiUrl.startsWith('upi://pay?')) {
            const params = new URLSearchParams(upiUrl.substring(10));

            result.pa = params.get('pa') ? decodeURIComponent(params.get('pa')) : '';
            result.pn = params.get('pn') ? decodeURIComponent(params.get('pn')) : '';
            result.am = params.get('am') || '';
            result.tn = params.get('tn') ? decodeURIComponent(params.get('tn')) : '';
        }

        return result;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diff / 86400000);
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            return date.toLocaleDateString();
        }
    }
    
    formatRelativeDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 5000) {
            return 'Just now';
        } else if (diff < 60000) {
            const seconds = Math.floor(diff / 1000);
            return `${seconds} sec ago`;
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} min ago`;
        } else if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (diff < 172800000) {
            return 'Yesterday';
        } else if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }
    
    updateSidebarActiveState(type) {
        const typeMenuItems = document.querySelectorAll('.type-menu-item');
        typeMenuItems.forEach(item => {
            if (item.getAttribute('data-type') === type) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    resetCustomizationOptions() {
        // Reset size to default
        document.getElementById('qrSize').value = '256';

        // Reset module shape to square
        document.getElementById('moduleShape').value = 'square';

        // Note: Colors are now handled by applyDefaultColors() method
        // which applies type-specific colors instead of always resetting to black/white

        // Reset margin to default
        document.getElementById('margin').value = '4';

        // Reset error correction to medium
        document.getElementById('errorCorrection').value = 'M';

        // Reset frame options
        document.getElementById('frameOption').value = 'none';
        document.getElementById('customFrameTextGroup').classList.add('hidden');
        document.getElementById('autoFrameOptions').classList.add('hidden');
        document.getElementById('customFrameText').value = '';
    }

    updateAutoFrameOptions() {
        const qrType = document.getElementById('qrType').value;
        const container = document.querySelector('.frame-options-container');

        // Define which types have dual options
        const dualOptionTypes = {
            'url': { generic: 'GO TO WEBSITE', contextual: 'Show URL' },
            'email': { generic: 'SEND EMAIL', contextual: 'Show Email Address' },
            'phone': { generic: 'CALL NUMBER', contextual: 'Show Phone Number' },
            'wifi': { generic: 'SHARE WIFI', contextual: 'Show Network Name' },
            'vcard': { generic: 'SAVE CONTACT', contextual: 'Show Contact Name' },
            'maps': { generic: 'VIEW LOCATION', contextual: 'Show Location Name' },
            'event': { generic: 'ADD TO CALENDAR', contextual: 'Show Event Name' },
            'youtube': { generic: 'WATCH ON YOUTUBE', contextual: 'Show Channel/Video Info' },
            'upi': { generic: 'PAY WITH UPI', contextual: 'Show Payee Name' },
            'attendance': { generic: 'CHECK IN', contextual: 'Show Location' },
            'file': { generic: 'DOWNLOAD FILE', contextual: 'Show Filename' },
            'ar': { generic: 'VIEW IN AR', contextual: 'Show Experience Name' }
        };
        
        const singleOptionTypes = {
            'text': 'SCAN ME',
            'sms': 'SEND SMS',
            'whatsapp': 'SEND WHATSAPP'
        };
        
        // Clear existing options
        container.innerHTML = '';
        
        if (dualOptionTypes[qrType]) {
            // Create two option cards
            const options = dualOptionTypes[qrType];
            
            container.innerHTML = `
                <div class="frame-option-cards">
                    <label class="frame-option-card">
                        <input type="radio" name="autoFrameType" value="generic" checked>
                        <div class="card-content">
                            <div class="card-title">${options.generic}</div>
                            <div class="card-description">Standard frame text</div>
                        </div>
                    </label>
                    <label class="frame-option-card">
                        <input type="radio" name="autoFrameType" value="contextual">
                        <div class="card-content">
                            <div class="card-title">${options.contextual}</div>
                            <div class="card-description">Display actual data</div>
                        </div>
                    </label>
                </div>
            `;
        } else if (singleOptionTypes[qrType]) {
            // Create single option card (auto-selected)
            container.innerHTML = `
                <div class="frame-option-cards single">
                    <label class="frame-option-card selected">
                        <input type="radio" name="autoFrameType" value="generic" checked style="display: none;">
                        <div class="card-content">
                            <div class="card-title">${singleOptionTypes[qrType]}</div>
                            <div class="card-description">Standard frame text</div>
                        </div>
                    </label>
                </div>
            `;
        }
    }

    updateYouTubeTypeIndicator(ytData) {
        const indicator = document.getElementById('youtubeTypeIndicator');
        const valueSpan = document.getElementById('youtubeTypeValue');

        if (ytData && ytData.type) {
            indicator.style.display = 'block';

            const typeLabels = {
                'channel': 'YouTube Channel',
                'video': 'YouTube Video',
                'shorts': 'YouTube Short',
                'playlist': 'YouTube Playlist'
            };

            valueSpan.textContent = typeLabels[ytData.type] || ytData.type;
        } else {
            indicator.style.display = 'none';
        }
    }

    applyDefaultColors(type) {
        const colors = QR_TYPE_COLORS[type];
        if (colors) {
            // Update color picker values
            document.getElementById('colorDark').value = colors.dark;
            document.getElementById('colorLight').value = colors.light;

            // Update hex input values
            document.getElementById('colorDarkHex').value = colors.dark;
            document.getElementById('colorLightHex').value = colors.light;

            // Dispatch input events to update any visual feedback
            document.getElementById('colorDark').dispatchEvent(new Event('input'));
            document.getElementById('colorLight').dispatchEvent(new Event('input'));
        }
    }

    handleAttendanceMode() {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get('attendance') === '1') {
            // Attendance mode detected
            const attendanceData = {
                location: urlParams.get('loc'),
                action: urlParams.get('action'),
                event: urlParams.get('event'),
                askName: urlParams.get('askName') === 'true',
                contact: urlParams.get('contact'),
                phone: urlParams.get('phone'),
                email: urlParams.get('email')
            };

            // Show attendance processing UI
            this.showAttendanceUI(attendanceData);
        }
    }

    async showAttendanceUI(data) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'attendance-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'attendance-modal';
        modal.style.cssText = `
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 2rem;
            border-radius: 12px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        modal.innerHTML = `
            <h2 style="margin-top: 0;">Attendance Check-In</h2>
            <p><strong>Location:</strong> ${data.location || 'Unknown'}</p>
            <p><strong>Action:</strong> ${data.action || 'check-in'}</p>
            ${data.event ? `<p><strong>Event:</strong> ${data.event}</p>` : ''}

            ${data.askName ? `
                <div style="margin: 1.5rem 0;">
                    <label for="attendeeName" style="display: block; margin-bottom: 0.5rem;">Your Name:</label>
                    <input type="text" id="attendeeName" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary);" placeholder="Enter your name">
                </div>
            ` : ''}

            <div id="locationStatus" style="margin: 1rem 0; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                <p style="margin: 0;">Requesting location permission...</p>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <button id="submitAttendance" style="flex: 1; padding: 0.75rem; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Submit Attendance</button>
                <button id="cancelAttendance" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; font-weight: 600; cursor: pointer;">Cancel</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Get location
        let coordinates = null;
        const locationStatus = modal.querySelector('#locationStatus');

        // Check if we're on HTTPS (required for geolocation)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            locationStatus.innerHTML = `
                <p style="margin: 0; color: var(--warning-color);">⚠ Location requires HTTPS</p>
                <p style="margin: 0; font-size: 0.9em; opacity: 0.8;">Location tracking is disabled on non-secure connections.</p>
            `;
        } else {
            try {
                const position = await this.getCurrentPosition();
                coordinates = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                locationStatus.innerHTML = `<p style="margin: 0; color: var(--success-color);">✓ Location obtained</p>`;
            } catch (error) {
                let errorMessage = '⚠ Location access denied or unavailable';
                let errorDetail = '';

                // Provide specific error messages
                if (error.code === 1) {
                    errorMessage = '⚠ Location access denied';
                    errorDetail = 'Please allow location access and try again.';
                } else if (error.code === 2) {
                    errorMessage = '⚠ Location unavailable';
                    errorDetail = 'Unable to determine your location.';
                } else if (error.code === 3) {
                    errorMessage = '⚠ Location request timeout';
                    errorDetail = 'Location request took too long.';
                } else if (!navigator.geolocation) {
                    errorMessage = '⚠ Location not supported';
                    errorDetail = 'Your browser does not support location services.';
                }

                locationStatus.innerHTML = `
                    <p style="margin: 0; color: var(--error-color);">${errorMessage}</p>
                    ${errorDetail ? `<p style="margin: 0; font-size: 0.9em; opacity: 0.8;">${errorDetail}</p>` : ''}
                `;
            }
        }

        // Handle submit
        modal.querySelector('#submitAttendance').addEventListener('click', () => {
            const attendeeName = data.askName ? modal.querySelector('#attendeeName').value.trim() : '';

            if (data.askName && !attendeeName) {
                this.uiController.showNotification('Please enter your name', 'error');
                return;
            }

            // Format attendance message
            const timestamp = new Date().toLocaleString();
            let message = `Attendance Report\n`;
            message += `================\n`;
            message += `Action: ${data.action || 'check-in'}\n`;
            message += `Location: ${data.location || 'Unknown'}\n`;
            if (data.event) message += `Event: ${data.event}\n`;
            if (attendeeName) message += `Name: ${attendeeName}\n`;
            message += `Time: ${timestamp}\n`;
            if (coordinates) {
                message += `Coordinates: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}\n`;
                message += `Map: https://maps.google.com/?q=${coordinates.latitude},${coordinates.longitude}\n`;
            }

            // Send via WhatsApp or Email
            if (data.contact === 'whatsapp' && data.phone) {
                const cleanPhone = data.phone.replace(/[^\d]/g, '');
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                window.open(waUrl, '_blank');
            } else if (data.contact === 'email' && data.email) {
                const subject = `Attendance: ${data.action} at ${data.location}`;
                const mailtoUrl = `mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
                window.location.href = mailtoUrl;
            }

            // Remove overlay
            document.body.removeChild(overlay);
            this.uiController.showNotification('Attendance submitted successfully!', 'success');
        });

        // Handle cancel
        modal.querySelector('#cancelAttendance').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => resolve(position),
                error => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QRCodeApp();
});