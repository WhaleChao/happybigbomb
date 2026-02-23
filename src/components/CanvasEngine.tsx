import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric';

interface CanvasEngineProps {
    onCanvasReady: (canvas: fabric.Canvas) => void;
}

const CanvasEngine: React.FC<CanvasEngineProps> = ({ onCanvasReady }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

    const handleResize = () => {
        if (!containerRef.current || !fabricCanvasRef.current) return;

        const container = containerRef.current;
        const canvas = fabricCanvasRef.current;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const scale = Math.min(
            containerWidth / 1080,
            containerHeight / 1920
        );

        const zoom = scale;
        canvas.setZoom(zoom);
        canvas.setDimensions({
            width: 1080 * zoom,
            height: 1920 * zoom,
        });
        canvas.renderAll();
    };

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        // Initialize Fabric Canvas
        const canvas = new fabric.Canvas(canvasRef.current, {
            width: 1080,
            height: 1920,
            backgroundColor: '#000000',
        });

        fabricCanvasRef.current = canvas;
        onCanvasReady(canvas);

        // Initial resize
        handleResize();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.dispose();
        };
    }, []);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden' }}>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

export default CanvasEngine;
