// components/ChartRenderer.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface ChartRendererProps {
  type: 'bar' | 'line' | 'radial' | 'progress';
  data: number[];
  labels: string[];
  colors?: string[];
  height?: number;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  type,
  data,
  labels,
  colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
  height = 200
}) => {
  const maxValue = Math.max(...data);

  if (type === 'bar') {
    return (
      <div className="chart-container" style={{ height: `${height}px` }}>
        <div className="flex items-end h-full space-x-2">
          {data.map((value, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(value / maxValue) * 100}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
                className="w-full"
                style={{
                  backgroundColor: colors[index % colors.length],
                  borderRadius: '4px 4px 0 0'
                }}
              />
              <div className="text-center text-xs text-gray-500 mt-1">
                {labels[index]}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'progress') {
    return (
      <div className="relative" style={{ height: `${height}px` }}>
        <div className="absolute inset-0 flex items-center">
          {data.map((value, index) => (
            <motion.div
              key={index}
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              transition={{ duration: 1, delay: index * 0.2 }}
              className="h-3 rounded-full mr-2 last:mr-0"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
};
