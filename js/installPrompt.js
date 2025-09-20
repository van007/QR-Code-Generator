// PWA Install Prompt Handler
export class InstallPromptManager {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = null;
        this.installBanner = null;
        this.headerInstallButton = null;
        this.init();
    }

    init() {
        // Get reference to header install button
        this.headerInstallButton = document.getElementById('installButton');
        
        // Add click handler to header install button
        if (this.headerInstallButton) {
            this.headerInstallButton.addEventListener('click', () => {
                this.handleInstallClick();
            });
        }

        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            // Show install button/banner
            this.showInstallPrompt();
            // Show header install button
            this.showHeaderInstallButton();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallPrompt();
            this.hideHeaderInstallButton();
            this.deferredPrompt = null;
        });

        // Check if app is installed (for browsers that support it)
        if ('getInstalledRelatedApps' in navigator) {
            navigator.getInstalledRelatedApps().then((apps) => {
                if (apps.length > 0) {
                    console.log('PWA is already installed');
                }
            });
        }

        // Check if running in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Running in standalone mode');
        }
    }

    createInstallBanner() {
        // Create install banner HTML
        const banner = document.createElement('div');
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="install-banner-content">
                <img src="/assets/logo.png" alt="QR Generator" class="install-banner-icon">
                <div class="install-banner-text">
                    <h3>Install QR Generator</h3>
                    <p>Add to your home screen for quick access and offline use</p>
                </div>
                <div class="install-banner-actions">
                    <button class="install-banner-dismiss">Not Now</button>
                    <button class="install-banner-install">Install</button>
                </div>
            </div>
        `;

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .pwa-install-banner {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--bg-primary, white);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                padding: 16px;
                max-width: 90%;
                width: 400px;
                z-index: 10000;
                animation: slideUp 0.3s ease-out;
                border: 1px solid var(--border-color, #e0e0e0);
            }

            @keyframes slideUp {
                from {
                    transform: translateX(-50%) translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }

            .install-banner-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .install-banner-icon {
                width: 48px;
                height: 48px;
                border-radius: 8px;
                flex-shrink: 0;
            }

            .install-banner-text {
                flex: 1;
            }

            .install-banner-text h3 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary, #333);
            }

            .install-banner-text p {
                margin: 0;
                font-size: 14px;
                color: var(--text-secondary, #666);
            }

            .install-banner-actions {
                display: flex;
                gap: 8px;
                margin-left: auto;
            }

            .install-banner-dismiss,
            .install-banner-install {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: 'JetBrains Mono', monospace;
            }

            .install-banner-dismiss {
                background: transparent;
                color: var(--text-secondary, #666);
            }

            .install-banner-dismiss:hover {
                background: var(--bg-secondary, #f5f5f5);
            }

            .install-banner-install {
                background: var(--primary-color, #007AFF);
                color: white;
            }

            .install-banner-install:hover {
                background: var(--primary-hover, #0066CC);
            }

            @media (max-width: 480px) {
                .pwa-install-banner {
                    width: calc(100% - 20px);
                    bottom: 10px;
                }

                .install-banner-content {
                    flex-wrap: wrap;
                }

                .install-banner-actions {
                    width: 100%;
                    margin-top: 12px;
                    justify-content: flex-end;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(banner);

        // Add event listeners
        banner.querySelector('.install-banner-dismiss').addEventListener('click', () => {
            this.hideInstallPrompt();
            // Save dismissal in localStorage
            localStorage.setItem('pwa_install_dismissed', 'true');
            localStorage.setItem('pwa_install_dismissed_date', Date.now().toString());
            // Keep header button visible after dismissing banner
            this.showHeaderInstallButton();
        });

        banner.querySelector('.install-banner-install').addEventListener('click', () => {
            this.handleInstallClick();
        });

        return banner;
    }

    showInstallPrompt() {
        // Check if user has dismissed the prompt recently (within 7 days)
        const dismissedDate = localStorage.getItem('pwa_install_dismissed_date');
        if (dismissedDate) {
            const daysSinceDismissed = (Date.now() - parseInt(dismissedDate)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                return;
            }
        }

        // Create and show the install banner
        if (!this.installBanner) {
            this.installBanner = this.createInstallBanner();
        }
    }

    hideInstallPrompt() {
        if (this.installBanner) {
            this.installBanner.style.animation = 'slideDown 0.3s ease-out';
            setTimeout(() => {
                if (this.installBanner && this.installBanner.parentNode) {
                    this.installBanner.parentNode.removeChild(this.installBanner);
                    this.installBanner = null;
                }
            }, 300);
        }
    }

    showHeaderInstallButton() {
        if (this.headerInstallButton && this.deferredPrompt) {
            this.headerInstallButton.classList.remove('hidden');
        }
    }

    hideHeaderInstallButton() {
        if (this.headerInstallButton) {
            this.headerInstallButton.classList.add('hidden');
        }
    }

    async handleInstallClick() {
        if (!this.deferredPrompt) {
            return;
        }

        // Hide the banner and header button
        this.hideInstallPrompt();
        this.hideHeaderInstallButton();

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // If user cancelled, show the header button again
        if (outcome === 'dismissed') {
            this.showHeaderInstallButton();
        }

        // Clear the deferred prompt if accepted
        if (outcome === 'accepted') {
            this.deferredPrompt = null;
        }
    }

    // Method to manually trigger install (can be called from other parts of the app)
    async promptInstall() {
        if (this.deferredPrompt) {
            await this.handleInstallClick();
            return true;
        }
        return false;
    }

    // Check if the app can be installed
    canInstall() {
        return this.deferredPrompt !== null;
    }
}

// Add slide down animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(styleSheet);