import { useEffect, useState } from 'react';
import { SRILabel } from '../types';

interface SRIGaugeProps {
  sri: number;
  label: SRILabel;
  note: string;
}

export function SRIGauge({ sri, label, note }: SRIGaugeProps) {
  const [needlePos, setNeedlePos] = useState(0);

  useEffect(() => {
    // Animate needle on mount
    const timer = setTimeout(() => {
      setNeedlePos(sri * 100);
    }, 100);
    return () => clearTimeout(timer);
  }, [sri]);

  const labelColors = {
    HIGH: 'bg-green-500 text-white',
    MEDIUM: 'bg-amber-500 text-gray-900',
    LOW: 'bg-red-500 text-white'
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-md h-4 bg-gray-700 rounded-full overflow-hidden mb-6 mt-4">
        {/* Color zones */}
        <div className="absolute left-0 top-0 h-full w-[40%] bg-red-500 opacity-80" />
        <div className="absolute left-[40%] top-0 h-full w-[30%] bg-amber-500 opacity-80" />
        <div className="absolute left-[70%] top-0 h-full w-[30%] bg-green-500 opacity-80" />
        
        {/* Needle */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 -ml-0.5"
          style={{ left: `${needlePos}%` }}
        >
          <div className="absolute -top-3 -left-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white" />
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="flex items-center space-x-3 mb-2">
          <span className="text-4xl font-bold font-mono text-white">{sri.toFixed(4)}</span>
          <span className={`px-3 py-1 rounded-full font-bold text-sm tracking-wider ${labelColors[label]}`}>
            {label}
          </span>
        </div>
        <p className="text-gray-400 italic text-sm text-center max-w-sm">
          {note}
        </p>
      </div>
    </div>
  );
}
