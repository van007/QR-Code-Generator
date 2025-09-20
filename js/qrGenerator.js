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

    generateEvent(event) {
        let eventString = 'BEGIN:VEVENT\n';
        
        if (event.summary) {
            eventString += `SUMMARY:${event.summary}\n`;
        }
        if (event.location) {
            eventString += `LOCATION:${event.location}\n`;
        }
        if (event.startDate) {
            const start = new Date(event.startDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            eventString += `DTSTART:${start}\n`;
        }
        if (event.endDate) {
            const end = new Date(event.endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            eventString += `DTEND:${end}\n`;
        }
        if (event.description) {
            eventString += `DESCRIPTION:${event.description}\n`;
        }
        
        eventString += 'END:VEVENT';
        
        return eventString;
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
                frameText = this.extractContextualData(options.qrData || '', options.qrType);
            } else {
                // Use generic text
                const frameTextMap = {
                    'text': 'SCAN ME',
                    'url': 'GO TO WEBSITE',
                    'email': 'SEND EMAIL',
                    'phone': 'CALL NUMBER',
                    'sms': 'SEND SMS',
                    'whatsapp': 'SEND WHATSAPP',
                    'wifi': 'SHARE WIFI',
                    'vcard': 'SAVE CONTACT',
                    'maps': 'VIEW LOCATION'
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

    extractContextualData(data, qrType) {
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
                'vcard': 'SAVE CONTACT'
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