import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Upload, Camera, RefreshCw, Shield } from 'lucide-react';

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
    <div className="h-screen w-screen bg-gradient-to-br from-indigo-100 to-blue-100 p-2 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full max-w-6xl max-h-screen flex flex-col">
        {/* Header - More compact */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="text-white h-5 w-5" />
            <h1 className="text-xl font-bold text-white">FaceGuard</h1>
          </div>
          <p className="text-blue-100 text-sm">Advanced Face Recognition</p>
        </div>

        {/* Main content area */}
        <div className="flex-1 bg-white p-3 flex gap-3 overflow-hidden">
          {/* Left side - Video feed */}
          <div className="w-3/5 flex flex-col gap-2">
            <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                onPlay={handleVideoPlay}
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />
              
              {/* Video controls overlay */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                <button
                  onClick={captureImage}
                  disabled={isProcessing || !modelsLoaded}
                  className="bg-white bg-opacity-20 backdrop-blur-md hover:bg-opacity-30 text-white rounded-full p-2 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Action buttons - Horizontal for space efficiency */}
            <div className="flex gap-2">
              <label className="flex-1">
                <div className="flex items-center justify-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded-md cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm text-sm">
                  <Upload className="h-4 w-4" />
                  <span>Upload Reference</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>

              {(referenceImage && capturedImage) && (
                <button
                  onClick={performFaceMatch}
                  disabled={isProcessing || !referenceDescriptor || !capturedDescriptor}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-md cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Shield className="h-4 w-4" />
                  <span>Compare</span>
                </button>
              )}

              {(referenceImage || capturedImage) && (
                <button
                  onClick={resetCapture}
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-gray-600 text-white rounded-md cursor-pointer hover:bg-gray-700 transition-colors shadow-sm text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Match result - Compact display */}
            {matchResult && (
              <div className={`p-2 rounded-md text-sm ${
                matchResult.includes('✅') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <pre className="font-semibold whitespace-pre-line">{matchResult}</pre>
              </div>
            )}

            {/* Loading indicator */}
            {!modelsLoaded && (
              <div className="p-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-md flex items-center text-sm">
                <div className="animate-spin mr-2 h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <p>Loading face recognition models...</p>
              </div>
            )}
          </div>

          {/* Right side - Image previews */}
          <div className="w-2/5 flex flex-col gap-2 h-full">
            {/* Reference image container */}
            <div className={`flex-1 bg-white rounded-md overflow-hidden border ${referenceImage ? 'border-indigo-200' : 'border-dashed border-gray-300'} p-2 transition-all duration-300`}>
              <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                <div className="bg-indigo-100 p-1 rounded-md mr-1">
                  <Upload className="h-3 w-3 text-indigo-600" />
                </div>
                Reference Image
              </h2>
              
              {referenceImage ? (
                <div className="rounded-md overflow-hidden bg-gray-100 h-full">
                  <img
                    src={referenceImage}
                    alt="Reference"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-full rounded-md bg-gray-50 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 text-sm">
                  <p>No reference image</p>
                </div>
              )}
            </div>

            {/* Captured image container */}
            <div className={`flex-1 bg-white rounded-md overflow-hidden border ${capturedImage ? 'border-emerald-200' : 'border-dashed border-gray-300'} p-2 transition-all duration-300`}>
              <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                <div className="bg-emerald-100 p-1 rounded-md mr-1">
                  <Camera className="h-3 w-3 text-emerald-600" />
                </div>
                Captured Image
              </h2>
              
              {capturedImage ? (
                <div className="rounded-md overflow-hidden bg-gray-100 h-full">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-full rounded-md bg-gray-50 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 text-sm">
                  <p>No image captured</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 py-1 px-4 text-center text-gray-500 text-xs rounded-b-lg">
          <p>Secure Face Recognition System • Powered by face-api.js</p>
        </div>
      </div>
    </div>
  );
}

export default App;