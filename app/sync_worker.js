const { GoogleSpreadsheet } = require("google-spreadsheet");
const { base64DecToArr } = require("./assets/crypto_util");

const encrypted_key =
  "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";

// { unique_id: { row: x, col: x, time: ..., ok: true/false}, ... }
var pending = {};
var doc = new GoogleSpreadsheet();
var doc_inited = false;

self.addEventListener("message", function (e) {
  const input = e.data;

  switch (input.cmd) {
    case "init":
      pending = input.pend;
      var int = this.setInterval(do_sync, 5000);
      break;
    case "add":
      Object.assign(pending, input.sync);
      break;
    case "make_api":
      make_sheet_api(input.sid, input.key).then(function () {
        this.postMessage({ msg: "doc_inited", data: doc_inited });
      });
      break;
    case "load_config":
      load_config(input.sid, input.key);
      break;
    default:
      console.log("Unknown command for Sync worker: ", input.cmd);
      break;
  }
});

// create Google Sheets API
async function make_sheet_api(sheet_id, key) {
  if (sheet_id == null || key == null) {
    doc_inited = false;
    return;
  }

  try {
    doc = new GoogleSpreadsheet(sheet_id);

    // decrypt the key file
    const key_arr = base64DecToArr(key.key, 32);
    const iv = base64DecToArr(key.iv, 12);
    var k = await crypto.subtle.importKey(
      "raw",
      key_arr,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const cipher = base64DecToArr(encrypted_key, 1);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      k,
      cipher
    );

    let dec = new TextDecoder();
    const creds = JSON.parse(dec.decode(plain));

    doc.useServiceAccountAuth(creds);
    doc_inited = true;
  } catch (ex) {
    console.log("make_sheet_api: ", ex);
    doc_inited = false;
  }
}

function load_config(sheet_id, key) {
  let events = {};
  let people = {};
  let success = false;

  (async function () {
    try {
      await make_sheet_api(sheet_id, key);
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
          row: i + 1,
          name: p.first + " " + p.last,
          tickets: p.tickets,
        };
      }
      console.log(people);
      success = true;
    } catch (ex) {
      console.log("Exception in load_config: ", ex);
      events = {};
      people = {};
      success = false;
      doc_inited = false;
    }
  })().then(function () {
    postMessage({ msg: "config_loaded", ev: events, ppl: people, ok: success });
  });
}

// from https://italonascimento.github.io/applying-a-timeout-to-your-promises/
function promiseTimeout(ms, promise) {
  // Create a promise that rejects in <ms> milliseconds
  let timeout = new Promise((resolve, reject) => {
    let id = setTimeout(() => {
      clearTimeout(id);
      reject("Timed out in " + ms + "ms.");
    }, ms);
  });

  // Returns a race between our timeout and the passed in promise
  return Promise.race([promise, timeout]);
}

async function do_sync_impl(id) {
  try {
    // check if doc is loaded
    try {
      const num = doc.sheetCount;
    } catch (ex) {
      await doc.loadInfo();
    }

    const dat = pending[id];
    const sheet = doc.sheetsByTitle["Registrants"];
    await sheet.loadCells({
      startRowIndex: dat.row,
      endRowIndex: dat.row + 1,
      startColumnIndex: dat.col,
      endColumnIndex: dat.col + 1,
    });

    let c = sheet.getCell(dat.row, dat.col);
    c.value = (dat.ok ? "OK" : "DENIED") + " " + dat.time;
    sheet.saveUpdatedCells();
    return true;
  } catch (ex) {
    console.log("Doing sync for id ", id, " failed: ", ex);
    return false;
  }
}

function do_sync() {
  if (!navigator.onLine || !doc_inited) {
    return;
  }

  for (const [id, s] of Object.entries(pending)) {
    console.log("Syncing ", id, " => ", s);

    promiseTimeout(3000, do_sync_impl(id)).then((ok) => {
      if (ok) {
        delete pending[id];
        postMessage({ msg: "sync_done", data: id });
      }
    });
  }
}
