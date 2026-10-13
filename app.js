import { isDemo, subscribeExhibitions, subscribeVotes, voteFor } from "./data.js";

const app = document.querySelector("#app");
const headerResults = document.querySelector("#header-results");
const sheet = document.querySelector("#results-sheet");
const backdrop = document.querySelector("#results-backdrop");
const resultsContent = document.querySelector("#results-content");
const toast = document.querySelector("#toast");
const state = { exhibitions: {}, votes: {}, exhibitionId: null, activeIndex: -1, focused: null, flipped: null, unsubscribeVotes: null, lastFocus: null };
const sessionVotes = new Set();
let toastTimer;
let closeTimer;
let swipeStart = null;
let ignoreClickUntil = 0;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const safeImage = value => {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    if (value.startsWith("assets/works/")) {
      const url = new URL(value, location.href);
      const libraryPath = new URL("assets/works/", location.href).pathname;
      return url.origin === location.origin && url.pathname.startsWith(libraryPath) ? url.href : "";
    }
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
};
const exhibitionEntries = () => Object.entries(state.exhibitions).filter(([, exhibition]) => ["active", "closed"].includes(exhibition.status)).sort((a, b) => (b[1].startsAt || 0) - (a[1].startsAt || 0));
const current = () => state.exhibitions[state.exhibitionId];
const works = exhibition => Object.entries(exhibition?.works || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
const dateLabel = timestamp => timestamp ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(timestamp) : "";
const voteKey = id => `hasVoted:${id}`;
const hasVoted = id => { if (sessionVotes.has(id)) return true; try { return Boolean(localStorage.getItem(voteKey(id))); } catch { return false; } };
const tag = (status, count) => `<span class="status-pill ${status}">${status === "active" ? "● 투표 진행 중" : "◆ 전시 종료"}</span><span class="work-count">작품 ${count}점</span>`;

function notify(message) { toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3600); }
function route() {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/").filter(Boolean);
  return parts[0] === "e" && parts[1] ? { name: "exhibition", id: parts[1] } : parts[0] === "archive" ? { name: "archive" } : { name: "home" };
}
function render() {
  const view = route();
  document.querySelectorAll(".top-nav a").forEach(link => link.classList.toggle("active", (view.name === "archive") === (link.getAttribute("href") === "#/archive")));
  headerResults.hidden = view.name !== "exhibition" || !state.exhibitions[view.id];
  if (view.name === "exhibition") renderExhibition(view.id);
  else if (view.name === "archive") renderArchive();
  else renderHome();
  if (!sheet.hidden) renderResults();
}
function renderHome() {
  const active = exhibitionEntries().filter(([, item]) => item.status === "active");
  const closed = exhibitionEntries().filter(([, item]) => item.status === "closed");
  app.innerHTML = `<section class="home-hero"><img class="hero-logo" src="assets/pickspot_logo_big.png" alt="" aria-hidden="true"><div class="hero-content"><div class="eyebrow gold">PICKSPOT · EXHIBITION VOTE</div><h1>당신의 한 표가<br><em>아이디어의 다음 장</em>을 엽니다.</h1><p>작품을 살펴보고 마음을 움직인 아이디어에 투표해주세요. 지금의 선택이 전시회의 이야기가 됩니다.</p><a class="primary-button" href="${active[0] ? `#/e/${encodeURIComponent(active[0][0])}` : "#/archive"}">${active.length ? "전시회 입장하기" : "지난 전시회 보기"}<span aria-hidden="true">↗</span></a></div><div class="hero-number" aria-hidden="true">01<span> / VOTE</span></div></section>
  ${isDemo ? `<div class="demo-banner"><strong>샘플 데이터 체험 중</strong><span>Firebase를 연결하면 여러 기기에서 같은 전시회와 투표 결과를 공유할 수 있습니다.</span></div>` : ""}
  <section class="section-block"><div class="section-heading"><div><span class="eyebrow">NOW OPEN</span><h2>진행 중인 전시회</h2></div><span class="section-counter">${String(active.length).padStart(2, "0")}</span></div>${active.length ? `<div class="exhibition-grid">${active.map(exhibitionTile).join("")}</div>` : `<div class="empty-state">현재 진행 중인 전시회가 없습니다.<br>지난 전시회의 결과를 둘러보세요.</div>`}</section>
  <section class="section-block archive-teaser"><div class="section-heading"><div><span class="eyebrow">ARCHIVE</span><h2>지난 전시회의 기록</h2></div><a class="text-link" href="#/archive">모두 보기 ↗</a></div>${closed.length ? `<div class="archive-row-list">${closed.slice(0, 2).map(archiveRow).join("")}</div>` : `<div class="empty-state">아직 종료된 전시회가 없습니다.</div>`}</section>`;
}
function exhibitionTile([id, item]) {
  const count = works(item).length;
  return `<a class="exhibition-tile" href="#/e/${encodeURIComponent(id)}"><div class="tile-art"><span class="tile-sun"></span><span class="tile-orbit orbit-one"></span><span class="tile-orbit orbit-two"></span><img class="tile-brand" src="assets/pickspot_logo.png" alt="" loading="lazy"></div><div class="tile-content"><div class="tile-meta">${tag(item.status, count)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="tile-bottom"><span>${dateLabel(item.startsAt)} 시작</span><span class="round-arrow">↗</span></div></div></a>`;
}
function archiveRow([id, item], index) {
  return `<a class="archive-row" href="#/e/${encodeURIComponent(id)}"><span class="row-index">${String(index + 1).padStart(2, "0")}</span><span class="row-title">${escapeHtml(item.title)}<small>${dateLabel(item.endsAt || item.startsAt)} · 작품 ${works(item).length}점</small></span><span class="row-action">결과 보기 ↗</span></a>`;
}
function renderArchive() {
  const closed = exhibitionEntries().filter(([, item]) => item.status === "closed");
  app.innerHTML = `<section class="archive-intro"><a class="back-link" href="#/">← 홈으로</a><span class="eyebrow gold">OUR ARCHIVE</span><h1>아이디어가 남긴<br><em>발자취</em></h1><p>전시회가 끝나도 작품과 투표의 기록은 이곳에 남습니다.</p></section><section class="section-block"><div class="section-heading"><div><span class="eyebrow">PAST EXHIBITIONS</span><h2>지난 전시회</h2></div><span class="section-counter">${String(closed.length).padStart(2, "0")}</span></div>${closed.length ? `<div class="archive-row-list">${closed.map(archiveRow).join("")}</div>` : `<div class="empty-state">아직 지난 전시회가 없습니다.</div>`}</section>`;
}
function renderExhibition(id) {
  const item = state.exhibitions[id];
  if (!item || !["active", "closed"].includes(item.status)) { app.innerHTML = `<section class="missing-state"><h1>전시회를 찾을 수 없습니다.</h1><a class="primary-button" href="#/">홈으로 돌아가기 ↗</a></section>`; return; }
  const entries = works(item);
  if (state.activeIndex >= 0) state.activeIndex = Math.min(state.activeIndex, Math.max(entries.length - 1, 0));
  const voted = hasVoted(id);
  app.innerHTML = `<div class="exhibition-page"><div class="exhibition-top"><a class="back-link" href="#/">← 전시회 목록</a><div class="exhibition-kicker">${tag(item.status, entries.length)}</div><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.description)}</p><div class="exhibition-note">${item.status === "closed" ? "투표가 종료되었습니다. 작품과 최종 결과를 둘러보세요." : voted ? "이 전시회에 투표했습니다. 실시간 결과를 확인해보세요." : "카드를 터치하거나 좌우로 밀어 작품을 넘겨보세요."}</div></div>
  <section class="gallery" aria-label="전시 작품"><div class="gallery-heading"><span class="eyebrow gold">THE WORKS</span><span>전체 ${entries.length}개 작품</span></div><div class="card-stage" aria-label="작품 카드 덱"><div class="stage-halo" aria-hidden="true"></div>${entries.map(([workId, work], index) => cardHtml(workId, work, index + 1, index, entries.length, item.status, voted)).join("")}</div><div class="gallery-controls work-navigation"><button type="button" data-step="-1" aria-label="이전 작품">←</button><span class="work-position" aria-live="polite"><strong></strong><small></small></span><button type="button" data-step="1" aria-label="다음 작품">→</button></div></section>
  <div class="exhibition-bottom"><span>모든 아이디어에는 발견해 줄 한 사람이 필요합니다.</span><button type="button" class="outline-button" data-open-results>${item.status === "closed" ? "최종 결과 보기" : "실시간 개표 보기"} ↗</button></div></div>`;
  syncCardState();
}
function cardHtml(id, work, number, index, count, status, voted) {
  const offset = index - (count - 1) / 2;
  const angle = count === 1 ? 0 : offset * Math.min(6, 32 / (count - 1));
  const compactAngle = count === 1 ? 0 : offset * Math.min(4, 24 / (count - 1));
  const shift = offset * Math.min(48, 255 / Math.max(count - 1, 1));
  const focused = state.focused === id;
  const flipped = state.flipped === id;
  const imageUrl = safeImage(work.imageUrl);
  return `<article class="work-card ${focused ? "focused" : ""} ${flipped ? "flipped" : ""}" style="--angle:${angle}deg;--compact-angle:${compactAngle}deg;--shift:${shift}px;--stack:${index + 1};--art-hue:${(number * 43) % 360}deg" data-card="${escapeHtml(id)}"><div class="card-inner"><div class="card-face card-front" ${flipped ? "inert" : ""}><button class="front-button" type="button" data-focus="${escapeHtml(id)}" aria-label="${escapeHtml(work.title)} ${focused ? "설명 펼치기" : "선택하기"}"><span class="card-topline"><span>PICKSPOT</span><b>${String(number).padStart(2, "0")}</b></span><span class="poster-art">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : ""}<span class="poster-symbol">✦</span></span><span class="card-caption"><strong>${escapeHtml(work.title)}</strong><small>${focused ? "한 번 더 터치하여 작품 보기 ↗" : "터치하여 펼치기 ↗"}</small></span></button></div><div class="card-face card-back" ${flipped ? "" : "inert"}><button class="card-back-content" type="button" data-unflip="${escapeHtml(id)}" aria-label="${escapeHtml(work.title)} 앞면 보기"><span class="card-back-number">${String(number).padStart(2, "0")} / WORK</span><span class="card-back-title">${escapeHtml(work.title)}</span><span class="card-back-description">${escapeHtml(work.description)}</span><span class="card-back-hint">↶ 터치하여 앞면 보기</span></button><div class="card-back-actions">${status === "active" && !voted ? `<button class="vote-button" type="button" data-vote="${escapeHtml(id)}">이 작품에 투표하기 ↗</button>` : `<button class="vote-button muted" type="button" data-open-results>${status === "closed" ? "최종 결과 보기" : "실시간 결과 보기"} ↗</button>`}</div></div></div></article>`;
}
function syncCardState(previousFocused = null) {
  const item = current();
  if (!item) return;
  app.querySelectorAll(".work-card").forEach(card => {
    const id = card.dataset.card;
    const focused = id === state.focused;
    const flipped = id === state.flipped;
    if (id === previousFocused && !focused) {
      card.classList.add("settling");
      setTimeout(() => { if (!card.classList.contains("focused")) card.classList.remove("settling"); }, 750);
    }
    if (focused) card.classList.remove("settling");
    card.classList.toggle("focused", focused);
    card.classList.toggle("flipped", flipped);
    card.querySelector(".card-front").inert = flipped;
    card.querySelector(".card-back").inert = !flipped;
    card.querySelector(".front-button").setAttribute("aria-label", `${item.works[id].title} ${focused ? "설명 펼치기" : "선택하기"}`);
    card.querySelector(".card-caption small").textContent = focused ? "한 번 더 터치하여 작품 보기 ↗" : "터치하여 펼치기 ↗";
  });
  const entries = works(item);
  const position = app.querySelector(".work-position");
  if (position && entries.length) {
    position.querySelector("strong").textContent = state.activeIndex < 0 ? `전체 ${entries.length}개 작품` : `${String(state.activeIndex + 1).padStart(2, "0")} / ${String(entries.length).padStart(2, "0")}`;
    position.querySelector("small").textContent = state.activeIndex < 0 ? "좌우로 넘겨보세요" : entries[state.activeIndex][1].title;
    app.querySelector('[data-step="-1"]').disabled = state.activeIndex === 0;
    app.querySelector('[data-step="1"]').disabled = state.activeIndex === entries.length - 1;
  }
}
function selectCard(id, flipped = false) {
  const previousFocused = state.focused;
  state.activeIndex = id ? works(current()).findIndex(([workId]) => workId === id) : -1;
  state.focused = id;
  state.flipped = flipped ? id : null;
  syncCardState(previousFocused);
}
function stepWork(direction) {
  const entries = works(current());
  if (!entries.length) return;
  const nextIndex = state.activeIndex < 0 ? (direction > 0 ? 0 : entries.length - 1) : Math.max(0, Math.min(entries.length - 1, state.activeIndex + direction));
  if (nextIndex !== state.activeIndex || !state.focused) selectCard(entries[nextIndex][0]);
}
function renderResults() {
  const item = current();
  if (!item) return;
  const items = works(item).map(([id, work]) => ({ id, ...work, votes: Number(state.votes[id]) || 0 })).sort((a, b) => b.votes - a.votes || (a.order || 0) - (b.order || 0));
  const total = items.reduce((sum, work) => sum + work.votes, 0);
  let previous = -1, rank = 0;
  resultsContent.innerHTML = `<div class="results-summary"><div><span>총 투표수</span><strong>${total.toLocaleString("ko-KR")}</strong></div><div><span>참여 작품</span><strong>${items.length}</strong></div><div><span>상태</span><strong class="summary-status">${item.status === "active" ? "진행 중" : "최종 결과"}</strong></div></div><div class="result-list">${items.map((work, index) => { if (work.votes !== previous) rank = index + 1; previous = work.votes; const percent = total ? Math.round(work.votes / total * 100) : 0; return `<div class="result-item"><div class="result-item-head"><span class="result-rank">${String(rank).padStart(2, "0")}</span><strong>${escapeHtml(work.title)}</strong><span class="result-votes">${work.votes}표</span></div><div class="result-track"><span style="width:${percent}%"></span></div><div class="result-percent">${percent}%</div></div>`; }).join("")}</div><p class="results-footnote">${item.status === "active" ? "투표 결과는 실시간으로 반영됩니다." : "종료된 전시회의 최종 기록입니다."}</p>`;
  document.querySelector("#results-title").textContent = item.status === "active" ? "실시간 개표 현황" : "최종 투표 결과";
}
function openResults() { clearTimeout(closeTimer); state.lastFocus = document.activeElement; renderResults(); sheet.hidden = false; backdrop.hidden = false; requestAnimationFrame(() => { sheet.classList.add("open"); backdrop.classList.add("open"); document.querySelector("#close-results").focus(); }); document.body.classList.add("modal-open"); }
function closeResults() { if (sheet.hidden) return; sheet.classList.remove("open"); backdrop.classList.remove("open"); document.body.classList.remove("modal-open"); clearTimeout(closeTimer); closeTimer = setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 260); state.lastFocus?.focus?.(); }
async function switchRoute() {
  closeResults();
  const next = route();
  const id = next.name === "exhibition" ? next.id : null;
  if (state.exhibitionId !== id) {
    state.unsubscribeVotes?.(); state.unsubscribeVotes = null;
    state.exhibitionId = id; state.votes = {}; state.activeIndex = -1; state.focused = null; state.flipped = null;
    if (id) {
      try { state.unsubscribeVotes = await subscribeVotes(id, votes => { if (state.exhibitionId === id) { state.votes = votes; if (!sheet.hidden) renderResults(); } }, error => notify(`결과를 불러오지 못했습니다: ${error.message}`)); }
      catch (error) { notify(`결과를 불러오지 못했습니다: ${error.message}`); }
    }
  }
  render();
  window.scrollTo(0, 0);
}

app.addEventListener("click", async event => {
  if (performance.now() < ignoreClickUntil) return;
  const step = event.target.closest("[data-step]");
  if (step) { stepWork(Number(step.dataset.step)); return; }
  const focus = event.target.closest("[data-focus]");
  if (focus) { const id = focus.dataset.focus; selectCard(id, state.focused === id); return; }
  const unflip = event.target.closest("[data-unflip]");
  if (unflip) { selectCard(unflip.dataset.unflip); return; }
  const voteButton = event.target.closest("[data-vote]");
  if (voteButton) {
    const id = state.exhibitionId;
    if (!id || current()?.status !== "active" || hasVoted(id)) { notify("이 전시회의 투표에 이미 참여했거나 투표가 종료되었습니다."); return; }
    voteButton.disabled = true; voteButton.textContent = "투표를 반영하고 있습니다…";
    try { await voteFor(id, voteButton.dataset.vote); sessionVotes.add(id); let stored = true; try { localStorage.setItem(voteKey(id), voteButton.dataset.vote); } catch { stored = false; } render(); openResults(); notify(stored ? "투표가 완료되었습니다. 감사합니다!" : "투표는 완료되었지만 이 브라우저에 참여 기록을 저장하지 못했습니다."); }
    catch (error) { voteButton.disabled = false; voteButton.textContent = "이 작품에 투표하기 ↗"; notify(`투표하지 못했습니다: ${error.message}`); }
    return;
  }
  if (event.target.closest("[data-open-results]")) { openResults(); return; }
  if (state.focused && event.target.closest(".exhibition-page") && !event.target.closest(".work-card, button, a")) selectCard(null);
});
app.addEventListener("transitionend", event => {
  const card = event.target.closest(".work-card.settling");
  if (card && event.target === card && event.propertyName === "transform" && !card.classList.contains("focused")) card.classList.remove("settling");
});
app.addEventListener("pointerdown", event => {
  if (!event.target.closest(".card-stage")) return;
  swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
});
document.addEventListener("pointerup", event => {
  if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
  ignoreClickUntil = performance.now() + 400;
  stepWork(dx < 0 ? 1 : -1);
});
document.addEventListener("pointercancel", () => { swipeStart = null; });
headerResults.addEventListener("click", openResults);
document.querySelector("#close-results").addEventListener("click", closeResults);
backdrop.addEventListener("click", closeResults);
document.addEventListener("keydown", event => { if (event.key === "Escape" && !sheet.hidden) closeResults(); });
window.addEventListener("hashchange", switchRoute);

app.innerHTML = `<div class="loading-state">전시회를 불러오고 있습니다…</div>`;
try { await subscribeExhibitions(exhibitions => { state.exhibitions = exhibitions; render(); }, error => { app.innerHTML = `<div class="empty-state">전시회를 불러오지 못했습니다. Firebase 설정과 읽기 권한을 확인해주세요.</div>`; notify(error.message); }); await switchRoute(); }
catch (error) { app.innerHTML = `<div class="empty-state">앱을 시작하지 못했습니다. Firebase 설정을 확인해주세요.</div>`; notify(error.message); }
