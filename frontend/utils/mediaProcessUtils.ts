// frontend/utils/mediaProcessUtils.ts
export const isVideoUrl = (url: string) => {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.webm') || clean.endsWith('.m4v');
};

export const extractFramesFromVideo = (videoFile: File, frameCount: number = 3): Promise<File[]> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const videoUrl = URL.createObjectURL(videoFile);
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;

        const extractedFiles: File[] = [];

        video.onloadedmetadata = async () => {
            const duration = video.duration || 1;
            const interval = duration / (frameCount + 1);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            for (let i = 1; i <= frameCount; i++) {
                const seekTime = interval * i;
                video.currentTime = seekTime;
                await new Promise((r) => {
                    video.onseeked = r;
                });

                const maxDim = 1024;
                let width = video.videoWidth || 640;
                let height = video.videoHeight || 360;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                if (ctx) {
                    ctx.drawImage(video, 0, 0, width, height);
                    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
                    if (blob) {
                        const frameFile = new File(
                            [blob],
                            `${videoFile.name.replace(/\.[^/.]+$/, '')}_frame_${i}.jpg`,
                            { type: 'image/jpeg' },
                        );
                        extractedFiles.push(frameFile);
                    }
                }
            }

            URL.revokeObjectURL(videoUrl);
            resolve(extractedFiles);
        };

        video.onerror = () => {
            URL.revokeObjectURL(videoUrl);
            resolve([]);
        };
    });
};

export const compressImageForAnalysis = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.onload = () => {
                const maxDim = 1024;
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve({
                        base64: (event.target?.result as string).split(',')[1],
                        mimeType: file.type || 'image/jpeg',
                    });
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                resolve({
                    base64: compressedDataUrl.split(',')[1],
                    mimeType: 'image/jpeg',
                });
            };
            img.onerror = reject;
            img.src = event.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};
