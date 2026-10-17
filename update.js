const versionUrl = new URL("version.json", import.meta.url);
const editor = document.querySelector("#exhibition-form");
let loadedRevision = null;
let nextRevision = null;
let checking = false;
let editorDirty = false;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("sw.js", import.meta.url), { updateViaCache: "none" }).catch(() => {});
}

editor?.addEventListener("input", () => { editorDirty = true; });
editor?.addEventListener("change", () => { editorDirty = true; });
editor?.addEventListener("click", event => {
  if (event.target.closest("#add-work, .choose-image, .clear-image, .image-library-grid, .remove-work")) editorDirty = true;
});
document.addEventListener("pickspot:editor-clean", () => {
  editorDirty = false;
  if (nextRevision) setTimeout(applyUpdate, 1000);
});

function busyVoting() {
  return Boolean(document.querySelector("#vote-confirm-dialog:not([hidden])")) ||
    [...document.querySelectorAll(".button-label")].some(label => label.textContent.includes("투표를 반영하고 있습니다"));
}

function applyUpdate() {
  if (!nextRevision || editorDirty) return;
  if (busyVoting()) {
    setTimeout(applyUpdate, 1500);
    return;
  }
  const url = new URL(location.href);
  url.searchParams.set("_build", nextRevision.slice(0, 12));
  location.replace(url.href);
}

function announceUpdate() {
  const banner = document.createElement("div");
  banner.className = "update-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.textContent = editorDirty
    ? "새로운 업데이트가 있습니다. 작업을 저장하면 자동으로 적용됩니다."
    : "새로운 업데이트가 있습니다. 최신 버전을 적용합니다.";
  document.body.append(banner);
  setTimeout(applyUpdate, 2500);
}

async function checkForUpdate() {
  if (checking || nextRevision || document.visibilityState === "hidden") return;
  checking = true;
  try {
    const url = new URL(versionUrl);
    url.searchParams.set("check", Date.now().toString());
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return;
    const { revision } = await response.json();
    if (!/^[a-f0-9]{40}$/.test(revision)) return;
    if (loadedRevision === null) loadedRevision = revision;
    else if (revision !== loadedRevision) {
      nextRevision = revision;
      announceUpdate();
    }
  } catch {
    // Retry when the connection returns or at the next scheduled check.
  } finally {
    checking = false;
  }
}

checkForUpdate();
setInterval(checkForUpdate, 60_000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdate(); });
window.addEventListener("pageshow", checkForUpdate);
window.addEventListener("online", checkForUpdate);
