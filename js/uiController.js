export class UIController {
    constructor() {
        this.notificationTimeout = null;
    }

    init() {
        this.setupKeyboardShortcuts();
        this.setupAccessibility();
    }

    switchInputType(type) {
        const allInputGroups = document.querySelectorAll('#inputFields .form-group');
        
        allInputGroups.forEach(group => {
            group.classList.add('hidden');
        });
        
        const activeGroup = document.querySelector(`#inputFields .form-group[data-type="${type}"]`);
        if (activeGroup) {
            activeGroup.classList.remove('hidden');
            
            const firstInput = activeGroup.querySelector('input, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    showQRCode() {
        const placeholder = document.querySelector('.preview-placeholder');
        const qrContainer = document.getElementById('qrcode');
        const actionButtons = document.getElementById('actionButtons');
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        qrContainer.style.display = 'flex';
        actionButtons.classList.remove('hidden');
        
        this.animateElement(qrContainer, 'fadeIn');
    }

    hideQRCode() {
        const placeholder = document.querySelector('.preview-placeholder');
        const qrContainer = document.getElementById('qrcode');
        const actionButtons = document.getElementById('actionButtons');
        
        if (placeholder) {
            placeholder.style.display = '';
        }
        
        qrContainer.style.display = 'none';
        actionButtons.classList.add('hidden');
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationMessage = notification.querySelector('.notification-message');
        
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }
        
        notification.className = 'notification';
        notification.classList.add(type);
        notificationMessage.textContent = message;
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        this.notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    animateElement(element, animationName) {
        element.style.animation = `${animationName} 250ms ease`;
        
        element.addEventListener('animationend', () => {
            element.style.animation = '';
        }, { once: true });
    }

    setupKeyboardShortcuts() {
        const shortcuts = {
            'g': () => document.getElementById('generateBtn').click(),
            'd': () => document.getElementById('downloadPNG').click(),
            'c': () => document.getElementById('copyImage').click(),
            't': () => document.getElementById('themeToggle').click(),
            '1': () => this.selectQRType('text'),
            '2': () => this.selectQRType('url'),
            '3': () => this.selectQRType('email'),
            '4': () => this.selectQRType('phone'),
            '5': () => this.selectQRType('sms'),
            '6': () => this.selectQRType('whatsapp'),
            '7': () => this.selectQRType('youtube'),
            '8': () => this.selectQRType('wifi'),
            '9': () => this.selectQRType('vcard'),
            '0': () => this.selectQRType('maps'),
            '-': () => this.selectQRType('event'),
            'u': () => this.selectQRType('upi'),
            'a': () => this.selectQRType('attendance'),
            'f': () => this.selectQRType('file')
        };
        
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, select')) {
                return;
            }
            
            if (e.altKey && shortcuts[e.key.toLowerCase()]) {
                e.preventDefault();
                shortcuts[e.key.toLowerCase()]();
            }
        });
    }

    selectQRType(type) {
        const select = document.getElementById('qrType');
        select.value = type;
        select.dispatchEvent(new Event('change'));
    }

    setupAccessibility() {
        const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
            
            if (e.key === 'Escape') {
                const notification = document.getElementById('notification');
                if (notification.classList.contains('show')) {
                    notification.classList.remove('show');
                }
            }
        });
        
        this.addAriaLabels();
    }

    addAriaLabels() {
        const elements = {
            'generateBtn': 'Generate QR Code',
            'downloadPNG': 'Download QR Code as PNG',
            'downloadSVG': 'Download QR Code as SVG',
            'copyImage': 'Copy QR Code to clipboard',
            'clearHistory': 'Clear QR Code history',
            'themeToggle': 'Toggle dark/light theme'
        };
        
        Object.entries(elements).forEach(([id, label]) => {
            const element = document.getElementById(id);
            if (element && !element.getAttribute('aria-label')) {
                element.setAttribute('aria-label', label);
            }
        });
    }

    showLoadingState(element) {
        const originalContent = element.innerHTML;
        element.disabled = true;
        element.innerHTML = `
            <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </circle>
            </svg>
            Processing...
        `;
        
        return () => {
            element.disabled = false;
            element.innerHTML = originalContent;
        };
    }

    validateInput(type, value) {
        const validators = {
            email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
            url: (val) => {
                try {
                    new URL(val.startsWith('http') ? val : `https://${val}`);
                    return true;
                } catch {
                    return false;
                }
            },
            phone: (val) => /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(val),
            text: (val) => val.length > 0 && val.length <= 2953
        };
        
        if (validators[type]) {
            return validators[type](value);
        }
        
        return true;
    }

    highlightInvalidInput(inputElement) {
        inputElement.classList.add('invalid');
        inputElement.style.borderColor = 'var(--error-color)';
        
        setTimeout(() => {
            inputElement.classList.remove('invalid');
            inputElement.style.borderColor = '';
        }, 3000);
    }

    createTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            background: var(--bg-card);
            color: var(--text-primary);
            padding: 0.5rem 0.75rem;
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            box-shadow: var(--shadow-md);
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity var(--transition-fast);
        `;
        
        document.body.appendChild(tooltip);
        
        const showTooltip = (e) => {
            const rect = element.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${rect.bottom + 8}px`;
            tooltip.style.opacity = '1';
        };
        
        const hideTooltip = () => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                if (tooltip.parentElement) {
                    tooltip.remove();
                }
            }, 150);
        };
        
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        element.addEventListener('focus', showTooltip);
        element.addEventListener('blur', hideTooltip);
        
        return tooltip;
    }

    toggleFullscreen() {
        const previewPanel = document.querySelector('.preview-panel');
        
        if (!document.fullscreenElement) {
            previewPanel.requestFullscreen().catch(err => {
                this.showNotification('Failed to enter fullscreen', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }

    updateProgressBar(percent) {
        let progressBar = document.getElementById('progressBar');
        
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'progressBar';
            progressBar.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                height: 3px;
                background: var(--primary-color);
                transition: width 300ms ease;
                z-index: 9999;
            `;
            document.body.appendChild(progressBar);
        }
        
        progressBar.style.width = `${percent}%`;
        
        if (percent >= 100) {
            setTimeout(() => {
                progressBar.style.opacity = '0';
                setTimeout(() => {
                    progressBar.remove();
                }, 300);
            }, 500);
        }
    }
}