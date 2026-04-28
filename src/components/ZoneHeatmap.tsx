interface ZoneHeatmapProps {
  zoneRatios: number[];
  threshold: number;
}

export function ZoneHeatmap({ zoneRatios, threshold }: ZoneHeatmapProps) {
  // L-Upper, L-Mid, L-Lower, R-Upper, R-Mid, R-Lower
  const labels = ["L-Upper", "L-Mid", "L-Lower", "R-Upper", "R-Mid", "R-Lower"];
  
  // Custom function to safely interpolate white to dark red
  const getFillColor = (ratio: number) => {
    // 0 -> rgb(255,255,255), 1 -> rgb(214, 39, 40)
    // r: 255 -> 214
    // g: 255 -> 39
    // b: 255 -> 40
    const r = Math.round(255 - ratio * (255 - 214));
    const g = Math.round(255 - ratio * (255 - 39));
    const b = Math.round(255 - ratio * (255 - 40));
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="w-full flex justify-center py-4">
      <svg viewBox="0 0 300 300" className="w-full max-w-sm drop-shadow-xl">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Left Lung */}
        <g transform="translate(40, 20)">
          {/* L-Upper */}
          <path 
            d="M 50,0 C 80,0 100,20 100,50 L 100,80 L 0,80 L 0,50 C 0,20 20,0 50,0 Z" 
            fill={getFillColor(zoneRatios[0])}
            stroke={zoneRatios[0] >= threshold ? "#ff4444" : "#6b7280"}
            strokeWidth={zoneRatios[0] >= threshold ? "4" : "1.5"}
            filter={zoneRatios[0] >= threshold ? "url(#glow)" : "none"}
          />
          <text x="50" y="45" textAnchor="middle" fill={zoneRatios[0] > 0.5 ? "white" : "black"} className="font-mono font-bold text-sm">{(zoneRatios[0]*100).toFixed(1)}%</text>
          <text x="50" y="65" textAnchor="middle" fill={zoneRatios[0] > 0.5 ? "#f3f4f6" : "#4b5563"} className="text-[10px]">L-Upper</text>

          {/* L-Mid */}
          <rect x="0" y="80" width="100" height="80" 
            fill={getFillColor(zoneRatios[1])}
            stroke={zoneRatios[1] >= threshold ? "#ff4444" : "#6b7280"}
            strokeWidth={zoneRatios[1] >= threshold ? "4" : "1.5"}
            filter={zoneRatios[1] >= threshold ? "url(#glow)" : "none"}
          />
          <text x="50" y="125" textAnchor="middle" fill={zoneRatios[1] > 0.5 ? "white" : "black"} className="font-mono font-bold text-sm">{(zoneRatios[1]*100).toFixed(1)}%</text>
          <text x="50" y="145" textAnchor="middle" fill={zoneRatios[1] > 0.5 ? "#f3f4f6" : "#4b5563"} className="text-[10px]">L-Mid</text>

          {/* L-Lower */}
          <path 
            d="M 0,160 L 100,160 L 100,220 C 100,250 80,260 50,260 C 20,260 0,250 0,220 Z" 
            fill={getFillColor(zoneRatios[2])}
            stroke={zoneRatios[2] >= threshold ? "#ff4444" : "#6b7280"}
            strokeWidth={zoneRatios[2] >= threshold ? "4" : "1.5"}
            filter={zoneRatios[2] >= threshold ? "url(#glow)" : "none"}
          />
          <text x="50" y="205" textAnchor="middle" fill={zoneRatios[2] > 0.5 ? "white" : "black"} className="font-mono font-bold text-sm">{(zoneRatios[2]*100).toFixed(1)}%</text>
          <text x="50" y="225" textAnchor="middle" fill={zoneRatios[2] > 0.5 ? "#f3f4f6" : "#4b5563"} className="text-[10px]">L-Lower</text>
        </g>

        {/* Right Lung (Mirrored structurally) */}
        <g transform="translate(160, 20)">
          {/* R-Upper */}
          <path 
            d="M 50,0 C 20,0 0,20 0,50 L 0,80 L 100,80 L 100,50 C 100,20 80,0 50,0 Z" 
            fill={getFillColor(zoneRatios[3])}
            stroke={zoneRatios[3] >= threshold ? "#ff4444" : "#6b7280"}
            strokeWidth={zoneRatios[3] >= threshold ? "4" : "1.5"}
            filter={zoneRatios[3] >= threshold ? "url(#glow)" : "none"}
          />
          <text x="50" y="45" textAnchor="middle" fill={zoneRatios[3] > 0.5 ? "white" : "black"} className="font-mono font-bold text-sm">{(zoneRatios[3]*100).toFixed(1)}%</text>
          <text x="50" y="65" textAnchor="middle" fill={zoneRatios[3] > 0.5 ? "#f3f4f6" : "#4b5563"} className="text-[10px]">R-Upper</text>

          {/* R-Mid */}
          <rect x="0" y="80" width="100" height="80" 
            fill={getFillColor(zoneRatios[4])}
            stroke={zoneRatios[4] >= threshold ? "#ff4444" : "#6b7280"}
            strokeWidth={zoneRatios[4] >= threshold ? "4" : "1.5"}
            filter={zoneRatios[4] >= threshold ? "url(#glow)" : "none"}
          />
          <text x="50" y="125" textAnchor="middle" fill={zoneRatios[4] > 0.5 ? "white" : "black"} className="font-mono font-bold text-sm">{(zoneRatios[4]*100).toFixed(1)}%</text>
          <text x="50" y="145" textAnchor="middle" fill={zoneRatios[4] > 0.5 ? "#f3f4f6" : "#4b5563"} className="text-[10px]">R-Mid</text>

          {/* R-Lower */}
          <path 
            d="M 0,160 L 100,160 L 100,220 C 100,250 80,260 50,260 C 20,260 0,250 0,220 Z" 
            fill={getFillColor(zoneRatios[5])}
            stroke={zoneRatios[5] >= threshold ? "#ff4444" : "#6b7280"}
            strokeWidth={zoneRatios[5] >= threshold ? "4" : "1.5"}
            filter={zoneRatios[5] >= threshold ? "url(#glow)" : "none"}
          />
          <text x="50" y="205" textAnchor="middle" fill={zoneRatios[5] > 0.5 ? "white" : "black"} className="font-mono font-bold text-sm">{(zoneRatios[5]*100).toFixed(1)}%</text>
          <text x="50" y="225" textAnchor="middle" fill={zoneRatios[5] > 0.5 ? "#f3f4f6" : "#4b5563"} className="text-[10px]">R-Lower</text>
        </g>
      </svg>
    </div>
  );
}
