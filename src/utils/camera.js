export async function startCamera(videoElement, log = () => {}) {
  const constraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  };

  // iOS compatibility attributes
  videoElement.setAttribute('playsinline', '');
  videoElement.setAttribute('webkit-playsinline', '');
  videoElement.setAttribute('muted', '');
  videoElement.muted = true;
  videoElement.playsInline = true;

  log('Calling getUserMedia...');
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const tracks = stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', ');
  log(`getUserMedia success. Tracks: ${tracks}`);

  log('Setting srcObject on video element...');
  videoElement.srcObject = stream;
  log(`srcObject set. readyState=${videoElement.readyState}, networkState=${videoElement.networkState}`);

  // Wait for metadata with a timeout
  if (videoElement.readyState < 1) {
    log('readyState < 1, waiting for loadedmetadata (5s timeout)...');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('loadedmetadata timeout after 5s'));
      }, 5000);
      videoElement.addEventListener('loadedmetadata', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    log(`Metadata loaded. readyState=${videoElement.readyState}`);
  } else {
    log(`Metadata already available. readyState=${videoElement.readyState}`);
  }

  log(`Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);

  log('Calling play()...');
  try {
    await videoElement.play();
    log('play() succeeded');
  } catch (playErr) {
    log(`play() failed: ${playErr.name}: ${playErr.message}`);
    throw playErr;
  }

  return stream;
}

export function stopCamera(stream) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}
