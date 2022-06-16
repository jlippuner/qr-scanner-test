function load_json(key) {
  let val = localStorage.getItem(key);
  if (val != null) {
    return JSON.parse(val);
  } else {
    return {};
  }
}

function store_json(key, obj) {
  let val = JSON.stringify(obj);
  localStorage.setItem(key, val);
}

// pinch zoom implementation based on
// https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures

var pinch_prev_dist = -1;
var pinch_ev_cache = new Array();

function pointerdown_handler(ev) {
  // console.log("pointer down: ", ev);
  // The pointerdown event signals the start of a touch interaction.
  // This event is cached to support 2-finger gestures
  pinch_ev_cache.push(ev);
}

function pointermove_handler(ev) {
  // console.log("pointer move: ", ev);
  // This function implements a 2-pointer horizontal pinch/zoom gesture.
  //
  // If the distance between the two pointers has increased (zoom in),
  // the target element's background is changed to "pink" and if the
  // distance is decreasing (zoom out), the color is changed to "lightblue".
  //
  // This function sets the target element's border to "dashed" to visually
  // indicate the pointer's target received a move event.

  // Find this event in the cache and update its record with this event
  for (var i = 0; i < pinch_ev_cache.length; i++) {
    if (ev.pointerId == pinch_ev_cache[i].pointerId) {
      pinch_ev_cache[i] = ev;
      break;
    }
  }

  // If two pointers are down, check for pinch gestures
  if (pinch_ev_cache.length == 2) {
    // Calculate the distance between the two pointers
    const dx = pinch_ev_cache[0].clientX - pinch_ev_cache[1].clientX;
    const dy = pinch_ev_cache[0].clientY - pinch_ev_cache[1].clientY;
    const curDiff = Math.sqrt(dx * dx + dy * dy);

    if (pinch_prev_dist > 0) {
      if (curDiff > pinch_prev_dist) {
        // The distance between the two pointers has increased
        current_zoom += zoom_step;
      }
      if (curDiff < pinch_prev_dist) {
        // The distance between the two pointers has decreased
        current_zoom -= zoom_step;
      }
      apply_zoom();
    }

    // Cache the distance for the next move event
    pinch_prev_dist = curDiff;
  }
}

function pointerup_handler(ev) {
  // console.log("pointer up: ", ev);
  // Remove this pointer from the cache
  for (var i = 0; i < pinch_ev_cache.length; i++) {
    if (pinch_ev_cache[i].pointerId == ev.pointerId) {
      pinch_ev_cache.splice(i, 1);
      break;
    }
  }

  // If the number of pointers down is less than two then reset diff tracker
  if (pinch_ev_cache.length < 2) {
    pinch_prev_dist = -1;
  }
}

var video_track = null;
var zoom_step = 0.0;
var current_zoom = 1.5; // start at 1.5x

function apply_zoom() {
  const capabilities = video_track.getCapabilities();
  try {
    zoom_step = capabilities.zoom.step / 6;
    current_zoom = Math.min(
      capabilities.zoom.max,
      Math.max(capabilities.zoom.min, current_zoom)
    );
    video_track.applyConstraints({ advanced: [{ zoom: current_zoom }] });
    this.document.getElementById("zoom_val").innerText =
      "Zoom: " + current_zoom.toFixed(1) + "x";
  } catch (ex) {
    console.log("Zoom not supported: ", ex);
  }
}

window.addEventListener("DOMContentLoaded", function () {
  if (
    !(
      "mediaDevices" in navigator &&
      "getUserMedia" in navigator.mediaDevices &&
      "Worker" in window
    )
  ) {
    alert("Sorry, your browser is not compatible with this app.");
    return;
  }

  // html elements
  const snapshotCanvas = this.document.getElementById("snapshot");
  const snapshotContext = snapshotCanvas.getContext("2d");
  const video = this.document.getElementById("camera");
  const zoom = this.document.getElementById("zoom_overlay");
  const overlay = this.document.getElementById("snapshotLimitOverlay");
  const flipCameraButton = this.document.getElementById("flipCamera");
  const reloadButton = this.document.getElementById("reload");

  reloadButton.addEventListener("click", function () {
    curr_result = null;
    load_config();
  });

  const board = this.document.getElementById("board");
  const event_sel = this.document.getElementById("event");
  const res_cont = this.document.getElementById("res_cont");
  const access_cont = this.document.getElementById("access_cont");
  const access_req = this.document.getElementById("access_req");
  const res_name = this.document.getElementById("res_name");
  const res_entry = this.document.getElementById("res_entry");
  const tosync = this.document.getElementById("tosync");

  function set_res(color, name, entry) {
    board.style.backgroundColor = color;
    res_name.innerText = name;
    res_entry.innerText = entry;
  }

  event_sel.addEventListener("change", function () {
    curr_result = null;
    set_res(gray, "", "");
  });

  const gray = "#ccc";
  const green = "#40c040";
  const red = "#e04040";

  var doc_inited = false;
  var loading = false;
  var active = false;

  function update_ui(is_loading) {
    board.style.backgroundColor = gray;
    loading = is_loading;
    access_req.innerHTML = loading
      ? "Loading..."
      : "Please scan<br>access QR code";

    res_name.innerText = "";
    res_entry.innerText = "";

    update_num_sync();

    active =
      !loading &&
      doc_inited &&
      sheet_id != null &&
      key != null &&
      Object.keys(events).length > 0 &&
      Object.keys(people).length > 0;

    res_cont.style.display = active ? "flex" : "none";
    access_cont.style.display = active ? "none" : "flex";

    reloadButton.disabled = !active;

    if (active) {
      // event selector, first remove all but first, then add events
      for (let i = event_sel.options.length - 1; i > 0; i--) {
        event_sel.remove(i);
      }
      const now = new Date();
      let current = "undefined";
      for (const [id, e] of Object.entries(events)) {
        let op = document.createElement("option");
        op.text = e.name;
        op.value = id;

        if (e.end < now) {
          op.classList.add("past");
          op.text += " ~ PAST";
        } else if (e.start <= now && e.end > now) {
          op.classList.add("current");
          current = id;
          op.text += " ~ NOW";
        } else {
          op.text += " ~ FUTURE";
        }

        event_sel.add(op);
      }

      event_sel.value = current;
    }
  }

  // local storage
  var sheet_id = this.localStorage.getItem("sheet_id");
  var curr_sheet_id = sheet_id;
  var key = load_json("key");

  // { id: {col=x, name='...', start=..., end=...}, ... }
  var events = load_json("events");
  for (const [id, e] of Object.entries(events)) {
    events[id].start = new Date(e.start);
    events[id].end = new Date(e.end);
  }

  // { id: {row=x, name='...', tickets=... }, ... }
  var people = load_json("people");

  // unique id is a unique identifier (using Date.now())
  // { unique_id: { row: x, col: x, time: ..., ok: true/false}, ... }
  var pending = load_json("pending");
  if (pending == null) {
    pending = {};
  }

  function update_num_sync() {
    tosync.innerText = "To sync: " + Object.keys(pending).length;
  }

  // global vars (not cached)
  var curr_result = "";

  // init QRCode Web Worker
  const qrcodeWorker = new Worker("assets/qrcode_worker.js");
  qrcodeWorker.postMessage({ cmd: "init" });
  qrcodeWorker.addEventListener("message", process_qr);

  // init Sync Web Worker
  const sync_worker = new Worker("assets/sync_worker.js");
  sync_worker.addEventListener("message", process_sync_msg);
  sync_worker.postMessage({ cmd: "init", pend: pending });

  function process_sync_msg(e) {
    const input = e.data;

    switch (input.msg) {
      case "doc_inited":
        doc_inited = input.data;
        update_ui(false);
        break;
      case "config_loaded":
        doc_inited = input.ok;
        events = input.ev;
        people = input.ppl;

        if (!doc_inited) {
          sheet_id = null;
          key = null;
          pending = {};
          store_json("pending", pending);
        }

        localStorage.setItem("sheet_id", sheet_id);
        store_json("key", key);
        store_json("events", events);
        store_json("people", people);

        // if this is a different sheet, clear the pending results
        if (curr_sheet_id != sheet_id) {
          pending = {};
          store_json("pending", pending);
          curr_sheet_id = sheet_id;
        }

        update_ui(false);
        break;
      case "sync_done":
        const id = input.data;
        if (id in pending) {
          delete pending[id];
        }
        store_json("pending", pending);
        update_num_sync();
        break;
      default:
        console.log("Unknown msg from sync worker: ", input.msg);
        break;
    }
  }

  sync_worker.postMessage({ cmd: "make_api", sid: sheet_id, key: key });

  let snapshotSquare;
  function calculateSquare() {
    // get square of snapshot in the video
    let snapshotSize = overlay.offsetWidth;
    snapshotSquare = {
      x: ~~((video.videoWidth - snapshotSize) / 2),
      y: ~~((video.videoHeight - snapshotSize) / 2),
      size: ~~snapshotSize,
    };

    snapshotCanvas.width = snapshotSquare.size;
    snapshotCanvas.height = snapshotSquare.size;
  }

  function scanCode(wasSuccess) {
    setTimeout(
      function () {
        if (flipCameraButton.disabled) {
          // terminate this loop
          return;
        }

        // capture current snapshot
        snapshotContext.drawImage(
          video,
          snapshotSquare.x,
          snapshotSquare.y,
          snapshotSquare.size,
          snapshotSquare.size,
          0,
          0,
          snapshotSquare.size,
          snapshotSquare.size
        );
        const imageData = snapshotContext.getImageData(
          0,
          0,
          snapshotSquare.size,
          snapshotSquare.size
        );

        // scan for QRCode
        qrcodeWorker.postMessage({
          cmd: "process",
          width: snapshotSquare.size,
          height: snapshotSquare.size,
          imageData: imageData,
        });
      },
      wasSuccess ? 2000 : 120
    );
  }

  function process_qr(e) {
    const res = e.data;

    // open a dialog with the result if found
    if (!loading && res !== false) {
      // vibrate only if new result
      if (res != curr_result) {
        // vibration is not supported on Edge, IE, Opera and Safari
        navigator.vibrate(200);
        curr_result = res;

        // decide what to do with the result
        if (res.startsWith('{"key":')) {
          try {
            const j = JSON.parse(res);
            sid = j["doc"];
            k = j["key"];
            kiv = j["iv"];

            if (sid === undefined || k === undefined || kiv === undefined) {
              throw "Invalid config";
            }

            key = { key: k, iv: kiv };
            sheet_id = sid;
          } catch (ex) {
            key = null;
            sheet_id = null;
          }
          load_config();
        } else {
          process_signin(res);
        }
      }

      scanCode(true);
    } else {
      scanCode(false);
    }
  }

  function load_config() {
    update_ui(true);
    sync_worker.postMessage({
      cmd: "load_config",
      sid: sheet_id,
      key: key,
    });
  }

  function set_res(color, name, entry) {
    board.style.backgroundColor = color;
    res_name.innerText = name;
    res_entry.innerText = entry;
  }

  function process_signin(dat) {
    if (!active) {
      return;
    }

    // get id
    let id = null;
    if (dat.startsWith("ID:")) {
      id = dat.substring(3);
    } else if (dat.startsWith("MECARD:")) {
      const pos = dat.indexOf(";;ID:");
      if (pos > 0) {
        id = dat.substring(pos + 5);
      }
    }

    if (id == null) {
      return;
    }

    // get event
    if (event_sel.value == "undefined") {
      set_res(red, "SELECT EVENT", "");
      return;
    }
    const event_id = parseInt(event_sel.value);
    const event = events[event_id];

    let allowed = false;

    if (!(id in people)) {
      // this person doesn't exist
      set_res(red, "UNKNOWN PERSON", "Please reload");
    } else {
      // we know this person
      p = people[id];
      allowed = (p.tickets & (1 << event_id)) > 0;
      set_res(
        allowed ? green : red,
        p.name,
        "Entry " + (allowed ? "OK" : "DENIED")
      );

      const p0 = (num, places) => String(num).padStart(places, "0");
      const n = new Date();
      const now_str =
        p0(n.getFullYear(), 4) +
        "-" +
        p0(n.getMonth() + 1, 2) +
        "-" +
        p0(n.getDate(), 2) +
        " " +
        p0(n.getHours(), 2) +
        ":" +
        p0(n.getMinutes(), 2) +
        ":" +
        p0(n.getSeconds(), 2) +
        "." +
        p0(n.getMilliseconds(), 3);

      const sid = Date.now();
      let sync = {};
      sync[sid] = {
        row: p.row,
        col: event.col,
        time: now_str,
        ok: allowed,
      };

      sync_worker.postMessage({
        cmd: "add",
        sync: sync,
      });
      Object.assign(pending, sync);
      store_json("pending", pending);
      update_num_sync();
    }
  }

  // init video stream
  let currentDeviceId;
  function initVideoStream() {
    let config = {
      audio: false,
      video: {},
    };
    config.video = currentDeviceId
      ? { zoom: true, deviceId: currentDeviceId }
      : { zoom: true, facingMode: "environment" };

    stopStream();

    navigator.mediaDevices
      .getUserMedia(config)
      .then(function (stream) {
        document.getElementById("about").style.display = "none";

        video_track = stream.getVideoTracks()[0];
        const settings = video_track.getSettings();

        // Check whether zoom is supported or not.
        if (!("zoom" in settings)) {
          console.log("Zoom is not supported by " + video_track.label);
        } else {
          // Install event handlers for the pointer target
          zoom.addEventListener("pointerdown", pointerdown_handler);
          zoom.addEventListener("pointermove", pointermove_handler);

          // Use same handler for pointer{up,cancel,out,leave} events since
          // the semantics for these events - in this app - are the same.
          zoom.addEventListener("pointerup", pointerup_handler);
          zoom.addEventListener("pointercancel", pointerup_handler);
          zoom.addEventListener("pointerout", pointerup_handler);
          zoom.addEventListener("pointerleave", pointerup_handler);

          apply_zoom();
        }

        video.srcObject = stream;
        video.oncanplay = function () {
          flipCameraButton.disabled = false;
          calculateSquare();
          scanCode();
        };
      })
      .catch(function (error) {
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
  navigator.mediaDevices.enumerateDevices().then(function (devices) {
    devices = devices.filter(function (device) {
      return device.kind === "videoinput";
    });

    if (devices.length > 1) {
      // add a flip camera button
      flipCameraButton.style.display = "block";

      currentDeviceId = devices[0].deviceId; // no way to know current MediaStream's device id so arbitrarily choose the first

      flipCameraButton.addEventListener("click", function () {
        let targetDevice;
        for (let i = 0; i < devices.length; i++) {
          if (devices[i].deviceId === currentDeviceId) {
            targetDevice = i + 1 < devices.length ? devices[i + 1] : devices[0];
            break;
          }
        }
        currentDeviceId = targetDevice.deviceId;

        initVideoStream();
      });
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopStream();
    } else {
      initVideoStream();
    }
  });
});

// listen for resize event
(function () {
  let throttle = function (type, name, obj) {
    obj = obj || window;
    let running = false;
    let func = function () {
      if (running) {
        return;
      }
      running = true;
      requestAnimationFrame(function () {
        obj.dispatchEvent(new CustomEvent(name));
        running = false;
      });
    };
    obj.addEventListener(type, func);
  };

  /* init - you can init any event */
  throttle("resize", "optimizedResize");
})();
