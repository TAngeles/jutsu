import { useRef, useState, useEffect } from "react";
import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

const basicSeal = [{
  name: "horse",
  hand1: {},
  hand2: {},

}]

export function HandDetection() {

  type HandLandmarkerType = Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarkerType | undefined>(undefined);
  const [webcamRunning, setWebcamRunning] = useState<boolean>(false);
  const [runningMode, setRunningMode] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [lastVideoTime, setLastVideoTime] = useState(-1);
  const resultsRef = useRef<any>(undefined)

  useEffect(() => {
    const createHandLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
      );
      const handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: runningMode,
        numHands: 2
      });
      setHandLandmarker(handLandmarkerInstance);
    };
    createHandLandmarker();
  }, []);

  const enableCam = async () => {
    if (!handLandmarker) {
      console.log("Wait! objectDetector not loaded yet.");
      return;
    }

    if (webcamRunning) {
      // If webcam is running, disable it
      setWebcamRunning(false);
      // Stop the video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      // Clear the canvas
      const canvasCtx = canvasRef.current?.getContext("2d");
      if (canvasCtx && canvasRef.current) {
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      // If webcam is not running, enable it
      setWebcamRunning(true);
      const constraints = { video: true };
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // No need for onloadeddata here, predictWebcam will start in the requestAnimationFrame loop
          // once video is ready and webcamRunning is true.
        }
      } catch (err) {
        console.warn("getUserMedia() is not supported or permission denied.", err);
        setWebcamRunning(false); // Reset if stream fails
      }
    }

    const constraints = { video: true };
    try {
      const stream = await (navigator.mediaDevices as any).getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          predictWebcam();
        };
      }
    } catch (err) {
      console.warn("getUserMedia() is not supported or permission denied.", err);
    }
  };

  const predictWebcam = async () => {
    const video = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!video || !canvasElement || !handLandmarker) return;

    canvasElement.style.width = `${video.videoWidth}px`;
    canvasElement.style.height = `${video.videoHeight}px`;
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    if (runningMode === "IMAGE") {
      setRunningMode("VIDEO");
      await handLandmarker.setOptions({ runningMode: "VIDEO" });
    }
    const startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
      setLastVideoTime(video.currentTime);
      resultsRef.current = handLandmarker.detectForVideo(video, startTimeMs);
    }
    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;
    const drawingUtils = new DrawingUtils(canvasCtx);
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (resultsRef.current?.landmarks && resultsRef.current.landmarks.length > 0) {
      for (const landmarks of resultsRef.current.landmarks) {
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 5,});
        drawingUtils.drawLandmarks(landmarks);
      }
      predictSeal(resultsRef.current.landmarks);
    }
    canvasCtx.restore();

    if (webcamRunning) {
      globalThis.requestAnimationFrame(predictWebcam);
    }
  };

  const predictSeal = (hands: any) => {
    // Example logic to predict a seal based on hand landmarks
    const hand1 = hands[0];
    const hand2 = hands.length > 1 ? hands[1] : null;

    if (!hand1 || !hand2) {
      console.log("Both hands must be detected.");
      return;
    }

    const normalized_distance = (p1: any, p2: any) => {
      const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const palmSize = Math.hypot(hand1[5].x - hand1[17].x, hand1[5].y - hand1[17].y);
      return distance / palmSize;
    }

    const hand1Distance0 = normalized_distance(hand1[0], hand1[4]);
    const hand2Distance0 = normalized_distance(hand2[0], hand2[4]);
    const hand1Distance1 = normalized_distance(hand1[0], hand1[8]);
    const hand2Distance1 = normalized_distance(hand2[0], hand2[8]);
    const hand1Distance2 = normalized_distance(hand1[0], hand1[12]);
    const hand2Distance2 = normalized_distance(hand2[0], hand2[12]);
    const hand1Distance3 = normalized_distance(hand1[0], hand1[20]);
    const hand2Distance3 = normalized_distance(hand2[0], hand2[20]);
    
    console.log("Hand 1 Ratios:", hand1Distance0, hand1Distance1, hand1Distance2, hand1Distance3);
    console.log("Hand 2 Ratios:", hand2Distance0, hand2Distance1, hand2Distance2, hand2Distance3);
  }

  return (
    <main className="flex items-center justify-center pt-16 pb-4">
      <div className="flex-1 flex flex-col items-center gap-16 min-h-0">
        <header className="flex flex-col items-center gap-9">
          <h1 className="text-2xl font-bold">Hand Detection</h1>
        </header>
        <div className="max-w-[100vw] w-full space-y-6 px-4">
          <button className="max-w-full p-2 border-2 border-gray-300" onClick={enableCam}>
            {webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS"}
          </button>
          <div className="relative w-[640px] h-[480px] aspect-[16/9]">
            <video
              className="absolute left-0 top-0 w-full h-full object-cover"
              ref={videoRef}
              autoPlay
              playsInline
            />
            <canvas
              className="absolute left-0 top-0 w-full h-full pointer-events-none"
              ref={canvasRef}
              id="output_canvas"
            />
          </div>
          <p className="text-gray-700 dark:text-gray-200 text-center">
            This is a placeholder for the hand detection feature.
          </p>
        </div>
      </div>
    </main>
  );
}