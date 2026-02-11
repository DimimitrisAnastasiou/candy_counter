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
            console.error(err);
        });

    video.onloadedmetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;

        canvas.width = width;
        canvas.height = height;

        statusDiv.innerText = "Processing...";

        const cap = new cv.VideoCapture(video);

        const src = new cv.Mat(height, width, cv.CV_8UC4);
        const gray = new cv.Mat();
        const thresh = new cv.Mat();

        function process() {
            try {
                cap.read(src);

                // If frame not ready yet, skip
                if (src.empty() || src.cols === 0 || src.rows === 0) {
                    requestAnimationFrame(process);
                    return;
                }

                // Convert to grayscale
                cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                // Binary threshold (auto)
                cv.threshold(
                    gray,
                    thresh,
                    0,
                    255,
                    cv.THRESH_BINARY + cv.THRESH_OTSU
                );

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

                    // Minimum size filter
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
                statusDiv.innerText = "Processing error (see console)";
                console.error(err);
            }
        }

        process();
    };
}
