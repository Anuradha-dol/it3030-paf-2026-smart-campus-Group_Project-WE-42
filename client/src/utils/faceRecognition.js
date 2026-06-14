import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
let modelsLoadedPromise = null;
const VIDEO_READY_TIMEOUT_MS = 5000;
const FACE_DETECTION_ATTEMPTS = 8;
const FACE_DETECTION_RETRY_DELAY_MS = 250;
const REQUIRED_MODEL_MANIFESTS = [
    'tiny_face_detector_model-weights_manifest.json',
    'face_landmark_68_model-weights_manifest.json',
    'face_recognition_model-weights_manifest.json',
];

function getModelSetupErrorMessage(details = '') {
    const suffix = details ? ` ${details}` : '';
    return `Face model files are missing or invalid in client/public/models.${suffix} Add required face-api.js model manifest and shard files, then restart the frontend server.`;
}

function getDetectorOptions() {
    return new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.45,
    });
}

function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createNamedError(name, message) {
    const error = new Error(message);
    error.name = name;
    return error;
}

function hasUsableVideoFrame(videoElement) {
    return (
        videoElement &&
        videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        videoElement.videoWidth > 0 &&
        videoElement.videoHeight > 0
    );
}

async function waitForVideoFrame(videoElement, timeoutMs = VIDEO_READY_TIMEOUT_MS) {
    if (hasUsableVideoFrame(videoElement)) {
        return;
    }

    await new Promise((resolve, reject) => {
        let frameCallbackId = null;

        const timeoutId = window.setTimeout(() => {
            cleanup();
            reject(createNamedError('VideoFrameTimeoutError', 'Camera opened, but no video frame was received.'));
        }, timeoutMs);

        const cleanup = () => {
            window.clearTimeout(timeoutId);
            videoElement.removeEventListener('loadedmetadata', checkReady);
            videoElement.removeEventListener('loadeddata', checkReady);
            videoElement.removeEventListener('canplay', checkReady);
            videoElement.removeEventListener('playing', checkReady);
            if (frameCallbackId !== null && typeof videoElement.cancelVideoFrameCallback === 'function') {
                videoElement.cancelVideoFrameCallback(frameCallbackId);
            }
        };

        const finish = () => {
            cleanup();
            resolve();
        };

        function checkReady() {
            if (hasUsableVideoFrame(videoElement)) {
                finish();
            }
        }

        videoElement.addEventListener('loadedmetadata', checkReady);
        videoElement.addEventListener('loadeddata', checkReady);
        videoElement.addEventListener('canplay', checkReady);
        videoElement.addEventListener('playing', checkReady);

        if (typeof videoElement.requestVideoFrameCallback === 'function') {
            frameCallbackId = videoElement.requestVideoFrameCallback(checkReady);
        }

        checkReady();
    });
}

async function validateModelManifests() {
    const checks = await Promise.all(
        REQUIRED_MODEL_MANIFESTS.map(async (fileName) => {
            const response = await fetch(`${MODEL_URL}/${fileName}`, { cache: 'no-store' });
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            return {
                fileName,
                ok: response.ok,
                looksLikeHtml: contentType.includes('text/html'),
            };
        })
    );

    const invalid = checks.filter((item) => !item.ok || item.looksLikeHtml);
    if (invalid.length > 0) {
        const names = invalid.map((item) => item.fileName).join(', ');
        throw new Error(getModelSetupErrorMessage(`Invalid files: ${names}.`));
    }
}

export function descriptorToArray(descriptor) {
    if (!descriptor) {
        return [];
    }
    return Array.from(descriptor);
}

export async function loadFaceModels() {
    if (!modelsLoadedPromise) {
        modelsLoadedPromise = (async () => {
            await validateModelManifests();
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
        })().catch((error) => {
            modelsLoadedPromise = null;
            const rawMessage = String(error?.message || '');
            const looksLikeHtmlError =
                rawMessage.includes("Unexpected token '<'") ||
                rawMessage.includes('is not valid JSON') ||
                rawMessage.includes('Unexpected end of JSON input');
            if (looksLikeHtmlError) {
                throw new Error(getModelSetupErrorMessage());
            }
            throw error;
        });
    }
    await modelsLoadedPromise;
}

export async function startFaceCamera(videoElement) {
    if (!videoElement) {
        throw new Error('Video element is required');
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        throw createNamedError(
            'NotSupportedError',
            'Camera API is not available in this browser context.'
        );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
        },
        audio: false,
    });

    try {
        videoElement.srcObject = stream;
        await videoElement.play();
        await waitForVideoFrame(videoElement);
        return stream;
    } catch (error) {
        stopFaceCamera(videoElement, stream);
        throw error;
    }
}

export function getFaceCameraErrorMessage(error) {
    const errorName = error?.name || '';

    if (errorName === 'NotSupportedError') {
        if (window.isSecureContext === false) {
            return 'Camera access needs HTTPS or localhost. Open the app with http://localhost:5173 and try again.';
        }
        return 'Camera access is not supported in this browser.';
    }
    if (errorName === 'NotAllowedError') {
        return 'Camera permission denied. Please allow camera access in your browser settings.';
    }
    if (errorName === 'NotFoundError') {
        return 'No camera device found on this system.';
    }
    if (errorName === 'NotReadableError') {
        return 'Camera is already in use by another application.';
    }
    if (errorName === 'SecurityError') {
        return 'Camera access blocked by browser security policy.';
    }
    if (errorName === 'OverconstrainedError') {
        return 'Requested camera constraints are not supported on this device.';
    }
    if (errorName === 'VideoFrameTimeoutError') {
        return 'Camera opened but did not send video. Close other camera apps and try again.';
    }

    return 'Unable to access camera. Please allow camera permission and try again.';
}

export function stopFaceCamera(videoElement, stream) {
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
    }
    if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
    }
}

export async function extractFaceDescriptor(videoElement) {
    if (!videoElement) {
        throw new Error('Video element is required');
    }

    await loadFaceModels();
    await waitForVideoFrame(videoElement);

    let lastDetectionCount = 0;

    for (let attempt = 0; attempt < FACE_DETECTION_ATTEMPTS; attempt += 1) {
        const detections = await faceapi
            .detectAllFaces(videoElement, getDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        lastDetectionCount = detections?.length || 0;

        if (lastDetectionCount === 1) {
            return descriptorToArray(detections[0].descriptor);
        }

        if (lastDetectionCount > 1) {
            throw new Error('Multiple faces detected. Please keep only one face in frame.');
        }

        if (attempt < FACE_DETECTION_ATTEMPTS - 1) {
            await delay(FACE_DETECTION_RETRY_DELAY_MS);
        }
    }

    if (lastDetectionCount === 0) {
        throw new Error('No face detected. Keep your face centered, improve lighting, and try again.');
    }

    throw new Error('Face scan failed. Please try again.');
}
