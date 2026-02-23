export class ExportService {
    private mediaRecorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];

    async recordCanvas(canvasElement: HTMLCanvasElement, durationMs: number = 5000): Promise<Blob> {
        return new Promise((resolve) => {
            const stream = canvasElement.captureStream(30); // 30 FPS
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
            });

            this.chunks = [];
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.chunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                resolve(blob);
            };

            this.mediaRecorder.start();

            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.stop();
                }
            }, durationMs);
        });
    }

    downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

export const exportService = new ExportService();
