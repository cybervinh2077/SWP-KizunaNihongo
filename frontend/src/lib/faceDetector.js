// MediaPipe Tasks Vision — tải động từ CDN (dùng chung cho thi giám sát + trang test).
const MP_VERSION = '0.10.18';
const MP_BASE    = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// Tạo FaceDetector ở chế độ VIDEO. Ném lỗi nếu CDN/model tải thất bại — caller tự xử lý.
export async function loadFaceDetector() {
  const vision  = await import(/* @vite-ignore */ `${MP_BASE}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  return vision.FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  });
}
