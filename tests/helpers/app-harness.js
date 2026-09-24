const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { APP_SCRIPTS } = require("./app-scripts");

const root = path.join(__dirname, "..", "..");
const html = fs.readFileSync(path.join(root, "tavola.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const readScript = name => fs.readFileSync(path.join(root, name), "utf8");
const KEY = "chemmaster-4000-v1";
const PAGE_CODE = APP_SCRIPTS.map(readScript).join("\n");
// JSDOM non carica gli asset esterni senza un server: li inseriamo/valutiamo nel test.
const TEST_HTML = html.replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`);
// Il codice della pagina è strict-mode: let/const restano private all'eval.
// L'hook riesegue espressioni nello stesso scope lessicale per l'ispezione.
const HOOK = ";globalThis.__t={run:(s)=>eval(s)};";

async function createTestApp() {
  let pass = 0, fail = 0;
  const failures = [];
  function ok(cond, msg, extra) {
    if (cond) pass++;
    else { fail++; failures.push(msg + (extra ? " :: " + extra : "")); }
  }
  function section(title) { console.log("== " + title + " =="); }

  async function makeApp(seed, pageUrl = "http://localhost/tavola.html") {
    const errors = [];
    const dom = new JSDOM(TEST_HTML, {
      runScripts: "outside-only",
      url: pageUrl,
      beforeParse(w) {
        w.scrollTo = () => {};
        w.alert = m => { w.__lastAlert = m; };
        w.confirm = () => true;
        // jsdom+Bun: focus() lancia sull'EventTarget Window. Teniamo traccia della
        // richiesta senza renderizzarla davvero, così i test possono verificare il focus.
        w.__lastFocus = null;
        w.HTMLElement.prototype.focus = function () { w.__lastFocus = this; };
        if (seed) { try { w.localStorage.setItem(KEY, seed); } catch (_) {} }
      }
    });
    const win = dom.window;
    try {
      win.eval(PAGE_CODE + HOOK);
      await win.__appReadyPromise;
    } catch (error) {
      errors.push(String(error && error.stack || error));
    }
    win.__errors = errors;
    return win;
  }

  const ev = (win, code) => win.__t.run(code);
  const click = (win, el) => el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  const type = (win, el, value) => {
    el.value = value;
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  };
  // Restituisce l'evento (non il valore di dispatchEvent) per poterne leggere defaultPrevented.
  const keyOn = (win, el, init) => {
    const event = new win.KeyboardEvent("keydown", Object.assign({ bubbles: true, cancelable: true }, init));
    el.dispatchEvent(event);
    return event;
  };
  const key = (win, init) => keyOn(win, win.document, init);
  const view = (win, name) => [...win.document.querySelectorAll("#tabs button")]
    .find(button => button.dataset.view === name);
  const win = await makeApp();

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  return {
    KEY, html, css, appScripts: APP_SCRIPTS, win, d: win.document, makeApp, ev, click, type, keyOn, key, view, settle,
    ok, section,
    results: () => ({ pass, fail, failures: [...failures] })
  };
}

module.exports = { createTestApp };
