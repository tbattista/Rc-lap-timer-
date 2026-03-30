import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startCamera, stopCamera } from '../utils/camera';

// Mock video element that simulates browser behavior
function createMockVideo() {
  const listeners = {};
  return {
    setAttribute: vi.fn(),
    addEventListener: vi.fn((event, handler, opts) => {
      listeners[event] = handler;
    }),
    removeEventListener: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    load: vi.fn(),
    muted: false,
    playsInline: false,
    readyState: 0,
    networkState: 0,
    videoWidth: 640,
    videoHeight: 480,
    srcObject: null,
    _listeners: listeners,
    _fireEvent(name) {
      if (listeners[name]) listeners[name]();
    },
  };
}

function createMockStream() {
  return {
    getTracks: () => [
      { kind: 'video', readyState: 'live', stop: vi.fn(), getSettings: () => ({ width: 640, height: 480 }) },
    ],
  };
}

describe('startCamera', () => {
  let mockVideo;
  let mockStream;

  beforeEach(() => {
    mockVideo = createMockVideo();
    mockStream = createMockStream();

    // Mock getUserMedia
    global.navigator = {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
      },
    };
  });

  it('should set iOS compatibility attributes', async () => {
    // Simulate metadata already loaded
    mockVideo.readyState = 1;

    await startCamera(mockVideo);

    expect(mockVideo.setAttribute).toHaveBeenCalledWith('playsinline', '');
    expect(mockVideo.setAttribute).toHaveBeenCalledWith('webkit-playsinline', '');
    expect(mockVideo.setAttribute).toHaveBeenCalledWith('muted', '');
    expect(mockVideo.muted).toBe(true);
    expect(mockVideo.playsInline).toBe(true);
  });

  it('should try environment camera first', async () => {
    mockVideo.readyState = 1;

    await startCamera(mockVideo);

    const firstCall = navigator.mediaDevices.getUserMedia.mock.calls[0][0];
    expect(firstCall.video.facingMode).toBe('environment');
    expect(firstCall.audio).toBe(false);
  });

  it('should fall back to ideal environment, then any camera', async () => {
    mockVideo.readyState = 1;

    // Fail first two attempts
    navigator.mediaDevices.getUserMedia
      .mockRejectedValueOnce(new Error('NotReadableError'))
      .mockRejectedValueOnce(new Error('OverconstrainedError'))
      .mockResolvedValueOnce(mockStream);

    await startCamera(mockVideo);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(3);
    // Third call should be { video: true }
    const thirdCall = navigator.mediaDevices.getUserMedia.mock.calls[2][0];
    expect(thirdCall.video).toBe(true);
  });

  it('should set srcObject on the video element', async () => {
    mockVideo.readyState = 1;

    await startCamera(mockVideo);

    expect(mockVideo.srcObject).toBe(mockStream);
  });

  it('should call video.load() for iOS compatibility', async () => {
    mockVideo.readyState = 1;

    await startCamera(mockVideo);

    expect(mockVideo.load).toHaveBeenCalled();
  });

  it('should wait for loadedmetadata when readyState < 1', async () => {
    mockVideo.readyState = 0;

    const promise = startCamera(mockVideo);

    // Simulate metadata load after a tick
    await new Promise(r => setTimeout(r, 10));
    mockVideo.readyState = 1;
    mockVideo._fireEvent('loadedmetadata');

    await promise;

    expect(mockVideo.addEventListener).toHaveBeenCalledWith(
      'loadedmetadata',
      expect.any(Function),
      { once: true }
    );
  });

  it('should call video.play()', async () => {
    mockVideo.readyState = 1;

    await startCamera(mockVideo);

    expect(mockVideo.play).toHaveBeenCalled();
  });

  it('should return the stream', async () => {
    mockVideo.readyState = 1;

    const result = await startCamera(mockVideo);

    expect(result).toBe(mockStream);
  });

  it('should throw when all getUserMedia attempts fail', async () => {
    mockVideo.readyState = 1;

    const error = new DOMException('Not allowed', 'NotAllowedError');
    navigator.mediaDevices.getUserMedia.mockRejectedValue(error);

    await expect(startCamera(mockVideo)).rejects.toThrow();
  });

  it('should throw when play() fails', async () => {
    mockVideo.readyState = 1;
    mockVideo.play.mockRejectedValue(new DOMException('Autoplay blocked', 'NotAllowedError'));

    await expect(startCamera(mockVideo)).rejects.toThrow('Autoplay blocked');
  });

  it('should log each step when log function provided', async () => {
    mockVideo.readyState = 1;
    const logFn = vi.fn();

    await startCamera(mockVideo, logFn);

    const messages = logFn.mock.calls.map(c => c[0]);
    expect(messages.some(m => m.includes('getUserMedia'))).toBe(true);
    expect(messages.some(m => m.includes('srcObject'))).toBe(true);
    expect(messages.some(m => m.includes('play()'))).toBe(true);
  });
});

describe('stopCamera', () => {
  it('should stop all tracks on the stream', () => {
    const stopFn = vi.fn();
    const stream = {
      getTracks: () => [
        { stop: stopFn },
        { stop: stopFn },
      ],
    };

    stopCamera(stream);

    expect(stopFn).toHaveBeenCalledTimes(2);
  });

  it('should handle null stream gracefully', () => {
    expect(() => stopCamera(null)).not.toThrow();
  });

  it('should handle undefined stream gracefully', () => {
    expect(() => stopCamera(undefined)).not.toThrow();
  });
});
