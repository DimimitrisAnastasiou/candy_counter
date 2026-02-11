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
            console.error(err);
        });

    // Wait until real resolution is known
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
        const hsv = new cv.Mat();
        const mask = new cv.Mat();

        const lowerYellow = new cv.Scalar(20, 100, 100, 0);
        const upperYellow = new cv.Scalar(35, 255, 255, 255);

        function process() {
            try {
                cap.read(src);

                // Safety check (prevents cvtColor crash)
                if (src.empty()) {
                    requestAnimationFrame(process);
                    return;
                }

                cv.cvtColor(src, hsv, cv.COLOR_RGBA2HSV);
                cv.inRange(hsv, lowerYellow, upperYellow, mask);

                const contours = new cv.MatVector();
                const hierarchy = new cv.Mat();

                cv.findContours(
                    mask,
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
                    if (area > 300) count++;
                }

                contours.delete();
                hierarchy.delete();

                // Stability history
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

                    if (median === 60) {
                        statusDiv.innerText = "OK";
                        statusDiv.style.color = "lime";
                    } else {
                        statusDiv.innerText = "Count: " + median;
                        statusDiv.style.color = "red";
                    }
                }

                cv.imshow(canvas, src);
                requestAnimationFrame(process);

            } catch (err) {
                statusDiv.innerText = "Processing error (see console)";
                statusDiv.style.color = "red";
                console.error(err);
            }
        }

        process();
    };
}
