// Copy a decoded video frame synchronously before stopping its media tracks.
// Avoid createImageBitmap(video), whose asynchronous decode can stall on cameras.
export function captureFrame(video, createCanvas = () => document.createElement('canvas')) {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('相机画面尚未准备好，请稍等片刻再拍。');
  }
  const canvas = createCanvas();
  const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法读取画面，请重新开启相机。');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}
