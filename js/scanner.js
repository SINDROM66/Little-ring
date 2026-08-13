const videoElement = document.getElementById('live-camera-feed');
const hiddenCanvas = document.getElementById('hidden-capture-canvas');
const scanBtn = document.getElementById('scan-capture-btn');
const errorText = document.getElementById('scanner-error');

const cardUploadView = document.getElementById('card-barcode-upload');
const cardProgressView = document.getElementById('card-progress');
const cardFormView = document.getElementById('card-form');

let cameraStream = null;

function initScanner() {
    scanBtn.addEventListener('click', handleScan);
    
    // Automatically start the camera when the app loads (if not locked)
    // Wait a brief moment to ensure UI is ready
    setTimeout(() => {
        if (!cardUploadView.classList.contains('hidden')) {
            startCameraStream();
        }
    }, 500);

    // Watch for tab/mode changes to stop/start camera appropriately
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (cardUploadView.classList.contains('hidden')) {
                    stopCameraStream();
                } else {
                    startCameraStream();
                }
            }
        });
    });
    observer.observe(cardUploadView, { attributes: true });
}

async function startCameraStream() {
    if (cameraStream) return; // Already running
    
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment', // Always request the back camera
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        videoElement.srcObject = cameraStream;
        errorText.classList.add('hidden');
    } catch (err) {
        console.error("Camera access failed:", err);
        errorText.textContent = "Unable to access the camera. Please ensure permissions are granted.";
        errorText.classList.remove('hidden');
    }
}

function stopCameraStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        videoElement.srcObject = null;
    }
}

function showScannerView() {
    cardFormView.classList.add('hidden');
    cardProgressView.classList.add('hidden');
    cardUploadView.classList.remove('hidden');
    errorText.classList.add('hidden');
    errorText.textContent = '';
    // The MutationObserver will automatically start the camera
}

async function handleScan() {
    if (!cameraStream || !videoElement.videoWidth) {
        errorText.textContent = "Camera stream is not ready.";
        errorText.classList.remove('hidden');
        return;
    }

    // Set canvas dimensions to match video frame
    hiddenCanvas.width = videoElement.videoWidth;
    hiddenCanvas.height = videoElement.videoHeight;
    
    // Draw current frame to canvas
    const ctx = hiddenCanvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // Transition to progress view
    cardUploadView.classList.add('hidden'); // Observer will stop camera
    cardProgressView.classList.remove('hidden');
    errorText.classList.add('hidden');

    try {
        // Allow UI to update before heavy processing
        await new Promise(r => setTimeout(r, 100));
        
        // Call the existing MRZ extraction logic from ug-id-parser.js
        // We pass the full canvas and let it find the MRZ automatically (cropRegion = null)
        const parsedRecord = await parseUgandaID(hiddenCanvas, null);
        
        populateForm(parsedRecord);
        
        cardProgressView.classList.add('hidden');
        cardFormView.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        cardProgressView.classList.add('hidden');
        cardUploadView.classList.remove('hidden'); // Observer will restart camera
        errorText.textContent = "Failed to detect or parse MRZ text. Please ensure the 3 lines at the bottom of the card are clearly visible and try again. (" + err.message + ")";
        errorText.classList.remove('hidden');
    }
}

function populateForm(record) {
    document.getElementById('surname').value = record.surname || '';
    document.getElementById('givenName').value = record.givenName || '';
    document.getElementById('otherName').value = record.otherName || '';
    document.getElementById('dob').value = record.dob || '';

    if (record.sex) {
        const sexSelect = document.getElementById('sex');
        if (record.sex.toLowerCase() === 'male') sexSelect.value = 'Male';
        else if (record.sex.toLowerCase() === 'female') sexSelect.value = 'Female';
    }

    document.getElementById('nationality').value = record.nationality || 'UGA';
    document.getElementById('nin').value = record.nin || '';

    const ninWarning = document.getElementById('nin-warning');
    if (ninWarning) {
        if (record.ninNeedsReview) {
            ninWarning.textContent = '⚠️ NIN contains characters that may be OCR errors. Please verify.';
            ninWarning.classList.remove('hidden');
        } else {
            ninWarning.classList.add('hidden');
        }
    }
}
