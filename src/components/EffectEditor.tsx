import React, { useEffect, useState } from 'react';
import * as fabric from 'fabric';

interface EffectEditorProps {
    canvas: fabric.Canvas | null;
}

const EffectEditor: React.FC<EffectEditorProps> = ({ canvas }) => {
    const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
    const [brightness, setBrightness] = useState(0);
    const [contrast, setContrast] = useState(0);
    const [blur, setBlur] = useState(0);

    useEffect(() => {
        if (!canvas) return;

        const handleSelection = () => {
            const activeObject = canvas.getActiveObject();
            if (activeObject && activeObject instanceof fabric.FabricImage) {
                setSelectedObject(activeObject);
                // Reset or load existing filters
                setBrightness(0);
                setContrast(0);
                setBlur(0);
            } else {
                setSelectedObject(null);
            }
        };

        canvas.on('selection:created', handleSelection);
        canvas.on('selection:updated', handleSelection);
        canvas.on('selection:cleared', () => setSelectedObject(null));

        return () => {
            canvas.off('selection:created', handleSelection);
            canvas.off('selection:updated', handleSelection);
            canvas.off('selection:cleared');
        };
    }, [canvas]);

    const applyFilters = () => {
        if (!selectedObject || !(selectedObject instanceof fabric.FabricImage) || !canvas) return;

        const filters: any[] = [];

        if (brightness !== 0) {
            filters.push(new fabric.filters.Brightness({ brightness: brightness / 100 }));
        }
        if (contrast !== 0) {
            filters.push(new fabric.filters.Contrast({ contrast: contrast / 100 }));
        }
        if (blur !== 0) {
            filters.push(new fabric.filters.Blur({ blur: blur / 100 }));
        }

        selectedObject.filters = filters;
        selectedObject.applyFilters();
        canvas.renderAll();
    };

    useEffect(() => {
        applyFilters();
    }, [brightness, contrast, blur]);

    if (!selectedObject) {
        return (
            <div className="effect-editor empty">
                <p>Select an image to adjust effects.</p>
            </div>
        );
    }

    return (
        <div className="effect-editor">
            <div className="control-group">
                <label>Brightness</label>
                <input
                    type="range" min="-100" max="100" value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                />
            </div>
            <div className="control-group">
                <label>Contrast</label>
                <input
                    type="range" min="-100" max="100" value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                />
            </div>
            <div className="control-group">
                <label>Blur</label>
                <input
                    type="range" min="0" max="100" value={blur}
                    onChange={(e) => setBlur(parseInt(e.target.value))}
                />
            </div>
        </div>
    );
};

export default EffectEditor;
