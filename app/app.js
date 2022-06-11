const { GoogleSpreadsheet } = require("google-spreadsheet");

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
  var doc = new GoogleSpreadsheet();
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

    active =
      !loading &&
      doc_inited &&
      sheet_id != null &&
      api_key != null &&
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

  // create Google Sheets API
  function make_sheet_api() {
    if (sheet_id == null || api_key == null) {
      doc_inited = false;
      return;
    }

    try {
      doc = new GoogleSpreadsheet(sheet_id);
      doc.useApiKey(api_key);
      doc_inited = true;
    } catch (ex) {
      console.log("make_sheet_api: ", ex);
      doc_inited = false;
    }
  }

  // local storage
  var sheet_id = this.localStorage.getItem("sheet_id");
  var api_key = this.localStorage.getItem("api_key");

  function load_json(key) {
    let val = localStorage.getItem(key);
    if (val != null) {
      return JSON.parse(val);
    } else {
      return null;
    }
  }

  function store_json(key, obj) {
    let val = JSON.stringify(obj);
    localStorage.setItem(key, val);
  }

  // { id: {col=x, name='...', start=..., end=...}, ... }
  var events = load_json("events");
  for (const [id, e] of Object.entries(events)) {
    events[id].start = new Date(e.start);
    events[id].end = new Date(e.end);
  }

  // { id: {row=x, name='...', tickets=... }, ... }
  var people = load_json("people");

  // TBD
  var unsent = load_json("unsent");

  // global vars (not cached)
  var curr_result = "";

  make_sheet_api();
  update_ui(false);

  // init QRCode Web Worker
  const qrcodeWorker = new Worker("assets/qrcode_worker.js");
  qrcodeWorker.postMessage({ cmd: "init" });
  qrcodeWorker.addEventListener("message", process_qr);

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
        if (res.startsWith('{"api":')) {
          try {
            const j = JSON.parse(res);
            sid = j["doc"];
            key = j["api"];

            if (sid === undefined && key === undefined) {
              throw "Invalid config";
            }
            api_key = key;
            sheet_id = sid;
          } catch (ex) {
            api_key = null;
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
    (async function () {
      try {
        make_sheet_api();

        if (!doc_inited) {
          throw "Failed to create Sheets API";
        }

        await doc.loadInfo();
        const evs = await doc.sheetsByTitle["Events"].getRows();
        const reg_sheet = doc.sheetsByTitle["Registrants"];
        const ps = await reg_sheet.getRows();

        // map header to column index in registrant sheet
        let reg_cols = {};
        for (let i = 0; i < reg_sheet.columnCount; i++) {
          reg_cols[reg_sheet.headerValues[i]] = i;
        }

        // read events
        events = {};
        const parse_date = function (str) {
          const fs = str.split(/[-: ]/);
          if (fs.length != 6) {
            throw "Could not parse date string: " + str;
          }
          const d = new Date(fs[0], fs[1] - 1, fs[2], fs[3], fs[4], fs[5]);
          if (d.toString() == "Invalid Date") {
            throw "Invalid date string: " + str;
          }
          return d;
        };

        for (let i = 0; i < evs.length; i++) {
          e = evs[i];
          let c = -1;
          if (e.name in reg_cols) {
            c = reg_cols[e.name];
          } else {
            continue;
          }
          events[e.id] = {
            col: c,
            name: e.name,
            start: parse_date(e.start),
            end: parse_date(e.end),
          };
        }
        console.log(events);

        // read people
        people = {};
        for (let i = 0; i < ps.length; i++) {
          p = ps[i];
          people[p.id] = {
            row: i,
            name: p.first + " " + p.last,
            tickets: p.tickets,
          };
        }
        console.log(people);
      } catch (ex) {
        console.log("Exception in load_config: ", ex);
        sheet_id = null;
        api_key = null;
        doc_inited = false;
        events = {};
        people = {};
      }

      localStorage.setItem("sheet_id", sheet_id);
      localStorage.setItem("api_key", api_key);
      store_json("events", events);
      store_json("people", people);
    })().then(function () {
      update_ui(false);
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

    if (!(id in people)) {
      // this person doesn't exist
      set_res(red, "UNKNOWN PERSON", "Please reload");
    } else {
      // we know this person
      p = people[id];
      const allowed = (p.tickets & (1 << event_id)) > 0;
      set_res(
        allowed ? green : red,
        p.name,
        "Entry " + (allowed ? "OK" : "DENIED")
      );

      // TODO record result in sheet
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
      ? { deviceId: currentDeviceId }
      : { facingMode: "environment" };

    stopStream();

    navigator.mediaDevices
      .getUserMedia(config)
      .then(function (stream) {
        document.getElementById("about").style.display = "none";

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
