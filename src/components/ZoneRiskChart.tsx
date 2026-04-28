import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ErrorBar, ReferenceLine } from 'recharts';

interface ZoneRiskChartProps {
  zoneRatios: number[];
  zoneMeanRef: number[] | null;
  zoneStdRef: number[] | null;
  zoneStd: number[] | null; // For ensemble standard deviation
  threshold: number;
}

export function ZoneRiskChart({ zoneRatios, zoneMeanRef, zoneStdRef, zoneStd, threshold }: ZoneRiskChartProps) {
  const labels = ["L-Up", "L-Mid", "L-Low", "R-Up", "R-Mid", "R-Low"];
  
  const data = zoneRatios.map((ratio, i) => {
    const item: any = {
      name: labels[i],
      Current: ratio,
    };
    
    // Add reference population data if available
    if (zoneMeanRef && zoneStdRef && zoneMeanRef.length > i && zoneStdRef.length > i) {
      item.PopMean = zoneMeanRef[i];
      // Error bars in Recharts expect [min, max] relative to the value, but for simple charts
      // it's easier to just show the value and let ErrorBar use dataKey
      item.PopError = zoneStdRef[i];
    }

    // Add ensemble std if available
    if (zoneStd && zoneStd.length > i) {
      item.EnsStd = zoneStd[i];
    }
    
    return item;
  });

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: -20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 1]} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
          <RechartsTooltip 
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem' }}
            itemStyle={{ color: '#e5e7eb' }}
            formatter={(value: number, name: string) => [`${(value * 100).toFixed(1)}%`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          
          <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: `Threshold (${(threshold*100).toFixed(0)}%)`, fill: '#ef4444', fontSize: 10 }} />
          
          <Bar dataKey="Current" fill="#818cf8" radius={[4, 4, 0, 0]}>
            {zoneStd && <ErrorBar dataKey="EnsStd" width={4} strokeWidth={2} stroke="#c7d2fe" direction="y" />}
          </Bar>
          
          {zoneMeanRef && (
            <Bar dataKey="PopMean" fill="#4b5563" radius={[4, 4, 0, 0]}>
              <ErrorBar dataKey="PopError" width={4} strokeWidth={2} stroke="#9ca3af" direction="y" />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
