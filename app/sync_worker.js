const { GoogleSpreadsheet } = require("google-spreadsheet");

// { unique_id: { row: x, col: x, time: ..., ok: true/false}, ... }
var pending = {};
var doc = new GoogleSpreadsheet();
var doc_inited = false;

self.addEventListener("message", function (e) {
  const input = e.data;

  switch (input.cmd) {
    case "init":
      pending = input.pend;
      var int = this.setInterval(do_sync, 2000);
      break;
    case "add":
      Object.assign(pending, input.sync);
      break;
    case "make_api":
      doc_inited = make_sheet_api(input.sid, input.key);
      this.postMessage({ msg: "doc_inited", data: doc_inited });
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
function make_sheet_api(sheet_id, api_key) {
  if (sheet_id == null || api_key == null) {
    return false;
  }

  try {
    doc = new GoogleSpreadsheet(sheet_id);
    doc.useApiKey(api_key);
    return true;
  } catch (ex) {
    console.log("make_sheet_api: ", ex);
    return false;
  }
}

function load_config(sheet_id, api_key) {
  let events = {};
  let people = {};
  let success = false;

  (async function () {
    try {
      doc_inited = make_sheet_api(sheet_id, api_key);
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

function do_sync() {
  if (!navigator.onLine || !doc_inited) {
    return;
  }

  for (const [id, s] of Object.entries(pending)) {
    console.log("Syncing ", id, " => ", s);
    try {
      // TODO

      // if we get here, we were successful
      delete pending[id];
      postMessage({ msg: "sync_done", data: id });
    } catch (ex) {}
  }
}
