window.addEventListener('DOMContentLoaded', function () {
    if (!('mediaDevices' in navigator &&
        'getUserMedia' in navigator.mediaDevices &&
        'Worker' in window)) {
        alert('Sorry, your browser is not compatible with this app.');
        return;
    }

    // html elements
    const snapshotCanvas = document.getElementById('snapshot');
    const snapshotContext = snapshotCanvas.getContext('2d');
    const video = document.getElementById('camera');
    const overlay = document.getElementById('snapshotLimitOverlay');
    const flipCameraButton = document.getElementById("flipCamera");
    const res_name = document.getElementById('res_name');
    const res_entry = document.getElementById('res_entry');

    var curr_result = '';

    // init QRCode Web Worker
    const qrcodeWorker = new Worker("assets/qrcode_worker.js");
    qrcodeWorker.postMessage({cmd: 'init'});
    qrcodeWorker.addEventListener('message', showResult);

    let snapshotSquare;
    function calculateSquare() {
        // get square of snapshot in the video
        let snapshotSize = overlay.offsetWidth;
        snapshotSquare = {
            'x': ~~((video.videoWidth - snapshotSize)/2),
            'y': ~~((video.videoHeight - snapshotSize)/2),
            'size': ~~(snapshotSize)
        };

        snapshotCanvas.width = snapshotSquare.size;
        snapshotCanvas.height = snapshotSquare.size;
    }

    function scanCode(wasSuccess) {
        setTimeout(function() {
            if (flipCameraButton.disabled) {
                // terminate this loop
                return;
            }

            // capture current snapshot
            snapshotContext.drawImage(video, snapshotSquare.x, snapshotSquare.y, snapshotSquare.size, snapshotSquare.size, 0, 0, snapshotSquare.size, snapshotSquare.size);
            const imageData = snapshotContext.getImageData(0, 0, snapshotSquare.size, snapshotSquare.size);

            // scan for QRCode
            qrcodeWorker.postMessage({
                cmd: 'process',
                width: snapshotSquare.size,
                height: snapshotSquare.size,
                imageData: imageData
            });
        }, wasSuccess ? 2000 : 120);
    }

    function showResult (e) {
        const res = e.data;

        // open a dialog with the result if found
        if (res !== false) {
            // vibrate only if new result
            if (res != curr_result) {
                // vibration is not supported on Edge, IE, Opera and Safari
                navigator.vibrate(200);
                curr_result = res;
                res_name.innerText = res;
            }
        }

        scanCode();
    }

    // init video stream
    let currentDeviceId;
    function initVideoStream () {
        let config = {
            audio: false,
            video: {}
        };
        config.video = currentDeviceId ? {deviceId: currentDeviceId} : {facingMode: "environment"};

        stopStream();

        navigator.mediaDevices.getUserMedia(config).then(function (stream) {
            document.getElementById('about').style.display = 'none';

            video.srcObject = stream;
            video.oncanplay = function() {
                flipCameraButton.disabled = false;
                calculateSquare();
                scanCode();
            };
        }).catch(function (error) {
            alert(error.name + ": " + error.message);
        });
    }
    initVideoStream();

    function stopStream() {
        if (video.srcObject) {
            video.srcObject.getTracks()[0].stop();
        }
    }

    // listen for optimizedResize
    window.addEventListener("optimizedResize", calculateSquare);

    // add flip camera button if necessary
    navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
        devices = devices.filter(function (device) {
            return device.kind === 'videoinput';
        });

        if (devices.length > 1) {
            // add a flip camera button
            flipCameraButton.style.display = "block";

            currentDeviceId = devices[0].deviceId; // no way to know current MediaStream's device id so arbitrarily choose the first

            flipCameraButton.addEventListener('click', function() {
                let targetDevice;
                for (let i = 0; i < devices.length; i++) {
                    if (devices[i].deviceId === currentDeviceId) {
                        targetDevice = (i + 1 < devices.length) ? devices[i+1] : devices[0];
                        break;
                    }
                }
                currentDeviceId = targetDevice.deviceId;

                initVideoStream();
            });
        }
    });

    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            stopStream();
        } else {
            initVideoStream();
        }
    });
});

// listen for resize event
(function() {
    let throttle = function(type, name, obj) {
        obj = obj || window;
        let running = false;
        let func = function() {
            if (running) { return; }
            running = true;
            requestAnimationFrame(function() {
                obj.dispatchEvent(new CustomEvent(name));
                running = false;
            });
        };
        obj.addEventListener(type, func);
    };

    /* init - you can init any event */
    throttle("resize", "optimizedResize");
})();
