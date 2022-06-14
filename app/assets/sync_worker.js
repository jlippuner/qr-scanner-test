// { unique_id: { row: x, col: x, time: ..., ok: true/false}, ... }
var pending = {};

self.addEventListener("message", function (e) {
  const input = e.data;

  switch (input.cmd) {
    case "init":
      pending = input.pend;
      var int = this.setInterval(do_sync, 2000);
      break;
    case "api":
      var doc = new GoogleSpreadsheet(input.sid);
      doc.useApiKey(input.key);
      break;
    case "add":
      Object.assign(pending, input.sync);
      break;
    default:
      console.log("Unknown command for Sync worker.");
      break;
  }
});

function do_sync() {
  if (!navigator.onLine) {
    return;
  }

  for (const [id, s] of Object.entries(pending)) {
    console.log("Syncing ", id, " => ", s);
    try {
      // TODO

      // if we get here, we were successful
      delete pending[id];
      postMessage(id);
    } catch (ex) {

    }
  }
}
