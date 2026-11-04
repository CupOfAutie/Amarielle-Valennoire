/* Amari app add-on (only in the installed app build, not in the claude.ai artifact).
   - registers the service worker (offline + updates)
   - adds an "App data" card at the end of the Traits tab: Back up to a file / Restore from a file
   Character data lives in localStorage under LSKEY; it is never touched by an app update. */
(function(){
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      /* check for a new version whenever the app comes back to the foreground */
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(()=>{}); });
    }).catch(()=>{});
  }
  /* ask the browser not to evict the saved character under storage pressure */
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch(e) {}

  const KEY = (typeof LSKEY === "string") ? LSKEY : "amari-sheet-v1";
  const EXTRA = ["amari.col", "amari.noteView", KEY + "-tab"];
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };

  function backup(){
    let sheet = null;
    try { sheet = JSON.parse(localStorage.getItem(KEY)); } catch(e) {}
    if (!sheet && typeof S === "object") sheet = S;
    const extras = {}; EXTRA.forEach(k => { try { const v = localStorage.getItem(k); if (v != null) extras[k] = v; } catch(e) {} });
    const blob = new Blob([JSON.stringify({app: "amari", format: 1, savedAt: new Date().toISOString(), sheet, extras}, null, 1)], {type: "application/json"});
    const name = `amari-backup-${stamp()}.json`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    if (typeof toastMsg === "function") toastMsg("Backup saved to Downloads: " + name);
  }

  function restore(file){
    const fr = new FileReader();
    fr.onload = () => {
      let d; try { d = JSON.parse(fr.result); } catch(e) { alert("This file isn't an Amari backup."); return; }
      /* accepts this app's backup file, or a bare sheet object */
      const sheet = d && d.app === "amari" ? d.sheet : d;
      if (!sheet || typeof sheet !== "object" || !("hp" in sheet) || !("used" in sheet)) { alert("This file isn't an Amari backup."); return; }
      const when = d.savedAt ? new Date(d.savedAt).toLocaleString() : "unknown date";
      if (!confirm(`Replace everything on this device with the backup from ${when}?\n\nHP ${sheet.hp}. This can't be undone, so back up first if you're unsure.`)) return;
      sheet._ts = Date.now();
      localStorage.setItem(KEY, JSON.stringify(sheet));
      if (d.extras) Object.entries(d.extras).forEach(([k, v]) => { if (EXTRA.includes(k)) try { localStorage.setItem(k, v); } catch(e) {} });
      location.reload();
    };
    fr.readAsText(file);
  }

  function card(){
    const pane = document.getElementById("pane-traits");
    if (!pane || pane.querySelector("#appData")) return;
    const c = document.createElement("div");
    c.className = "card span2"; c.id = "appData";
    c.innerHTML = `<div class="card-h"><h2>App data</h2></div>
      <p class="small muted" style="margin:0 0 8px">Everything is saved on this device only. Back up to a file before changing phones, or to move Amari to another device. Updates to the app never erase your data.</p>
      <div class="row"><button class="btn pri" id="bkSave">Back up to a file</button><button class="btn" id="bkLoad">Restore from a file</button>
      <input type="file" id="bkFile" accept="application/json,.json" hidden></div>`;
    pane.appendChild(c);
    c.querySelector("#bkSave").onclick = backup;
    c.querySelector("#bkLoad").onclick = () => c.querySelector("#bkFile").click();
    c.querySelector("#bkFile").onchange = e => { const f = e.target.files[0]; if (f) restore(f); e.target.value = ""; };
  }
  /* renderTraits rebuilds the pane, so add the card after each render */
  if (typeof renderTraits === "function") {
    const orig = renderTraits;
    window.renderTraits = function(){ const r = orig.apply(this, arguments); card(); return r; };
    try { renderTraits = window.renderTraits; } catch(e) {}
    if (typeof tab !== "undefined" && tab === "traits") card();
  }
})();
