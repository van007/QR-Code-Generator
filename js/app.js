import { QRGenerator } from './qrGenerator.js';
import { UIController } from './uiController.js';
import { DownloadManager } from './downloadManager.js';
import { HistoryManager } from './historyManager.js';
import { ThemeManager } from './themeManager.js';
import { InstallPromptManager } from './installPrompt.js';

class QRCodeApp {
    constructor() {
        this.qrGenerator = new QRGenerator();
        this.uiController = new UIController();
        this.downloadManager = new DownloadManager();
        this.historyManager = new HistoryManager();
        this.themeManager = new ThemeManager();
        this.installPromptManager = new InstallPromptManager();
        
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
            qrType: type
        };
        
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
        
        // Reset colors to default
        document.getElementById('colorDark').value = '#000000';
        document.getElementById('colorDarkHex').value = '#000000';
        document.getElementById('colorLight').value = '#ffffff';
        document.getElementById('colorLightHex').value = '#ffffff';
        
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
            'maps': { generic: 'VIEW LOCATION', contextual: 'Show Location Name' }
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
}

document.addEventListener('DOMContentLoaded', () => {
    new QRCodeApp();
});