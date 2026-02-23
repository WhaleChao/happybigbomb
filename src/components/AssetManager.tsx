import React from 'react';
import { Plus } from 'lucide-react';

interface AssetManagerProps {
    onAddImage: (url: string) => void;
    onAddVideo: (url: string) => void;
}

const AssetManager: React.FC<AssetManagerProps> = ({ onAddImage, onAddVideo }) => {
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach((file) => {
            const url = URL.createObjectURL(file);
            if (file.type.startsWith('image/')) {
                onAddImage(url);
            } else if (file.type.startsWith('video/')) {
                onAddVideo(url);
            }
        });
    };

    return (
        <div className="asset-manager">
            <label className="upload-btn glass-morphism">
                <Plus size={24} />
                <span>Add Media</span>
                <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    hidden
                />
            </label>

            <div className="asset-grid">
                <p style={{ color: 'var(--secondary)', fontSize: '0.75rem', textAlign: 'center', marginTop: '12px' }}>
                    Supports Photos & Videos
                </p>
            </div>
        </div>
    );
};

export default AssetManager;
