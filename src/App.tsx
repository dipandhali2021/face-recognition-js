import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Upload, Camera, RefreshCw } from 'lucide-react';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceDescriptor, setReferenceDescriptor] = useState<Float32Array | null>(null);
  const [matchResult, setMatchResult] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
        console.log('Models loaded successfully');
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        videoRef.current!.srcObject = stream;
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    };

    startVideo();
  }, []);

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const displaySize = {
      width: video.videoWidth,
      height: video.videoHeight
    };
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !modelsLoaded) return;

    try {
      // Create a URL for the uploaded file
      const imageUrl = URL.createObjectURL(file);
      setReferenceImage(imageUrl);

      // Create an HTML image element
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = imageUrl;
      });

      const detections = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections) {
        setReferenceDescriptor(detections.descriptor);
        console.log('Reference face descriptor extracted');
      } else {
        console.error('No face detected in the reference image');
        setMatchResult('No face detected in the uploaded image');
      }

      // Clean up the object URL
      URL.revokeObjectURL(imageUrl);
    } catch (error) {
      console.error('Error processing reference image:', error);
      setMatchResult('Error processing the image');
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;

    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = canvas.toDataURL('image/jpeg');
      });
      
      setCapturedImage(img.src);

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        setCapturedDescriptor(detection.descriptor);
        console.log('Captured face descriptor extracted');
      } else {
        console.error('No face detected in captured image');
        setMatchResult('No face detected in captured image');
      }
    } catch (error) {
      console.error('Error processing captured image:', error);
      setMatchResult('Error processing the captured image');
    } finally {
      setIsProcessing(false);
    }
  };

  const performFaceMatch = () => {
    if (!referenceDescriptor || !capturedDescriptor) {
      setMatchResult('Please ensure both images have detected faces');
      return;
    }

    const distance = faceapi.euclideanDistance(referenceDescriptor, capturedDescriptor);
    const similarity = Math.max(0, Math.min(100, (1 - distance) * 100));
    const matchThreshold = 0.5;
    
    setMatchResult(
      `Match Result: ${similarity.toFixed(2)}% similar\n` +
      `${distance < matchThreshold ? '✅ Face Match Found!' : '❌ No Match Found'}`
    );
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setReferenceImage(null);
    setReferenceDescriptor(null);
    setCapturedDescriptor(null);
    setMatchResult('');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Face Recognition System</h1>
          
          <div className="flex gap-4 mb-6">
            <label className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
              <Upload className="mr-2" />
              Upload Reference Image
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </label>

            <button
              onClick={captureImage}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg cursor-pointer hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="mr-2" />
              Capture Current Frame
            </button>

            {(referenceImage && capturedImage) && (
              <button
                onClick={performFaceMatch}
                disabled={isProcessing || !referenceDescriptor || !capturedDescriptor}
                className="inline-flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg cursor-pointer hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare Faces
              </button>
            )}

            {(referenceImage || capturedImage) && (
              <button
                onClick={resetCapture}
                className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg cursor-pointer hover:bg-red-600 transition-colors"
              >
                <RefreshCw className="mr-2" />
                Reset
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {referenceImage && (
              <div>
                <h2 className="text-xl font-semibold mb-2">Reference Image:</h2>
                <img
                  src={referenceImage}
                  alt="Reference"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            )}

            {capturedImage && (
              <div>
                <h2 className="text-xl font-semibold mb-2">Captured Image:</h2>
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            )}
          </div>

          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              onPlay={handleVideoPlay}
              className="rounded-lg shadow-md"
              style={{ width: '100%', maxWidth: '720px' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 rounded-lg"
              style={{ width: '100%', maxWidth: '720px' }}
            />
          </div>

          {matchResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              matchResult.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <pre className="text-lg font-semibold whitespace-pre-line">{matchResult}</pre>
            </div>
          )}

          {!modelsLoaded && (
            <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded-lg">
              <p>Loading face recognition models...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;