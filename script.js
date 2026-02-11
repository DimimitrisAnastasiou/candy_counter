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

    video.addEventListener("loadeddata", () => {
        statusDiv.innerText = "Processing...";

        const frameWidth = video.videoWidth || video.width;
        const frameHeight = video.videoHeight || video.height;

        if (!frameWidth || !frameHeight) {
            statusDiv.innerText = "Video size error";
            statusDiv.style.color = "red";
            console.error("Invalid video dimensions", { frameWidth, frameHeight });
            return;
        }

        canvas.width = frameWidth;
        canvas.height = frameHeight;

        const cap = new cv.VideoCapture(video);
        const src = new cv.Mat(frameHeight, frameWidth, cv.CV_8UC4);
        const gray = new cv.Mat();
        const binary = new cv.Mat();
        const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));

        function process() {
            try {
                cap.read(src);

                if (src.empty()) {
                    requestAnimationFrame(process);
                    return;
                }

                // Color-agnostic detection: segment bright candy-like blobs from grayscale image.
                cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
                cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
                cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);

                const contours = new cv.MatVector();
                const hierarchy = new cv.Mat();

                cv.findContours(binary, contours, hierarchy,
                    cv.RETR_EXTERNAL,
                    cv.CHAIN_APPROX_SIMPLE);

                let count = 0;
                for (let i = 0; i < contours.size(); i++) {
                    const contour = contours.get(i);
                    const area = cv.contourArea(contour);
                    contour.delete();
                    if (area > 120 && area < 5000) {
                        count++;
                    }
                }

                contours.delete();
                hierarchy.delete();

                history.push(count);
                if (history.length > MAX_HISTORY) {
                    history.shift();
                }

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
    }, { once: true });
}
