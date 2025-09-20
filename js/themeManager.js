export class ThemeManager {
    constructor() {
        this.storageKey = 'qrcode_theme';
        this.currentTheme = 'light';
        this.themeToggle = null;
        this.systemPreference = null;
    }

    init() {
        this.themeToggle = document.getElementById('themeToggle');
        
        this.detectSystemPreference();
        
        this.loadTheme();
        
        this.setupEventListeners();
        
        this.watchSystemPreference();
    }

    detectSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.systemPreference = 'dark';
        } else {
            this.systemPreference = 'light';
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem(this.storageKey);
        
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
            this.currentTheme = savedTheme;
        } else {
            this.currentTheme = this.systemPreference || 'light';
        }
        
        this.applyTheme(this.currentTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        document.querySelector('meta[name="theme-color"]')?.remove();
        const themeColorMeta = document.createElement('meta');
        themeColorMeta.name = 'theme-color';
        themeColorMeta.content = theme === 'dark' ? '#000000' : '#ffffff';
        document.head.appendChild(themeColorMeta);
        
        this.updateToggleButton(theme);
        
        this.currentTheme = theme;
        
        this.notifyChange(theme);
    }

    updateToggleButton(theme) {
        if (this.themeToggle) {
            this.themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
            this.themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.error('Invalid theme:', theme);
            return;
        }
        
        this.applyTheme(theme);
        
        try {
            localStorage.setItem(this.storageKey, theme);
        } catch (error) {
            console.error('Failed to save theme preference:', error);
        }
    }

    setupEventListeners() {
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
                this.animateToggle();
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    watchSystemPreference() {
        if (!window.matchMedia) {
            return;
        }
        
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        darkModeQuery.addEventListener('change', (e) => {
            this.systemPreference = e.matches ? 'dark' : 'light';
            
            const savedTheme = localStorage.getItem(this.storageKey);
            if (!savedTheme) {
                this.applyTheme(this.systemPreference);
            }
        });
    }

    animateToggle() {
        if (!this.themeToggle) {
            return;
        }
        
        this.themeToggle.style.transform = 'rotate(360deg)';
        
        setTimeout(() => {
            this.themeToggle.style.transition = 'none';
            this.themeToggle.style.transform = 'rotate(0deg)';
            
            setTimeout(() => {
                this.themeToggle.style.transition = '';
            }, 50);
        }, 300);
    }

    getTheme() {
        return this.currentTheme;
    }

    isSystemPreference() {
        const savedTheme = localStorage.getItem(this.storageKey);
        return !savedTheme;
    }

    resetToSystemPreference() {
        localStorage.removeItem(this.storageKey);
        this.detectSystemPreference();
        this.applyTheme(this.systemPreference);
    }

    notifyChange(theme) {
        const event = new CustomEvent('themeChange', {
            detail: {
                theme,
                timestamp: Date.now()
            }
        });
        
        window.dispatchEvent(event);
    }

    onThemeChange(callback) {
        const handler = (event) => {
            callback(event.detail);
        };
        
        window.addEventListener('themeChange', handler);
        
        return () => {
            window.removeEventListener('themeChange', handler);
        };
    }

    preloadThemeAssets(theme) {
        const assets = {
            light: [
                '/images/logo-light.png',
                '/images/background-light.jpg'
            ],
            dark: [
                '/images/logo-dark.png',
                '/images/background-dark.jpg'
            ]
        };
        
        const themeAssets = assets[theme] || [];
        
        themeAssets.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
        });
    }

    addCustomTheme(name, colors) {
        if (!name || typeof name !== 'string') {
            throw new Error('Theme name must be a non-empty string');
        }
        
        if (!colors || typeof colors !== 'object') {
            throw new Error('Colors must be an object');
        }
        
        const style = document.createElement('style');
        style.id = `theme-${name}`;
        
        let css = `[data-theme="${name}"] {\n`;
        
        Object.entries(colors).forEach(([key, value]) => {
            css += `  --${key}: ${value};\n`;
        });
        
        css += '}';
        
        style.textContent = css;
        document.head.appendChild(style);
        
        return true;
    }

    exportThemeSettings() {
        const settings = {
            currentTheme: this.currentTheme,
            systemPreference: this.systemPreference,
            savedPreference: localStorage.getItem(this.storageKey),
            timestamp: Date.now()
        };
        
        return settings;
    }

    importThemeSettings(settings) {
        if (!settings || typeof settings !== 'object') {
            throw new Error('Invalid settings object');
        }
        
        if (settings.savedPreference) {
            localStorage.setItem(this.storageKey, settings.savedPreference);
            this.loadTheme();
        } else if (settings.currentTheme) {
            this.setTheme(settings.currentTheme);
        }
        
        return true;
    }

    getCSSVariables() {
        const styles = getComputedStyle(document.documentElement);
        const variables = {};
        
        const varNames = [
            'primary-color',
            'success-color',
            'error-color',
            'warning-color',
            'bg-primary',
            'bg-secondary',
            'bg-card',
            'bg-hover',
            'text-primary',
            'text-secondary',
            'text-tertiary',
            'border-color'
        ];
        
        varNames.forEach(name => {
            variables[name] = styles.getPropertyValue(`--${name}`).trim();
        });
        
        return variables;
    }
}