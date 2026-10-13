import { isDemo, onAdminState, signInAdmin, signOutAdmin, subscribeExhibitions, createExhibition, closeExhibition } from "./data.js";

const loginPanel = document.querySelector("#login-panel");
const workspace = document.querySelector("#admin-workspace");
const message = document.querySelector("#admin-message");
const list = document.querySelector("#admin-exhibitions");
const fields = document.querySelector("#work-fields");
const form = document.querySelector("#exhibition-form");
let exhibitions = {};
let authorized = false;
let imageLibrary = [];

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const announce = text => { message.textContent = text; };
const shareUrl = id => new URL(`index.html#/e/${encodeURIComponent(id)}`, location.href).href;

function addWork() {
  const row = document.createElement("div");
  row.className = "work-field";
  row.innerHTML = `<div class="work-field-head"><strong>작품 ${String(fields.children.length + 1).padStart(2, "0")}</strong><button class="remove-work" type="button" aria-label="작품 삭제">삭제</button></div><div class="work-field-grid"><label>작품 제목<input name="workTitle" required maxlength="80" placeholder="작품 제목"></label><label>작품 설명<textarea name="workDescription" required maxlength="500" rows="2" placeholder="작품을 소개하는 문장"></textarea></label><div class="work-image-field"><span>작품 이미지 (선택)</span><input name="workImage" type="hidden"><button class="admin-secondary choose-image" type="button" aria-expanded="false">라이브러리에서 선택</button><div class="selected-image" aria-live="polite">선택한 이미지 없음</div><div class="image-library" hidden></div></div></div>`;
  row.querySelector(".remove-work").addEventListener("click", () => {
    if (fields.children.length === 1) { announce("작품은 최소 1개 필요합니다."); return; }
    row.remove();
    [...fields.children].forEach((field, index) => field.querySelector(".work-field-head strong").textContent = `작품 ${String(index + 1).padStart(2, "0")}`);
  });
  row.querySelector(".choose-image").addEventListener("click", event => {
    const panel = row.querySelector(".image-library");
    panel.hidden = !panel.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  });
  row.querySelector(".image-library").addEventListener("click", event => {
    const option = event.target.closest("[data-image-index]");
    if (!option) return;
    const image = imageLibrary[Number(option.dataset.imageIndex)];
    if (!image) return;
    row.querySelector("[name=workImage]").value = image.path;
    row.querySelector(".selected-image").innerHTML = `<img src="${escapeHtml(image.path)}" alt=""><span>${escapeHtml(image.name)}</span><button class="clear-image" type="button" aria-label="이미지 선택 취소">×</button>`;
    row.querySelector(".image-library").hidden = true;
    row.querySelector(".choose-image").setAttribute("aria-expanded", "false");
  });
  row.querySelector(".selected-image").addEventListener("click", event => {
    if (!event.target.closest(".clear-image")) return;
    row.querySelector("[name=workImage]").value = "";
    row.querySelector(".selected-image").textContent = "선택한 이미지 없음";
  });
  fields.append(row);
  renderImageLibrary(row);
}

function renderImageLibrary(row) {
  const panel = row.querySelector(".image-library");
  panel.innerHTML = imageLibrary.length
    ? `<div class="image-library-grid">${imageLibrary.map((image, index) => `<button type="button" data-image-index="${index}" title="${escapeHtml(image.name)}"><img src="${escapeHtml(image.path)}" alt=""><span>${escapeHtml(image.name)}</span></button>`).join("")}</div>`
    : `<p>등록된 이미지가 없습니다. <code>assets/works/</code>에 이미지를 넣고 라이브러리 목록을 생성해주세요.</p>`;
}

async function loadImageLibrary() {
  try {
    const local = ["localhost", "127.0.0.1"].includes(location.hostname);
    let listed = false;
    if (!local) {
      try {
        const response = await fetch("https://api.github.com/repos/moodang-teacher/pickspot/contents/assets/works?ref=main", { cache: "no-store" });
        if (response.ok) {
          const files = await response.json();
          if (Array.isArray(files)) {
            imageLibrary = files.filter(file => file.type === "file" && /\.(jpe?g|png|webp|avif|gif)$/i.test(file.name)).map(file => ({ name: file.name, path: `assets/works/${encodeURIComponent(file.name)}` }));
            listed = true;
          }
        }
      } catch { /* Use the generated local index below. */ }
    }
    if (local || !listed) {
      const response = await fetch("assets/works/index.json", { cache: "no-store" });
      if (!response.ok) throw new Error("이미지 목록을 읽을 수 없습니다.");
      const data = await response.json();
      imageLibrary = Array.isArray(data.images) ? data.images.filter(image => typeof image.path === "string" && image.path.startsWith("assets/works/") && typeof image.name === "string") : [];
    }
  } catch (error) { announce(`이미지 라이브러리를 불러오지 못했습니다: ${error.message}`); }
  [...fields.children].forEach(renderImageLibrary);
}

function renderList() {
  const entries = Object.entries(exhibitions).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  list.innerHTML = entries.length ? entries.map(([id, item]) => `<div class="admin-event"><div class="admin-event-main"><span class="status-pill ${item.status}">${item.status === "active" ? "● 투표 진행 중" : "◆ 전시 종료"}</span><strong>${escapeHtml(item.title)}</strong><small>작품 ${Object.keys(item.works || {}).length}점 · ${new Intl.DateTimeFormat("ko-KR").format(item.startsAt || item.createdAt)}</small></div><div class="admin-event-actions"><a href="${shareUrl(id)}" target="_blank" rel="noopener">화면 열기 ↗</a><button type="button" data-copy="${escapeHtml(id)}">주소 복사</button>${item.status === "active" ? `<button type="button" data-close="${escapeHtml(id)}">투표 종료</button>` : ""}</div></div>`).join("") : `<div class="admin-empty">아직 만든 전시회가 없습니다.</div>`;
}

document.querySelector("#add-work").addEventListener("click", addWork);
addWork(); addWork();
loadImageLibrary();
document.querySelector("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button"); button.disabled = true;
  try { const values = new FormData(event.currentTarget); await signInAdmin(values.get("email"), values.get("password")); announce("로그인했습니다."); }
  catch (error) { announce(`로그인 실패: ${error.message}`); }
  finally { button.disabled = false; }
});
document.querySelector("#sign-out").addEventListener("click", async () => { await signOutAdmin(); announce("로그아웃했습니다."); });

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authorized) return;
  const button = form.querySelector("button[type=submit]"); button.disabled = true;
  try {
    const values = new FormData(form);
    const title = String(values.get("title") || "").trim();
    const description = String(values.get("description") || "").trim();
    if (!title || !description) throw new Error("전시회 제목과 소개를 입력해주세요.");
    const works = {};
    [...fields.children].forEach((row, index) => {
      const name = row.querySelector("[name=workTitle]").value.trim();
      const detail = row.querySelector("[name=workDescription]").value.trim();
      const imageUrl = row.querySelector("[name=workImage]").value.trim();
      if (!name || !detail) throw new Error(`${index + 1}번 작품의 제목과 설명을 입력해주세요.`);
      works[`work-${index + 1}`] = { title: name, description: detail, imageUrl, order: index + 1 };
    });
    const id = await createExhibition({ title, description, status: "active", createdAt: Date.now(), startsAt: Date.now(), works });
    form.reset(); fields.innerHTML = ""; addWork(); addWork();
    announce(`전시회를 열었습니다. 공유 주소: ${shareUrl(id)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) { announce(`전시회를 만들지 못했습니다: ${error.message}`); }
  finally { button.disabled = false; }
});

list.addEventListener("click", async event => {
  const copy = event.target.closest("[data-copy]");
  if (copy) { try { await navigator.clipboard.writeText(shareUrl(copy.dataset.copy)); announce("전시회 주소를 복사했습니다."); } catch { announce(`주소를 복사할 수 없습니다. ${shareUrl(copy.dataset.copy)}`); } return; }
  const close = event.target.closest("[data-close]");
  if (close) {
    const item = exhibitions[close.dataset.close];
    if (!item) return;
    if (close.dataset.armed !== "true") {
      close.dataset.armed = "true";
      close.textContent = "정말 종료하기";
      announce(`「${item.title}」의 투표를 종료하면 다시 열 수 없습니다. 버튼을 한 번 더 누르면 종료됩니다.`);
      return;
    }
    close.disabled = true;
    try { await closeExhibition(close.dataset.close); announce("투표를 종료했습니다. 결과는 계속 조회할 수 있습니다."); }
    catch (error) { announce(`종료하지 못했습니다: ${error.message}`); close.disabled = false; }
  }
});

if (isDemo) {
  document.querySelector("#admin-demo").hidden = false;
  document.querySelectorAll("#login-form input, #login-form button").forEach(field => { field.disabled = true; });
}
try {
  await onAdminState(user => { authorized = Boolean(user); loginPanel.hidden = authorized; workspace.hidden = !authorized; });
  await subscribeExhibitions(data => { exhibitions = data; renderList(); }, error => announce(`전시회 목록을 불러오지 못했습니다: ${error.message}`));
} catch (error) { announce(`운영자 화면을 시작하지 못했습니다: ${error.message}`); }
