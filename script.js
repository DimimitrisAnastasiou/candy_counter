const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusDiv = document.getElementById("status");

const history = [];
const MAX_HISTORY = 15;

navigator.mediaDevices.getUserMedia({ video: true })
.then(stream => {
    video.srcObject = stream;
});

video.addEventListener("loadeddata", () => {
    const cap = new cv.VideoCapture(video);
    const src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    const hsv = new cv.Mat();
    const mask = new cv.Mat();

    function process() {
        cap.read(src);
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2HSV);

        let lowerYellow = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20,100,100,0]);
        let upperYellow = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35,255,255,255]);
        cv.inRange(hsv, lowerYellow, upperYellow, mask);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();

        cv.findContours(mask, contours, hierarchy,
                        cv.RETR_EXTERNAL,
                        cv.CHAIN_APPROX_SIMPLE);

        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
            let area = cv.contourArea(contours.get(i));
            if (area > 300) count++;
        }

        history.push(count);
        if (history.length > MAX_HISTORY)
            history.shift();

        let stable = false;
        if (history.length === MAX_HISTORY) {
            let mean = history.reduce((a,b)=>a+b)/MAX_HISTORY;
            let variance = history.reduce((a,b)=>a+(b-mean)**2,0)/MAX_HISTORY;
            if (Math.sqrt(variance) < 1)
                stable = true;
        }

        if (!stable) {
            statusDiv.innerText = "MOVE TRAY";
            statusDiv.style.color = "red";
        } else {
            let median = history.slice().sort()[Math.floor(MAX_HISTORY/2)];
            if (median === 60) {
                statusDiv.innerText = "OK";
                statusDiv.style.color = "lime";
            } else {
                statusDiv.innerText = "Count: " + median;
                statusDiv.style.color = "red";
            }
        }

        cv.imshow("canvas", src);
        requestAnimationFrame(process);
    }

    process();
});
