import { useState } from 'react';

interface StageViewerProps {
  originalB64: string;
  maskB64: string | null;
  stageName: string;
}

export function StageViewer({ originalB64, maskB64, stageName }: StageViewerProps) {
  const [showMask, setShowMask] = useState(true);

  if (!maskB64) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-800 rounded-xl border border-gray-700 text-center">
        <p className="text-gray-400 mb-2">Mask data not available for this stage.</p>
        <p className="text-sm text-gray-500">Ensure the backend is running and supports this visualization mode.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
      <div className="flex bg-gray-800 p-1 mb-6 rounded-lg border border-gray-700 self-center">
        <button 
          onClick={() => setShowMask(true)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${showMask ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
        >
          {stageName} Overlay
        </button>
        <button 
          onClick={() => setShowMask(false)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${!showMask ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
        >
          Original Image
        </button>
      </div>

      <div className="relative w-full aspect-square md:aspect-auto md:h-[500px] flex justify-center bg-black rounded-xl overflow-hidden border border-gray-700 shadow-xl">
        {/* Original underlying image */}
        <img 
          src={`data:image/jpeg;base64,${originalB64}`} 
          alt="Original X-Ray" 
          className="absolute inset-0 w-full h-full object-contain"
        />
        {/* Mask Overlay */}
        <img 
          src={`data:image/png;base64,${maskB64}`} 
          alt={`${stageName} Mask`}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${showMask ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      
      <p className="text-xs text-gray-500 mt-3 text-center">
        {showMask ? 'Showing AI segmentation results overlaid on the original image.' : 'Showing preprocessed input image.'}
      </p>
    </div>
  );
}
