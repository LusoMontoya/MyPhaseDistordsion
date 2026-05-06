/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useEffect, useRef, useState} from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  suffix?: string;
}

export function Knob({label, value, min, max, step = 0.01, onChange, suffix = ''}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const percentage = (value - min) / (max - min);
  const rotation = percentage * 270 - 135;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY.current - e.clientY;
      const sensitivity = 0.003;
      const range = max - min;
      const nextValue = Math.min(max, Math.max(min, startVal.current + deltaY * range * sensitivity));
      onChange(Number(nextValue.toFixed(2)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, max, min, onChange]);

  return (
    <div className="flex flex-col items-center gap-3 select-none group">
      <div className="knob-studio"
        onMouseDown={(e) => {
          setIsDragging(true);
          startY.current = e.clientY;
          startVal.current = value;
        }}
      >
        <div
          className="knob-pointer transition-transform duration-75"
          style={{transform: `rotate(${rotation}deg)`}}
        />
        <div className="absolute inset-2 rounded-full border border-white/10" />
      </div>
      
      <div className="flex flex-col items-center">
        <span className="panel-label mb-1">{label}</span>
        <div className="text-[10px] font-mono font-bold bg-black/10 px-1.5 py-0.5 rounded text-gray-700 border border-black/5">
          {value.toFixed(2)}{suffix}
        </div>
      </div>
    </div>
  );
}

export function VUMeter({analyser}: {analyser: AnalyserNode | null}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peak, setPeak] = useState(false);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const avg = sum / dataArray.length;
      const volume = avg / 128; 
      
      setPeak(volume > 0.85);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height + 30;
      const radius = canvas.height - 10;
      
      // Draw Scale Arc
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI * 0.78, -Math.PI * 0.22);
      ctx.stroke();

      // Tick marks and numbers
      const ticks = [
        {v: -20, label: '20'},
        {v: -10, label: '10'},
        {v: -7, label: '7'},
        {v: -5, label: '5'},
        {v: -3, label: '3'},
        {v: 0, label: '0', color: '#d00'},
        {v: 3, label: '3', color: '#d00'},
        {v: 6, label: '+', color: '#d00'}
      ];

      ticks.forEach((tick, i) => {
        const normalized = (tick.v + 20) / 26; // -20 to +6
        const angle = -Math.PI * 0.78 + (normalized * Math.PI * 0.56);
        
        ctx.strokeStyle = tick.color || '#000';
        ctx.fillStyle = tick.color || '#000';
        ctx.lineWidth = i >= 5 ? 2 : 1;

        const startR = radius - 8;
        const endR = radius + 2;
        
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * startR, centerY + Math.sin(angle) * startR);
        ctx.lineTo(centerX + Math.cos(angle) * endR, centerY + Math.sin(angle) * endR);
        ctx.stroke();

        ctx.font = 'bold 10px "Inter", sans-serif';
        const labelR = radius + 15;
        ctx.fillText(tick.label, centerX + Math.cos(angle) * labelR - 4, centerY + Math.sin(angle) * labelR);
      });

      // Special red arc for high range
      ctx.strokeStyle = '#d00';
      ctx.lineWidth = 4;
      const redStart = -Math.PI * 0.78 + ((20/26) * Math.PI * 0.56);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 5, redStart, -Math.PI * 0.22);
      ctx.stroke();

      // "VU" text
      ctx.font = '900 24px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('VU', centerX, canvas.height - 40);

      // TEAC / Serial text
      ctx.font = '500 8px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText('5206006101', 30, canvas.height - 10);
      ctx.fillText('TEAC', canvas.width - 30, canvas.height - 10);

      // Needle
      const needleAngle = -Math.PI * 0.78 + (Math.min(1.2, volume) * Math.PI * 0.56);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(needleAngle) * radius, centerY + Math.sin(needleAngle) * radius);
      ctx.stroke();
      
      // Center cap
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser]);

  return (
    <div className="vu-meter-glass w-56 h-36 flex items-end justify-center p-2">
      <canvas ref={canvasRef} width={224} height={144} className="w-full h-full" />
      
      {/* Peak LED */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
        <div className={`w-3.5 h-3.5 rounded-full border border-black/20 transition-all duration-75 ${peak ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]' : 'bg-red-900/30'}`} />
        <span className="text-[7px] font-bold text-black/40 uppercase">Peak</span>
      </div>

      <div className="absolute top-0 left-0 right-0 h-1 bg-black/5" />
    </div>
  );
}

interface VisualizerProps {
  analyser: AnalyserNode | null;
}

export function Visualizer({analyser}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0a0b0c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Digital Grid
      ctx.strokeStyle = '#1a2a3a';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00f2ff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0, 242, 255, 0.5)';

      const sliceWidth = canvas.width / 128; // Downsample for blocky look
      let x = 0;

      for (let i = 0; i < 128; i++) {
        const v = dataArray[i] / 255.0;
        const y = canvas.height - (v * canvas.height * 0.8);
        
        ctx.fillStyle = `rgba(0, 242, 255, ${v * 0.4})`;
        ctx.fillRect(x, y, sliceWidth - 1, canvas.height - y);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser]);

  return (
    <div className="relative w-full h-40 bg-black border-4 border-[#2a2b2e] rounded shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="absolute top-2 left-3 flex gap-4 font-mono text-[8px] text-cyan-500/50 uppercase tracking-widest z-10">
        <span>Channel A/B</span>
        <span>Resolution: High</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-full" width={800} height={160} />
    </div>
  );
}
