export class FileUploadManager {
    constructor() {
        this.selectedFile = null;
        this.uploadedFileUrl = null;
        this.uploadedFileMetadata = null;
        this.serverUrl = null;
        this.isUploaded = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const removeBtn = document.getElementById('removeFileBtn');
        const uploadBtn = document.getElementById('uploadFileBtn');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeFile());
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadFile());
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            this.removeFile();
            return;
        }

        // Reset upload state when new file is selected
        this.isUploaded = false;
        this.uploadedFileUrl = null;
        this.uploadedFileMetadata = null;

        // Reset progress bar when selecting new file
        const progressBar = document.getElementById('uploadProgressBar');
        const progressPercent = document.getElementById('uploadPercent');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        if (progressPercent) {
            progressPercent.textContent = '0%';
        }

        this.selectedFile = file;
        this.updateFilePreview(file);

        // Enable upload button for new file
        const uploadBtn = document.getElementById('uploadFileBtn');
        const uploadBtnText = document.getElementById('uploadBtnText');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
        }
        if (uploadBtnText) {
            uploadBtnText.textContent = 'Upload File to Generate QR Code';
        }

        // Warn for large files
        const maxSizeRecommended = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSizeRecommended) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            if (confirm(`This file is ${sizeMB}MB. Large files may take longer to upload. Continue?`)) {
                // User chose to continue
            } else {
                this.removeFile();
            }
        }
    }

    updateFilePreview(file) {
        const previewRow = document.getElementById('filePreviewRow');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        if (previewRow) {
            previewRow.style.display = 'block';
        }

        if (fileName) {
            fileName.textContent = file.name;
        }

        if (fileSize) {
            fileSize.textContent = this.formatFileSize(file.size);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeFile() {
        this.selectedFile = null;
        const fileInput = document.getElementById('fileInput');
        const previewRow = document.getElementById('filePreviewRow');
        const uploadBtn = document.getElementById('uploadFileBtn');
        const uploadBtnText = document.getElementById('uploadBtnText');
        const progressRow = document.getElementById('uploadProgressRow');
        const successRow = document.getElementById('uploadSuccessRow');

        if (fileInput) {
            fileInput.value = '';
        }

        if (previewRow) {
            previewRow.style.display = 'none';
        }

        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.style.opacity = '0.6';
            uploadBtn.style.cursor = 'not-allowed';
        }

        if (uploadBtnText) {
            uploadBtnText.textContent = 'Select a file first';
        }

        if (progressRow) {
            progressRow.style.display = 'none';
        }

        if (successRow) {
            successRow.style.display = 'none';
        }

        // Reset progress bar
        const progressBar = document.getElementById('uploadProgressBar');
        const progressPercent = document.getElementById('uploadPercent');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        if (progressPercent) {
            progressPercent.textContent = '0%';
        }

        // Reset upload state
        this.uploadedFileUrl = null;
        this.uploadedFileMetadata = null;
        this.isUploaded = false;
    }

    async getServer() {
        try {
            const response = await fetch('https://api.gofile.io/servers', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Server request failed: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'ok' && data.data && data.data.servers && data.data.servers.length > 0) {
                // Select a server from the list (preferably one in the user's region)
                const server = data.data.servers.find(s => s.zone === 'eu') || data.data.servers[0];
                this.serverUrl = `https://${server.name}.gofile.io`;
                return this.serverUrl;
            } else {
                throw new Error('No servers available');
            }
        } catch (error) {
            console.error('Error getting server:', error);
            throw error;
        }
    }

    async uploadFile() {
        if (!this.selectedFile) {
            alert('Please select a file first');
            return null;
        }

        // Check if file is already uploaded
        if (this.isUploaded && this.uploadedFileUrl) {
            // File already uploaded, just return the existing URL
            return this.uploadedFileUrl;
        }

        const progressRow = document.getElementById('uploadProgressRow');
        const successRow = document.getElementById('uploadSuccessRow');
        const uploadBtn = document.getElementById('uploadFileBtn');
        const uploadBtnText = document.getElementById('uploadBtnText');
        const progressBar = document.getElementById('uploadProgressBar');
        const progressPercent = document.getElementById('uploadPercent');

        // Show progress, hide success
        if (progressRow) progressRow.style.display = 'block';
        if (successRow) successRow.style.display = 'none';

        // Disable upload button during upload
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.style.opacity = '0.6';
        }
        if (uploadBtnText) {
            uploadBtnText.textContent = 'Uploading...';
        }

        try {
            // First, get the server
            await this.getServer();

            // Create FormData and append file
            const formData = new FormData();
            formData.append('file', this.selectedFile);

            // Create XMLHttpRequest for progress tracking
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                // Track upload progress
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        if (progressBar) progressBar.style.width = percentComplete + '%';
                        if (progressPercent) progressPercent.textContent = percentComplete + '%';
                    }
                });

                // Handle successful upload
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            console.log('GoFile API Response:', response);

                            if (response.status === 'ok' && response.data) {
                                // Check for different possible response structures
                                const fileCode = response.data.code || response.data.fileCode || response.data.downloadPage?.split('/').pop();

                                if (!fileCode) {
                                    throw new Error('No file code in response');
                                }

                                const downloadUrl = response.data.downloadPage || `https://gofile.io/d/${fileCode}`;
                                this.uploadedFileUrl = downloadUrl;
                                this.uploadedFileMetadata = {
                                    fileName: this.selectedFile.name,
                                    fileSize: this.selectedFile.size,
                                    uploadCode: fileCode
                                };

                                // Update UI
                                if (progressRow) progressRow.style.display = 'none';
                                if (successRow) successRow.style.display = 'block';

                                const downloadLink = document.getElementById('fileDownloadUrl');
                                if (downloadLink) {
                                    downloadLink.href = downloadUrl;
                                    downloadLink.textContent = downloadUrl;
                                }

                                // Mark as uploaded and disable button
                                this.isUploaded = true;

                                if (uploadBtn) {
                                    uploadBtn.disabled = true;
                                    uploadBtn.style.opacity = '0.6';
                                    uploadBtn.style.cursor = 'not-allowed';
                                }
                                if (uploadBtnText) {
                                    uploadBtnText.textContent = 'File Upload Successful';
                                }

                                resolve(downloadUrl);
                            } else {
                                throw new Error(response.message || 'Upload failed');
                            }
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                });

                // Handle errors
                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });

                // Send the request
                xhr.open('POST', `${this.serverUrl}/contents/uploadfile`, true);
                xhr.send(formData);
            });

        } catch (error) {
            console.error('Upload error:', error);

            // Reset UI on error
            if (progressRow) progressRow.style.display = 'none';
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.style.opacity = '1';
            }
            if (uploadBtnText) {
                uploadBtnText.textContent = 'Upload Failed - Try Again';
            }

            alert(`Upload failed: ${error.message}\n\nPlease try again.`);
            return null;
        }
    }

    getUploadedFileData() {
        return {
            url: this.uploadedFileUrl,
            metadata: this.uploadedFileMetadata
        };
    }

    reset() {
        this.removeFile();
        this.uploadedFileUrl = null;
        this.uploadedFileMetadata = null;
        this.serverUrl = null;
        this.isUploaded = false;
    }
}