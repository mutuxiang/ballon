// A cancelled permission request may resolve later. Never leave its camera on.
export function createCameraSession(mediaDevices, onEnded = () => {}) {
  let revision = 0;
  let stream = null;
  function stop() {
    revision++;
    const previous = stream;
    stream = null;
    previous?.getTracks().forEach(track => track.stop());
  }
  return {
    stop,
    async start() {
      stop();
      const request = revision;
      if (!mediaDevices?.getUserMedia) throw new Error('CAMERA_UNAVAILABLE');
      let next;
      try {
        next = await mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        });
      } catch (error) {
        if (request !== revision) return null;
        throw error;
      }
      if (request !== revision) {
        next.getTracks().forEach(track => track.stop());
        return null;
      }
      stream = next;
      next.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (stream !== next) return;
        stop();
        onEnded();
      }, { once: true }));
      return next;
    },
  };
}

export function cameraErrorMessage(error) {
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '摄像头未获授权，请允许相机权限后重试，或上传照片。';
  if (error.name === 'NotFoundError') return '没有找到摄像头，可以连接摄像头后重试，或上传照片。';
  if (error.name === 'NotReadableError' || error.name === 'AbortError') return '摄像头暂时无法使用，请关闭占用相机的应用后重试。';
  if (error.message === 'CAMERA_UNAVAILABLE') return '当前环境无法打开摄像头，请使用 localhost 或 HTTPS 页面，或上传照片。';
  return '摄像头未能启动，请重试，或上传照片。';
}
