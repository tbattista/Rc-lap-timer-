export async function startCamera(videoElement) {
  const constraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

export function stopCamera(stream) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}
