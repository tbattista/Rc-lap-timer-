function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export async function startCamera(videoElement, log = () => {}) {
  // iOS compatibility attributes
  videoElement.setAttribute('playsinline', '');
  videoElement.setAttribute('webkit-playsinline', '');
  videoElement.setAttribute('muted', '');
  videoElement.muted = true;
  videoElement.playsInline = true;

  // Try with back camera first, fall back to any camera
  const constraintsList = [
    {
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    },
    {
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let stream = null;
  for (let i = 0; i < constraintsList.length; i++) {
    const constraints = constraintsList[i];
    const label = i === 0 ? 'environment (exact)' : i === 1 ? 'environment (ideal)' : 'any camera';
    log(`Attempt ${i + 1}: getUserMedia with ${label}...`);
    try {
      stream = await withTimeout(
        navigator.mediaDevices.getUserMedia(constraints),
        8000,
        'getUserMedia'
      );
      const tracks = stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', ');
      log(`getUserMedia success! Tracks: ${tracks}`);
      break;
    } catch (err) {
      log(`Attempt ${i + 1} failed: ${err.name}: ${err.message}`);
      if (i === constraintsList.length - 1) {
        throw err;
      }
    }
  }

  log('Setting srcObject on video element...');
  videoElement.srcObject = stream;
  videoElement.load(); // iOS Safari needs explicit load() to start processing the stream
  log(`srcObject set. readyState=${videoElement.readyState}, networkState=${videoElement.networkState}`);

  // Wait for metadata with a timeout
  if (videoElement.readyState < 1) {
    log('readyState < 1, waiting for loadedmetadata (5s timeout)...');
    await withTimeout(
      new Promise((resolve) => {
        videoElement.addEventListener('loadedmetadata', resolve, { once: true });
      }),
      5000,
      'loadedmetadata'
    );
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

  // Force repaint on iOS WebKit to ensure video frames render
  if (videoElement.style) {
    videoElement.style.width = '99.99%';
    requestAnimationFrame(() => { videoElement.style.width = '100%'; });
  }

  return stream;
}

export function stopCamera(stream) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}
