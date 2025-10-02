export class QRGenerator {
    constructor() {
        this.qrcode = null;
    }

    generate(data, options) {
        const container = document.getElementById('qrcode');
        
        container.innerHTML = '';
        
        // Calculate actual size with margins
        const marginPixels = (options.margin || 0) * 8; // Convert module units to pixels
        const qrSize = options.width || 256;
        const totalSize = qrSize + (marginPixels * 2);
        
        const defaultOptions = {
            text: data,
            width: qrSize,
            height: qrSize,
            colorDark: options.colorDark || '#000000',
            colorLight: options.colorLight || '#ffffff',
            correctLevel: options.correctLevel || QRCode.CorrectLevel.M
        };
        
        // Create a temporary container for QR generation
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);
        
        this.qrcode = new QRCode(tempDiv, defaultOptions);
        
        // Return a promise to ensure shape application completes
        return new Promise((resolve) => {
            setTimeout(() => {
                const tempCanvas = tempDiv.querySelector('canvas');
                const tempImg = tempDiv.querySelector('img');
                
                if (!tempCanvas && !tempImg) {
                    document.body.removeChild(tempDiv);
                    resolve({ data, options, element: null });
                    return;
                }
                
                // Create final canvas with margins
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = totalSize;
                finalCanvas.height = totalSize;
                const ctx = finalCanvas.getContext('2d');
                
                // Fill background with light color
                ctx.fillStyle = options.colorLight || '#ffffff';
                ctx.fillRect(0, 0, totalSize, totalSize);
                
                // Draw QR code centered with margins
                if (tempCanvas) {
                    // Apply module shape if needed
                    if (options.moduleShape && options.moduleShape !== 'square') {
                        this.applyModuleShape(tempCanvas, options.moduleShape, options.colorDark, options.colorLight);
                    }
                    ctx.drawImage(tempCanvas, marginPixels, marginPixels, qrSize, qrSize);
                } else if (tempImg) {
                    // Wait for image to load
                    if (tempImg.complete) {
                        ctx.drawImage(tempImg, marginPixels, marginPixels, qrSize, qrSize);
                    } else {
                        tempImg.onload = () => {
                            ctx.drawImage(tempImg, marginPixels, marginPixels, qrSize, qrSize);
                        };
                    }
                }
                
                // Clean up temp container
                document.body.removeChild(tempDiv);
                
                // Apply frame if specified
                if (options.frameOption && options.frameOption !== 'none') {
                    // Pass the QR data to the frame function for contextual text
                    const frameOptions = { ...options, qrData: data };
                    this.applyFrame(finalCanvas, frameOptions);
                }
                
                // Add final canvas to container
                container.appendChild(finalCanvas);
                
                // Store margin info for download manager
                finalCanvas.dataset.margin = marginPixels;
                finalCanvas.dataset.qrSize = qrSize;
                
                resolve({
                    data,
                    options,
                    element: finalCanvas,
                    margin: marginPixels
                });
            }, 250);
        });
    }

    validateData(data) {
        if (!data || data.trim() === '') {
            throw new Error('Data cannot be empty');
        }
        
        if (data.length > 2953) {
            throw new Error('Data is too long for QR code');
        }
        
        return true;
    }

    getOptimalErrorCorrection(data) {
        const length = data.length;
        
        if (length < 100) {
            return QRCode.CorrectLevel.H;
        } else if (length < 500) {
            return QRCode.CorrectLevel.Q;
        } else if (length < 1000) {
            return QRCode.CorrectLevel.M;
        } else {
            return QRCode.CorrectLevel.L;
        }
    }

    generateBatch(dataArray, options) {
        const results = [];
        
        dataArray.forEach((data, index) => {
            try {
                const qr = this.generate(data, {
                    ...options,
                    containerId: `qr-batch-${index}`
                });
                results.push({ success: true, qr });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        });
        
        return results;
    }

    generateWithLogo(data, options, logoUrl) {
        return new Promise((resolve, reject) => {
            const qr = this.generate(data, options);
            const canvas = qr.element;
            
            if (canvas && canvas.tagName === 'CANVAS') {
                const ctx = canvas.getContext('2d');
                const logo = new Image();
                
                logo.onload = () => {
                    const logoSize = canvas.width * 0.2;
                    const logoX = (canvas.width - logoSize) / 2;
                    const logoY = (canvas.height - logoSize) / 2;
                    
                    ctx.fillStyle = options.colorLight || '#ffffff';
                    ctx.fillRect(logoX - 5, logoY - 5, logoSize + 10, logoSize + 10);
                    
                    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
                    resolve(qr);
                };
                
                logo.onerror = () => {
                    reject(new Error('Failed to load logo'));
                };
                
                logo.src = logoUrl;
            } else {
                reject(new Error('Canvas element not found'));
            }
        });
    }

    generateVCard(contact) {
        let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
        
        if (contact.name) {
            vcard += `FN:${contact.name}\n`;
        }
        if (contact.org) {
            vcard += `ORG:${contact.org}\n`;
        }
        if (contact.title) {
            vcard += `TITLE:${contact.title}\n`;
        }
        if (contact.phone) {
            vcard += `TEL:${contact.phone}\n`;
        }
        if (contact.email) {
            vcard += `EMAIL:${contact.email}\n`;
        }
        if (contact.url) {
            vcard += `URL:${contact.url}\n`;
        }
        
        const hasAddress = contact.street || contact.city || contact.state || contact.zip || contact.country;
        if (hasAddress) {
            const street = contact.street || '';
            const city = contact.city || '';
            const state = contact.state || '';
            const zip = contact.zip || '';
            const country = contact.country || '';
            vcard += `ADR:;;${street};${city};${state};${zip};${country}\n`;
        }
        
        vcard += 'END:VCARD';
        
        return vcard;
    }

    generateVEvent(event) {
        let vevent = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n';

        if (event.name) {
            vevent += `SUMMARY:${event.name}\n`;
        }

        if (event.location) {
            vevent += `LOCATION:${event.location}\n`;
        }

        // Convert datetime-local to UTC format (YYYYMMDDTHHMMSSZ)
        if (event.startDate) {
            const startDateTime = this.convertToUTCFormat(event.startDate);
            vevent += `DTSTART:${startDateTime}\n`;
        }

        if (event.endDate) {
            const endDateTime = this.convertToUTCFormat(event.endDate);
            vevent += `DTEND:${endDateTime}\n`;
        }

        if (event.description) {
            vevent += `DESCRIPTION:${event.description}\n`;
        }

        if (event.organizer) {
            vevent += `ORGANIZER:${event.organizer}\n`;
        }

        vevent += 'END:VEVENT\nEND:VCALENDAR';

        return vevent;
    }

    convertToUTCFormat(dateTimeLocal) {
        // Convert YYYY-MM-DDTHH:MM to YYYYMMDDTHHMMSSZ format
        const date = new Date(dateTimeLocal);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}${month}${day}T${hours}${minutes}00Z`;
    }

    generateGeoLocation(latitude, longitude) {
        return `geo:${latitude},${longitude}`;
    }

    generateCrypto(address, amount, label) {
        let cryptoString = `bitcoin:${address}`;
        const params = [];
        
        if (amount) {
            params.push(`amount=${amount}`);
        }
        if (label) {
            params.push(`label=${encodeURIComponent(label)}`);
        }
        
        if (params.length > 0) {
            cryptoString += '?' + params.join('&');
        }
        
        return cryptoString;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    isModulePixel(data, idx, colorDarkRgb, colorLightRgb) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Calculate distance to both colors
        const distToDark = Math.sqrt(
            Math.pow(r - colorDarkRgb.r, 2) +
            Math.pow(g - colorDarkRgb.g, 2) +
            Math.pow(b - colorDarkRgb.b, 2)
        );
        
        const distToLight = Math.sqrt(
            Math.pow(r - colorLightRgb.r, 2) +
            Math.pow(g - colorLightRgb.g, 2) +
            Math.pow(b - colorLightRgb.b, 2)
        );
        
        // Pixel is a module if it's closer to dark color than light color
        return distToDark < distToLight;
    }

    parseYouTubeURL(url) {
        if (!url) return null;

        // Normalize URL
        url = url.trim();
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        // Replace mobile URLs with standard URLs
        url = url.replace('m.youtube.com', 'www.youtube.com');
        url = url.replace('music.youtube.com', 'www.youtube.com');

        const result = {
            valid: false,
            type: null,
            id: null,
            normalizedUrl: url,
            channelName: null,
            metadata: {}
        };

        try {
            const urlObj = new URL(url);

            // Check if it's a YouTube URL
            if (!urlObj.hostname.includes('youtube.com') && !urlObj.hostname.includes('youtu.be')) {
                return result;
            }

            // Channel URLs
            if (urlObj.pathname.startsWith('/@')) {
                result.valid = true;
                result.type = 'channel';
                result.channelName = urlObj.pathname.substring(2);
                result.normalizedUrl = `https://www.youtube.com/@${result.channelName}`;
            } else if (urlObj.pathname.startsWith('/c/')) {
                result.valid = true;
                result.type = 'channel';
                result.channelName = urlObj.pathname.substring(3);
                result.normalizedUrl = `https://www.youtube.com/c/${result.channelName}`;
            } else if (urlObj.pathname.startsWith('/channel/')) {
                result.valid = true;
                result.type = 'channel';
                result.id = urlObj.pathname.substring(9);
                result.normalizedUrl = `https://www.youtube.com/channel/${result.id}`;
            } else if (urlObj.pathname.startsWith('/user/')) {
                result.valid = true;
                result.type = 'channel';
                result.channelName = urlObj.pathname.substring(6);
                result.normalizedUrl = `https://www.youtube.com/user/${result.channelName}`;
            }
            // Video URLs
            else if (urlObj.pathname === '/watch') {
                const videoId = urlObj.searchParams.get('v');
                if (videoId) {
                    result.valid = true;
                    result.type = 'video';
                    result.id = videoId;
                    result.normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

                    // Preserve timestamp if present
                    const time = urlObj.searchParams.get('t');
                    if (time) {
                        result.normalizedUrl += `&t=${time}`;
                        result.metadata.timestamp = time;
                    }
                }
            }
            // Short URLs (youtu.be)
            else if (urlObj.hostname === 'youtu.be') {
                const videoId = urlObj.pathname.substring(1);
                if (videoId) {
                    result.valid = true;
                    result.type = 'video';
                    result.id = videoId;
                    result.normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

                    // Preserve timestamp if present
                    const time = urlObj.searchParams.get('t');
                    if (time) {
                        result.normalizedUrl += `&t=${time}`;
                        result.metadata.timestamp = time;
                    }
                }
            }
            // Shorts URLs
            else if (urlObj.pathname.startsWith('/shorts/')) {
                const shortId = urlObj.pathname.substring(8);
                if (shortId) {
                    result.valid = true;
                    result.type = 'shorts';
                    result.id = shortId;
                    result.normalizedUrl = `https://www.youtube.com/shorts/${shortId}`;
                }
            }
            // Playlist URLs
            else if (urlObj.pathname === '/playlist') {
                const listId = urlObj.searchParams.get('list');
                if (listId) {
                    result.valid = true;
                    result.type = 'playlist';
                    result.id = listId;
                    result.normalizedUrl = `https://www.youtube.com/playlist?list=${listId}`;
                }
            }

            return result;
        } catch (e) {
            return result;
        }
    }

    applyModuleShape(canvas, shape, colorDark, colorLight) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Convert colors to RGB for comparison
        const colorDarkRgb = this.hexToRgb(colorDark);
        const colorLightRgb = this.hexToRgb(colorLight);
        
        if (!colorDarkRgb || !colorLightRgb) {
            console.error('Invalid color values');
            return;
        }
        
        // Detect module size by finding the first module pixel
        let moduleSize = 0;
        let startX = 0;
        let startY = 0;
        let foundModule = false;
        
        // Find first module pixel (top-left finder pattern)
        outer: for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (this.isModulePixel(data, idx, colorDarkRgb, colorLightRgb)) {
                    startX = x;
                    startY = y;
                    foundModule = true;
                    break outer;
                }
            }
        }
        
        if (!foundModule) {
            console.error('Could not find QR modules');
            return;
        }
        
        // Measure module size by counting consecutive module pixels
        for (let x = startX; x < canvas.width; x++) {
            const idx = (startY * canvas.width + x) * 4;
            if (this.isModulePixel(data, idx, colorDarkRgb, colorLightRgb)) {
                moduleSize++;
            } else {
                break;
            }
        }
        
        // Finder pattern is 7 modules wide, so divide by 7
        moduleSize = Math.max(1, moduleSize / 7);
        
        const moduleCount = Math.round(canvas.width / moduleSize);
        
        const newCanvas = document.createElement('canvas');
        newCanvas.width = canvas.width;
        newCanvas.height = canvas.height;
        const newCtx = newCanvas.getContext('2d');
        
        newCtx.fillStyle = colorLight;
        newCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        newCtx.fillStyle = colorDark;
        
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                const x = Math.round(col * moduleSize);
                const y = Math.round(row * moduleSize);
                
                // Sample center of module
                const sampleX = Math.min(Math.floor(x + moduleSize/2), canvas.width - 1);
                const sampleY = Math.min(Math.floor(y + moduleSize/2), canvas.height - 1);
                const pixelIndex = (sampleY * canvas.width + sampleX) * 4;
                
                if (this.isModulePixel(data, pixelIndex, colorDarkRgb, colorLightRgb)) {
                    this.drawModule(newCtx, x, y, moduleSize, shape);
                }
            }
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(newCanvas, 0, 0);
    }

    drawModule(ctx, x, y, size, shape) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        
        switch (shape) {
            case 'rounded':
                const radius = size * 0.15;
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.arcTo(x + size, y, x + size, y + size, radius);
                ctx.arcTo(x + size, y + size, x, y + size, radius);
                ctx.arcTo(x, y + size, x, y, radius);
                ctx.arcTo(x, y, x + size, y, radius);
                ctx.fill();
                break;
                
            case 'circle':
                ctx.beginPath();
                ctx.arc(centerX, centerY, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(centerX, y + size * 0.1);
                ctx.lineTo(x + size * 0.9, centerY);
                ctx.lineTo(centerX, y + size * 0.9);
                ctx.lineTo(x + size * 0.1, centerY);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'dots':
                ctx.beginPath();
                ctx.arc(centerX, centerY, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            default:
                ctx.fillRect(x, y, size, size);
        }
    }

    applyFrame(canvas, options) {
        const frameWidth = Math.max(3, Math.floor(canvas.width * 0.02)); // Frame border width
        const frameMargin = Math.max(15, Math.floor(canvas.width * 0.04)); // Space between QR and frame
        const textHeight = Math.max(18, Math.floor(canvas.width * 0.06)); // Text size
        const textAreaHeight = Math.max(40, Math.floor(canvas.width * 0.12)); // Text area height
        
        // Determine frame text
        let frameText = '';
        if (options.frameOption === 'auto') {
            const autoFrameType = options.autoFrameType || 'generic';
            
            if (autoFrameType === 'contextual') {
                // Extract contextual data based on QR type
                frameText = this.extractContextualData(options.qrData || '', options.qrType, options);
            } else {
                // Use generic text
                const frameTextMap = {
                    'text': 'SCAN ME',
                    'url': 'GO TO WEBSITE',
                    'email': 'SEND EMAIL',
                    'phone': 'CALL NUMBER',
                    'sms': 'SEND SMS',
                    'whatsapp': 'SEND WHATSAPP',
                    'youtube': 'WATCH ON YOUTUBE',
                    'wifi': 'SHARE WIFI',
                    'vcard': 'SAVE CONTACT',
                    'maps': 'VIEW LOCATION',
                    'event': 'ADD TO CALENDAR',
                    'upi': 'PAY WITH UPI',
                    'attendance': 'CHECK IN',
                    'file': 'DOWNLOAD FILE',
                    'ar': 'VIEW IN AR'
                };
                frameText = frameTextMap[options.qrType] || 'SCAN ME';
            }
        } else if (options.frameOption === 'custom') {
            frameText = options.customFrameText || 'SCAN ME';
        }
        
        if (!frameText) return;
        
        // Create new canvas with frame
        const newCanvas = document.createElement('canvas');
        const totalFrameSpace = frameMargin * 2 + frameWidth * 2;
        newCanvas.width = canvas.width + totalFrameSpace;
        newCanvas.height = canvas.height + totalFrameSpace + textAreaHeight;
        const newCtx = newCanvas.getContext('2d');
        
        // Fill entire background with light color
        newCtx.fillStyle = options.colorLight || '#ffffff';
        newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        
        // Draw frame border with rounded corners
        const borderRadius = Math.min(15, newCanvas.width * 0.025);
        newCtx.fillStyle = options.colorDark || '#000000';
        
        // Create path for rounded rectangle frame
        newCtx.beginPath();
        newCtx.moveTo(borderRadius, 0);
        newCtx.lineTo(newCanvas.width - borderRadius, 0);
        newCtx.arcTo(newCanvas.width, 0, newCanvas.width, borderRadius, borderRadius);
        newCtx.lineTo(newCanvas.width, newCanvas.height - borderRadius);
        newCtx.arcTo(newCanvas.width, newCanvas.height, newCanvas.width - borderRadius, newCanvas.height, borderRadius);
        newCtx.lineTo(borderRadius, newCanvas.height);
        newCtx.arcTo(0, newCanvas.height, 0, newCanvas.height - borderRadius, borderRadius);
        newCtx.lineTo(0, borderRadius);
        newCtx.arcTo(0, 0, borderRadius, 0, borderRadius);
        newCtx.closePath();
        newCtx.fill();
        
        // Create inner white area for QR code (with rounded corners)
        const innerX = frameWidth;
        const innerY = frameWidth;
        const innerWidth = newCanvas.width - frameWidth * 2;
        const innerHeight = newCanvas.height - frameWidth * 2 - textAreaHeight;
        const innerRadius = Math.max(0, borderRadius - frameWidth);
        
        newCtx.fillStyle = options.colorLight || '#ffffff';
        newCtx.beginPath();
        newCtx.moveTo(innerX + innerRadius, innerY);
        newCtx.lineTo(innerX + innerWidth - innerRadius, innerY);
        newCtx.arcTo(innerX + innerWidth, innerY, innerX + innerWidth, innerY + innerRadius, innerRadius);
        newCtx.lineTo(innerX + innerWidth, innerY + innerHeight - innerRadius);
        newCtx.arcTo(innerX + innerWidth, innerY + innerHeight, innerX + innerWidth - innerRadius, innerY + innerHeight, innerRadius);
        newCtx.lineTo(innerX + innerRadius, innerY + innerHeight);
        newCtx.arcTo(innerX, innerY + innerHeight, innerX, innerY + innerHeight - innerRadius, innerRadius);
        newCtx.lineTo(innerX, innerY + innerRadius);
        newCtx.arcTo(innerX, innerY, innerX + innerRadius, innerY, innerRadius);
        newCtx.closePath();
        newCtx.fill();
        
        // Draw original QR code centered in the white area
        const qrX = frameMargin + frameWidth;
        const qrY = frameMargin + frameWidth;
        newCtx.drawImage(canvas, qrX, qrY);
        
        // Draw text on the dark background at bottom
        newCtx.fillStyle = options.colorLight || '#ffffff';
        newCtx.font = `bold ${textHeight}px 'JetBrains Mono', monospace`;
        newCtx.textAlign = 'center';
        newCtx.textBaseline = 'middle';
        const textY = newCanvas.height - textAreaHeight / 2;
        newCtx.fillText(frameText, newCanvas.width / 2, textY);
        
        // Replace original canvas content with framed version
        canvas.width = newCanvas.width;
        canvas.height = newCanvas.height;
        const originalCtx = canvas.getContext('2d');
        originalCtx.drawImage(newCanvas, 0, 0);
        
        // Update dataset for proper export handling
        canvas.dataset.hasFrame = 'true';
        canvas.dataset.frameText = frameText;
    }

    extractContextualData(data, qrType, options = {}) {
        try {
            switch (qrType) {
                case 'url':
                    // Return the URL as is, truncate if too long
                    return this.truncateText(data, 30);
                    
                case 'email':
                    // Extract email from mailto: format
                    if (data.startsWith('mailto:')) {
                        const email = data.substring(7).split('?')[0];
                        return this.truncateText(email, 30);
                    }
                    return this.truncateText(data, 30);
                    
                case 'phone':
                    // Extract phone number from tel: format
                    if (data.startsWith('tel:')) {
                        return data.substring(4);
                    }
                    return data;
                    
                case 'wifi':
                    // Parse WiFi format: WIFI:T:WPA;S:NetworkName;P:password;;
                    const ssidMatch = data.match(/S:([^;]+)/);
                    if (ssidMatch && ssidMatch[1]) {
                        return this.truncateText(ssidMatch[1], 30);
                    }
                    return 'SHARE WIFI';
                    
                case 'vcard':
                    // Parse vCard format to extract name
                    const nameMatch = data.match(/FN:([^\n\r]+)/);
                    if (nameMatch && nameMatch[1]) {
                        return this.truncateText(nameMatch[1], 30);
                    }
                    return 'SAVE CONTACT';
                    
                case 'maps':
                    // Try to extract location name from map URLs
                    
                    // Google Maps full URL: look for /place/[name]/ pattern
                    const googlePlaceMatch = data.match(/\/place\/([^\/]+)\//);
                    if (googlePlaceMatch && googlePlaceMatch[1]) {
                        // Decode and clean up the place name
                        const placeName = decodeURIComponent(googlePlaceMatch[1]).replace(/\+/g, ' ');
                        return this.truncateText(placeName, 30);
                    }
                    
                    // Apple Maps: look for 'name=' parameter
                    const appleNameMatch = data.match(/name=([^&]+)/);
                    if (appleNameMatch && appleNameMatch[1]) {
                        const decodedName = decodeURIComponent(appleNameMatch[1]).replace(/\+/g, ' ');
                        return this.truncateText(decodedName, 30);
                    }
                    
                    // Apple Maps: look for 'address=' parameter as fallback
                    const appleAddressMatch = data.match(/address=([^&]+)/);
                    if (appleAddressMatch && appleAddressMatch[1]) {
                        const decodedAddress = decodeURIComponent(appleAddressMatch[1]).replace(/\+/g, ' ');
                        // Take first part of address for brevity
                        const firstPart = decodedAddress.split(',')[0];
                        return this.truncateText(firstPart, 30);
                    }
                    
                    // For shortened URLs or when name cannot be extracted, show generic text
                    return 'VIEW LOCATION';

                case 'event':
                    // Parse vCalendar format to extract event name
                    const summaryMatch = data.match(/SUMMARY:([^\n\r]+)/);
                    if (summaryMatch && summaryMatch[1]) {
                        return this.truncateText(summaryMatch[1], 30);
                    }
                    return 'ADD TO CALENDAR';

                case 'youtube':
                    // Parse YouTube URL to extract contextual information
                    const ytData = this.parseYouTubeURL(data);
                    if (ytData && ytData.valid) {
                        if (ytData.type === 'channel' && ytData.channelName) {
                            // For channels, show the channel name
                            return this.truncateText(`@${ytData.channelName}`, 30);
                        } else if (ytData.type === 'video' && ytData.id) {
                            // For videos, show video ID (could be enhanced to fetch title)
                            return this.truncateText(`Video: ${ytData.id}`, 30);
                        } else if (ytData.type === 'shorts' && ytData.id) {
                            // For shorts, indicate it's a short
                            return 'YouTube Short';
                        } else if (ytData.type === 'playlist' && ytData.id) {
                            // For playlists, show playlist indicator
                            return this.truncateText(`Playlist: ${ytData.id}`, 30);
                        }
                    }
                    return 'WATCH ON YOUTUBE';

                case 'upi':
                    // Extract payee name from UPI URL
                    if (data.startsWith('upi://pay?')) {
                        const params = new URLSearchParams(data.substring(10));
                        const payeeName = params.get('pn');
                        if (payeeName) {
                            return this.truncateText(decodeURIComponent(payeeName), 30);
                        }
                    }
                    return 'PAY WITH UPI';

                case 'attendance':
                    // Extract location from attendance URL
                    try {
                        const url = new URL(data);
                        const params = new URLSearchParams(url.search);
                        const location = params.get('loc');
                        if (location) {
                            return this.truncateText(decodeURIComponent(location), 30);
                        }
                    } catch (e) {
                        // URL parsing failed
                    }
                    return 'CHECK IN';

                case 'file':
                    // Use file metadata if available
                    if (options && options.fileMetadata && options.fileMetadata.fileName) {
                        return this.truncateText(options.fileMetadata.fileName, 30);
                    }
                    // Try to extract filename from gofile.io URL
                    const fileMatch = data.match(/gofile\.io\/d\/([A-Za-z0-9]+)/);
                    if (fileMatch) {
                        return `File: ${fileMatch[1]}`;
                    }
                    return 'DOWNLOAD FILE';

                case 'ar':
                    // Check if experience name is provided in options
                    if (options && options.arExperienceName) {
                        return this.truncateText(options.arExperienceName, 30);
                    }

                    // Try to extract meaningful info from URL
                    try {
                        const url = new URL(data);

                        // 8th Wall - extract project/experience name
                        if (url.hostname.includes('8thwall.app')) {
                            const pathParts = url.pathname.split('/').filter(p => p);
                            if (pathParts.length > 0) {
                                // Use last path segment as experience name
                                return this.truncateText(pathParts[pathParts.length - 1].replace(/-/g, ' '), 30);
                            }
                        }

                        // AR.js or generic - try to extract filename
                        if (data.includes('.patt')) {
                            const filename = url.pathname.split('/').pop();
                            if (filename) {
                                return this.truncateText(filename.replace('.patt', ''), 30);
                            }
                        } else if (data.includes('.glb') || data.includes('.gltf')) {
                            const filename = url.pathname.split('/').pop();
                            if (filename) {
                                return this.truncateText(filename.replace(/\.(glb|gltf)$/, ''), 30);
                            }
                        }

                        // Fallback to hostname if nothing else works
                        if (url.hostname && url.hostname !== 'localhost') {
                            return this.truncateText(url.hostname, 30);
                        }
                    } catch (e) {
                        // URL parsing failed
                    }

                    return 'VIEW IN AR';

                default:
                    // Return generic text for other types
                    return 'SCAN ME';
            }
        } catch (error) {
            console.error('Error extracting contextual data:', error);
            // Fallback to generic text
            const fallbackMap = {
                'url': 'GO TO WEBSITE',
                'email': 'SEND EMAIL',
                'phone': 'CALL NUMBER',
                'wifi': 'SHARE WIFI',
                'vcard': 'SAVE CONTACT',
                'maps': 'VIEW LOCATION',
                'event': 'ADD TO CALENDAR',
                'youtube': 'WATCH ON YOUTUBE',
                'upi': 'PAY WITH UPI',
                'attendance': 'CHECK IN',
                'file': 'DOWNLOAD FILE',
                'ar': 'VIEW IN AR'
            };
            return fallbackMap[qrType] || 'SCAN ME';
        }
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }
}