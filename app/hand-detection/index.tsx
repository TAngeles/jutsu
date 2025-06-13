import { useRef, useState, useEffect } from "react";
import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

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
      setWebcamRunning(false);
      return;
    } else {
      setWebcamRunning(true);
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
    if (resultsRef.current?.landmarks) {
      for (const landmarks of resultsRef.current.landmarks) {
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS);
        drawingUtils.drawLandmarks(landmarks);
      }
      console.log(resultsRef.current.landmarks);
    }
    canvasCtx.restore();

    if (webcamRunning) {
      globalThis.requestAnimationFrame(predictWebcam);
    }
  };

  useEffect(() => {
    const setCanvasDimensions = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };

    if (videoRef.current) {
      videoRef.current.onloadedmetadata = setCanvasDimensions;
    }

    // Cleanup
    return () => {
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = null;
      }
    };
  }, []);

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