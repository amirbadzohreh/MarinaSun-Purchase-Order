import { useRef, useEffect, useState } from 'react';
import { cn } from '../../utils/helpers';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  value?: string | null;
  height?: number;
  className?: string;
  disabled?: boolean;
}

export function SignaturePad({ 
  onSave, 
  value, 
  height = 150, 
  className, 
  disabled = false 
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);

  useEffect(() => {
    if (value) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setSignatureEmpty(false);
          };
          img.src = value;
        }
      }
    }
  }, [value]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        setSignatureEmpty(false);
      }
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1e293b';
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureEmpty(true);
        onSave('');
      }
    }
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        const displayWidth = parent.clientWidth;
        const displayHeight = height;
        
        // Set actual size in memory (scaled for retina)
        const scale = window.devicePixelRatio || 1;
        canvas.width = displayWidth * scale;
        canvas.height = displayHeight * scale;
        
        // Set display size
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        
        // Scale context
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(scale, scale);
        }
        
        // Redraw existing signature if any
        if (value) {
          const img = new Image();
          img.onload = () => {
            if (ctx) {
              ctx.clearRect(0, 0, displayWidth, displayHeight);
              ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
            }
          };
          img.src = value;
        }
      }
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [height, value]);

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        className="w-full border border-secondary-300 rounded-lg bg-white cursor-crosshair touch-none"
        style={{ height: `${height}px` }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {signatureEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-secondary-400 text-sm">اینجا امضا کنید</span>
        </div>
      )}
      {!signatureEmpty && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="absolute bottom-2 left-2 px-2 py-1 text-xs text-secondary-600 hover:text-danger-600 bg-white/80 backdrop-blur-sm rounded"
        >
          پاک کردن
        </button>
      )}
    </div>
  );
}