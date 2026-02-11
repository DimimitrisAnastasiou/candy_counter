// script.js — robust candy counter (no dependency on cv.COLOR_* constants)
function startCandyCounter() {
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const statusDiv = document.getElementById("status");

    const history = [];
    const MAX_HISTORY = 15;

    statusDiv.innerText = "Starting camera...";

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            return video.play();
        })
        .catch(err => {
            statusDiv.innerText = "Camera error";
            statusDiv.style.color = "red";
            console.error("getUserMedia error:", err);
        });

    video.onloadedmetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;

        console.log("Video size:", width, height);

        if (!width || !height) {
            statusDiv.innerText = "Video size error";
            statusDiv.style.color = "red";
            return;
        }

        // Match canvas to camera resolution
        canvas.width = width;
        canvas.height = height;

        statusDiv.innerText = "Processing...";

        const cap = new cv.VideoCapture(video);

        const src = new cv.Mat(height, width, cv.CV_8UC4);
        const gray = new cv.Mat();
        const thresh = new cv.Mat();

        // helper: safe conversion to gray without relying on cv.COLOR_RGBA2GRAY constant
        function convertToGraySafely(srcMat, dstGray) {
            // If the built-in constant exists and is numeric, use cvtColor
            if (typeof cv.COLOR_RGBA2GRAY === 'number') {
                cv.cvtColor(srcMat, dstGray, cv.COLOR_RGBA2GRAY);
                return;
            }

            // fallback: split RGBA channels and compute weighted sum:
            // gray = 0.299*R + 0.587*G + 0.114*B
            const rgba = new cv.MatVector();
            try {
                cv.split(srcMat, rgba); // [R, G, B, A] for HTML video -> Mat
                const r = rgba.get(0);
                const g = rgba.get(1);
                const b = rgba.get(2);

                const tmp = new cv.Mat();
                // tmp = 0.299*R + 0.587*G
                cv.addWeighted(r, 0.299, g, 0.587, 0, tmp);
                // dstGray = tmp + 0.114*B
                cv.addWeighted(tmp, 1.0, b, 0.114, 0, dstGray);

                // cleanup
                tmp.delete();
                r.delete(); g.delete(); b.delete();
            } finally {
                rgba.delete();
            }
        }

        function process() {
            try {
                cap.read(src);

                // If frame not ready yet, skip
                if (src.empty() || src.cols === 0 || src.rows === 0) {
                    requestAnimationFrame(process);
                    return;
                }

                // Convert to grayscale (safe)
                convertToGraySafely(src, gray);

                // Binary threshold (Otsu)
                cv.threshold(
                    gray,
                    thresh,
                    0,
                    255,
                    cv.THRESH_BINARY + cv.THRESH_OTSU
                );

                // optional: morphological open to remove small noise
                // (uncomment if needed)
                // let M = cv.Mat.ones(3, 3, cv.CV_8U);
                // cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, M);
                // M.delete();

                // Find contours
                const contours = new cv.MatVector();
                const hierarchy = new cv.Mat();

                cv.findContours(
                    thresh,
                    contours,
                    hierarchy,
                    cv.RETR_EXTERNAL,
                    cv.CHAIN_APPROX_SIMPLE
                );

                let count = 0;
                for (let i = 0; i < contours.size(); i++) {
                    const contour = contours.get(i);
                    const area = cv.contourArea(contour);
                    contour.delete();

                    // Minimum size filter (tune if needed)
                    if (area > 200) count++;
                }

                contours.delete();
                hierarchy.delete();

                // Stability logic
                history.push(count);
                if (history.length > MAX_HISTORY) history.shift();

                let stable = false;
                if (history.length === MAX_HISTORY) {
                    const mean = history.reduce((a, b) => a + b, 0) / MAX_HISTORY;
                    const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / MAX_HISTORY;
                    stable = Math.sqrt(variance) < 1;
                }

                if (!stable) {
                    statusDiv.innerText = "MOVE TRAY";
                    statusDiv.style.color = "red";
                } else {
                    const sorted = [...history].sort((a, b) => a - b);
                    const median = sorted[Math.floor(MAX_HISTORY / 2)];
                    statusDiv.innerText = "Count: " + median;
                    statusDiv.style.color = "lime";
                }

                cv.imshow(canvas, src);
                requestAnimationFrame(process);

            } catch (err) {
                // More verbose console output to find which argument is undefined
                console.error("Processing exception:", err);
                statusDiv.innerText = "Processing error (see console)";
                statusDiv.style.color = "red";
            }
        }

        process();
    };
}
