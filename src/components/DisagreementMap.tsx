interface DisagreementMapProps {
  base64: string;
}

export function DisagreementMap({ base64 }: DisagreementMapProps) {
  return (
    <div className="w-full flex justify-center py-4">
      <div className="relative group">
        <img 
          src={`data:image/jpeg;base64,${base64}`} 
          alt="Spatial Disagreement Map" 
          className="max-w-full h-auto max-h-[400px] rounded-lg shadow-lg border border-gray-700"
        />
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900/80 p-2 rounded text-xs text-white">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> High Disagreement</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-sm"></div> Medium Disagreement</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Low Disagreement</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-black border border-gray-500 rounded-sm"></div> Agreement / Background</div>
        </div>
      </div>
    </div>
  );
}
