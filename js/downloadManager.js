export class DownloadManager {
    constructor() {
        this.uiController = null;
    }

    setUIController(controller) {
        this.uiController = controller;
    }

    downloadPNG(qrCode) {
        const canvas = this.getCanvasFromQRCode(qrCode);
        
        if (!canvas) {
            this.showError('Unable to download QR code');
            return;
        }
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `qrcode_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showSuccess('QR Code downloaded as PNG');
        }, 'image/png');
    }

    downloadSVG(qrCode) {
        const canvas = this.getCanvasFromQRCode(qrCode);
        
        if (!canvas) {
            this.showError('Unable to download QR code');
            return;
        }
        
        // Pass color information if available
        const colorDark = qrCode?.options?.colorDark || '#000000';
        const colorLight = qrCode?.options?.colorLight || '#ffffff';
        
        const svgString = this.canvasToSVG(canvas, colorDark, colorLight);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qrcode_${Date.now()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showSuccess('QR Code downloaded as SVG');
    }

    downloadJPEG(qrCode, quality = 0.9) {
        const canvas = this.getCanvasFromQRCode(qrCode);
        
        if (!canvas) {
            this.showError('Unable to download QR code');
            return;
        }
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `qrcode_${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showSuccess('QR Code downloaded as JPEG');
        }, 'image/jpeg', quality);
    }

    async copyToClipboard(qrCode) {
        // Regenerate at full size if needed
        let canvas;
        if (qrCode.options.actualWidth && qrCode.options.actualWidth !== qrCode.options.width) {
            const fullSizeOptions = { ...qrCode.options };
            fullSizeOptions.width = fullSizeOptions.actualWidth;
            fullSizeOptions.height = fullSizeOptions.actualHeight;
            const fullSizeQR = await this.qrGenerator.generate(qrCode.data, fullSizeOptions);
            canvas = this.getCanvasFromQRCode(fullSizeQR);
        } else {
            canvas = this.getCanvasFromQRCode(qrCode);
        }
        
        if (!canvas) {
            this.showError('Unable to copy QR code');
            return;
        }
        
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                canvas.toBlob(async (blob) => {
                    try {
                        const item = new ClipboardItem({ 'image/png': blob });
                        await navigator.clipboard.write([item]);
                        this.showSuccess('QR Code copied to clipboard');
                    } catch (error) {
                        console.error('Clipboard write failed:', error);
                        this.fallbackCopy(canvas);
                    }
                }, 'image/png');
            } else {
                this.fallbackCopy(canvas);
            }
        } catch (error) {
            console.error('Copy to clipboard failed:', error);
            this.showError('Failed to copy to clipboard');
        }
    }

    fallbackCopy(canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        const textarea = document.createElement('textarea');
        textarea.value = dataUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            this.showSuccess('QR Code data copied (as text)');
        } catch (error) {
            this.showError('Failed to copy to clipboard');
        } finally {
            document.body.removeChild(textarea);
        }
    }

    getCanvasFromQRCode(qrCode) {
        if (!qrCode || !qrCode.element) {
            // Fallback to finding canvas in the DOM
            const canvasElement = document.querySelector('#qrcode canvas');
            if (canvasElement) {
                return canvasElement;
            }
            
            const imgElement = document.querySelector('#qrcode img');
            if (imgElement) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = imgElement.naturalWidth || imgElement.width;
                canvas.height = imgElement.naturalHeight || imgElement.height;
                ctx.drawImage(imgElement, 0, 0);
                return canvas;
            }
            
            return null;
        }
        
        // The element should already be a canvas with margins included
        if (qrCode.element.tagName === 'CANVAS') {
            return qrCode.element;
        }
        
        if (qrCode.element.tagName === 'IMG') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = qrCode.element.width;
            canvas.height = qrCode.element.height;
            ctx.drawImage(qrCode.element, 0, 0);
            return canvas;
        }
        
        return null;
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

    canvasToSVG(canvas, colorDark = '#000000', colorLight = '#ffffff') {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Check if canvas has frame
        const hasFrame = canvas.dataset.hasFrame === 'true';
        const frameText = canvas.dataset.frameText || '';
        
        if (hasFrame && frameText) {
            // For framed QR codes, export the entire canvas as is
            let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
            svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;
            
            // Calculate frame dimensions (matching the canvas rendering)
            const frameWidth = Math.max(3, Math.floor(canvas.width * 0.02));
            const frameMargin = Math.max(15, Math.floor(canvas.width * 0.04));
            const textHeight = Math.max(18, Math.floor(canvas.width * 0.06));
            const textAreaHeight = Math.max(40, Math.floor(canvas.width * 0.12));
            const borderRadius = Math.min(15, canvas.width * 0.025);
            
            // Draw the outer frame with rounded corners (filled with dark color)
            svg += `<rect x="0" y="0" width="${canvas.width}" height="${canvas.height}" rx="${borderRadius}" ry="${borderRadius}" fill="${colorDark}"/>`;
            
            // Draw inner white area for QR code
            const innerX = frameWidth;
            const innerY = frameWidth;
            const innerWidth = canvas.width - frameWidth * 2;
            const innerHeight = canvas.height - frameWidth * 2 - textAreaHeight;
            const innerRadius = Math.max(0, borderRadius - frameWidth);
            
            svg += `<rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="${innerRadius}" ry="${innerRadius}" fill="${colorLight}"/>`;
            
            // Detect and draw QR modules within the frame
            const qrStartX = frameMargin + frameWidth;
            const qrStartY = frameMargin + frameWidth;
            const qrEndX = canvas.width - frameMargin - frameWidth;
            const qrEndY = canvas.height - frameMargin - frameWidth - textAreaHeight;
            
            // Convert colors to RGB for comparison
            const colorDarkRgb = this.hexToRgb(colorDark);
            const colorLightRgb = this.hexToRgb(colorLight);
            
            // Detect module size
            const moduleSize = this.detectModuleSize(imageData, qrStartX, colorDarkRgb, colorLightRgb);
            const qrWidth = qrEndX - qrStartX;
            const modules = Math.round(qrWidth / moduleSize);
            
            // Draw QR modules
            for (let row = 0; row < modules; row++) {
                for (let col = 0; col < modules; col++) {
                    const pixelX = qrStartX + (col * moduleSize);
                    const pixelY = qrStartY + (row * moduleSize);
                    
                    if (pixelX < qrEndX && pixelY < qrEndY) {
                        const sampleX = Math.min(Math.floor(pixelX + moduleSize/2), canvas.width - 1);
                        const sampleY = Math.min(Math.floor(pixelY + moduleSize/2), canvas.height - 1);
                        const index = (sampleY * canvas.width + sampleX) * 4;
                        
                        if (this.isModulePixel(data, index, colorDarkRgb, colorLightRgb)) {
                            svg += `<rect x="${pixelX}" y="${pixelY}" width="${moduleSize}" height="${moduleSize}" fill="${colorDark}"/>`;
                        }
                    }
                }
            }
            
            // Add frame text (with light color on dark background)
            const textY = canvas.height - textAreaHeight / 2;
            svg += `<text x="${canvas.width / 2}" y="${textY}" font-family="'JetBrains Mono', monospace" font-size="${textHeight}" font-weight="bold" text-anchor="middle" fill="${colorLight}">${frameText}</text>`;
            
            svg += '</svg>';
            return svg;
        } else {
            // Original SVG generation for non-framed QR codes
            // Convert colors to RGB for comparison
            const colorDarkRgb = this.hexToRgb(colorDark);
            const colorLightRgb = this.hexToRgb(colorLight);
            
            // Check if canvas has margin data
            const marginPixels = parseInt(canvas.dataset.margin) || 0;
            const qrSize = parseInt(canvas.dataset.qrSize) || canvas.width;
            
            // Detect module size from the QR code area (excluding margins)
            const startOffset = marginPixels;
            const moduleSize = this.detectModuleSize(imageData, startOffset, colorDarkRgb, colorLightRgb);
            const modules = qrSize / moduleSize;
            
            let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
            svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;
            svg += `<rect width="${canvas.width}" height="${canvas.height}" fill="${colorLight}"/>`;
            
            // Draw QR modules, accounting for margins
            for (let row = 0; row < modules; row++) {
                for (let col = 0; col < modules; col++) {
                    const pixelX = marginPixels + (col * moduleSize);
                    const pixelY = marginPixels + (row * moduleSize);
                    
                    // Sample center of module
                    const sampleX = Math.min(Math.floor(pixelX + moduleSize/2), canvas.width - 1);
                    const sampleY = Math.min(Math.floor(pixelY + moduleSize/2), canvas.height - 1);
                    const index = (sampleY * canvas.width + sampleX) * 4;
                    
                    if (this.isModulePixel(data, index, colorDarkRgb, colorLightRgb)) {
                        svg += `<rect x="${pixelX}" y="${pixelY}" width="${moduleSize}" height="${moduleSize}" fill="${colorDark}"/>`;
                    }
                }
            }
            
            svg += '</svg>';
            return svg;
        }
    }

    detectModuleSize(imageData, startOffset = 0, colorDarkRgb = null, colorLightRgb = null) {
        const data = imageData.data;
        const width = imageData.width;
        let moduleSize = 1;
        
        // If colors not provided, use default detection
        if (!colorDarkRgb || !colorLightRgb) {
            colorDarkRgb = { r: 0, g: 0, b: 0 };
            colorLightRgb = { r: 255, g: 255, b: 255 };
        }
        
        // Start from the offset to skip margins
        const startY = startOffset;
        const startX = startOffset;
        
        // Find first module pixel in the QR code area
        let firstModuleX = startX;
        let foundModule = false;
        for (let x = startX; x < width - startOffset; x++) {
            const index = (startY * width + x) * 4;
            if (this.isModulePixel(data, index, colorDarkRgb, colorLightRgb)) {
                firstModuleX = x;
                foundModule = true;
                break;
            }
        }
        
        if (!foundModule) {
            return 1;
        }
        
        // Count consecutive module pixels to determine module size
        for (let x = firstModuleX + 1; x < width - startOffset; x++) {
            const index = (startY * width + x) * 4;
            
            if (!this.isModulePixel(data, index, colorDarkRgb, colorLightRgb)) {
                moduleSize = x - firstModuleX;
                break;
            }
        }
        
        // Finder pattern is 7 modules wide, so if we detected the full finder pattern
        if (moduleSize > 5) {
            moduleSize = moduleSize / 7;
        }
        
        return Math.max(1, moduleSize);
    }

    async share(qrCode) {
        if (!navigator.share) {
            this.showError('Sharing is not supported on this device');
            return;
        }
        
        const canvas = this.getCanvasFromQRCode(qrCode);
        
        if (!canvas) {
            this.showError('Unable to share QR code');
            return;
        }
        
        try {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], `qrcode_${Date.now()}.png`, { type: 'image/png' });
                
                const shareData = {
                    title: 'QR Code',
                    text: 'Check out this QR code',
                    files: [file]
                };
                
                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    this.showSuccess('QR Code shared successfully');
                } else {
                    await navigator.share({
                        title: 'QR Code',
                        text: 'Check out this QR code',
                        url: canvas.toDataURL()
                    });
                    this.showSuccess('QR Code link shared');
                }
            }, 'image/png');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share failed:', error);
                this.showError('Failed to share QR code');
            }
        }
    }

    print(qrCode) {
        const canvas = this.getCanvasFromQRCode(qrCode);
        
        if (!canvas) {
            this.showError('Unable to print QR code');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        const dataUrl = canvas.toDataURL();
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print QR Code</title>
                <style>
                    body {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 20px;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        border: 1px solid #ccc;
                        padding: 20px;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        img {
                            border: none;
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <img src="${dataUrl}" alt="QR Code">
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                </script>
            </body>
            </html>
        `);
        
        printWindow.document.close();
    }

    downloadBatch(qrCodes, format = 'png') {
        const zip = new JSZip();
        const promises = [];
        
        qrCodes.forEach((qrCode, index) => {
            const canvas = this.getCanvasFromQRCode(qrCode);
            
            if (canvas) {
                const promise = new Promise((resolve) => {
                    if (format === 'svg') {
                        const svgString = this.canvasToSVG(canvas);
                        zip.file(`qrcode_${index + 1}.svg`, svgString);
                        resolve();
                    } else {
                        canvas.toBlob((blob) => {
                            zip.file(`qrcode_${index + 1}.${format}`, blob);
                            resolve();
                        }, `image/${format}`);
                    }
                });
                promises.push(promise);
            }
        });
        
        Promise.all(promises).then(() => {
            zip.generateAsync({ type: 'blob' }).then((content) => {
                const url = URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `qrcodes_batch_${Date.now()}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                this.showSuccess('Batch download completed');
            });
        });
    }

    showSuccess(message) {
        if (this.uiController) {
            this.uiController.showNotification(message, 'success');
        } else {
            const notification = document.getElementById('notification');
            if (notification) {
                const notificationMessage = notification.querySelector('.notification-message');
                notification.className = 'notification success';
                notificationMessage.textContent = message;
                notification.classList.add('show');
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }
        }
    }

    showError(message) {
        if (this.uiController) {
            this.uiController.showNotification(message, 'error');
        } else {
            const notification = document.getElementById('notification');
            if (notification) {
                const notificationMessage = notification.querySelector('.notification-message');
                notification.className = 'notification error';
                notificationMessage.textContent = message;
                notification.classList.add('show');
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }
        }
    }
}