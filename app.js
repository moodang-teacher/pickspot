import { isDemo, subscribeExhibitions, subscribeVotes, voteFor } from "./data.js";
import { icon } from "./icons.js";

const app = document.querySelector("#app");
const headerResults = document.querySelector("#header-results");
const sheet = document.querySelector("#results-sheet");
const backdrop = document.querySelector("#results-backdrop");
const resultsContent = document.querySelector("#results-content");
const posterDialog = document.querySelector("#poster-dialog");
const posterBackdrop = document.querySelector("#poster-backdrop");
const posterViewport = document.querySelector("#poster-viewport");
const posterSlide = document.querySelector("#poster-slide");
const posterImage = document.querySelector("#poster-image");
const posterVote = document.querySelector("#poster-vote");
const voteConfirmDialog = document.querySelector("#vote-confirm-dialog");
const voteConfirmBackdrop = document.querySelector("#vote-confirm-backdrop");
const toast = document.querySelector("#toast");
const state = { exhibitions: {}, votes: {}, exhibitionId: null, activeIndex: -1, focused: null, flipped: null, unsubscribeVotes: null, lastFocus: null };
const sessionVotes = new Set();
let toastTimer;
let closeTimer;
let swipeStart = null;
let ignoreClickUntil = 0;
let exhibitionsLoaded = false;
let exhibitionsError = null;
let routeRevision = 0;
let posterRevision = 0;
let posterLastFocus = null;
let posterId = null;
let posterSwipeStart = null;
let posterSlideFrame = null;
let posterSlideTimer = null;
let votingInProgress = false;
let pendingVote = null;

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
const previewImage = original => {
  if (!original) return "";
  const url = new URL(original);
  const worksRoot = new URL("assets/works/", location.href).pathname;
  if (url.origin !== location.origin || !url.pathname.startsWith(worksRoot)) return original;
  url.pathname = new URL("assets/work-thumbs/", location.href).pathname + url.pathname.slice(worksRoot.length) + ".thumb.webp";
  return url.href;
};
const exhibitionEntries = () => Object.entries(state.exhibitions).filter(([, exhibition]) => ["active", "closed"].includes(exhibition.status)).sort((a, b) => (b[1].startsAt || 0) - (a[1].startsAt || 0));
const current = () => state.exhibitions[state.exhibitionId];
const works = exhibition => Object.entries(exhibition?.works || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
const dateLabel = timestamp => timestamp ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(timestamp) : "";
const voteKey = id => `hasVoted:${id}:${state.exhibitions[id]?.voteResetAt || 0}`;
const hasVoted = id => { const key = voteKey(id); if (sessionVotes.has(key)) return true; try { return Boolean(localStorage.getItem(key)); } catch { return false; } };
const tag = (status, count) => `<span class="status-pill ${status}">${icon(status === "active" ? "circle-dot" : "circle-check")}${status === "active" ? "투표 진행 중" : "전시 종료"}</span><span class="work-count">작품 ${count}점</span>`;

function notify(message) { toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3600); }
function route() {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/").filter(Boolean);
  return parts[0] === "e" && parts[1] ? { name: "exhibition", id: parts[1] } : parts[0] === "archive" ? { name: "archive" } : { name: "home" };
}
function render() {
  const view = route();
  document.querySelectorAll(".top-nav a").forEach(link => link.classList.toggle("active", (view.name === "archive") === (link.getAttribute("href") === "#/archive")));
  headerResults.hidden = !exhibitionsLoaded || view.name !== "exhibition" || !state.exhibitions[view.id];
  if (exhibitionsError) { app.innerHTML = `<div class="empty-state">전시회를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>`; return; }
  if (!exhibitionsLoaded) { app.innerHTML = `<div class="loading-state">전시회를 불러오고 있습니다…</div>`; return; }
  if (view.name === "exhibition") renderExhibition(view.id);
  else if (view.name === "archive") renderArchive();
  else renderHome();
  if (!sheet.hidden) renderResults();
}
function renderHome() {
  const active = exhibitionEntries().filter(([, item]) => item.status === "active");
  const closed = exhibitionEntries().filter(([, item]) => item.status === "closed");
  app.innerHTML = `<section class="home-hero"><img class="hero-logo" src="assets/pickspot_logo_big.png" alt="" aria-hidden="true"><div class="hero-content"><div class="eyebrow gold">PICKSPOT · EXHIBITION VOTE</div><h1>당신의 한 표가<br><em>아이디어의 다음 장</em>을 엽니다.</h1><p>작품을 살펴보고 마음을 움직인 아이디어에 투표해주세요.</p></div><div class="hero-number" aria-hidden="true">01<span> / VOTE</span></div></section>
  ${isDemo ? `<div class="demo-banner"><strong>샘플 데이터 체험 중</strong><span>Firebase를 연결하면 여러 기기에서 같은 전시회와 투표 결과를 공유할 수 있습니다.</span></div>` : ""}
  <section class="section-block"><div class="section-heading"><div><span class="eyebrow">NOW OPEN</span><h2>진행 중인 전시회</h2></div><span class="section-counter">${String(active.length).padStart(2, "0")}</span></div>${active.length ? `<div class="exhibition-grid">${active.map(exhibitionTile).join("")}</div>` : `<div class="empty-state">현재 진행 중인 전시회가 없습니다.<br>지난 전시회의 결과를 둘러보세요.</div>`}</section>
  <section class="section-block archive-teaser"><div class="section-heading"><div><span class="eyebrow">ARCHIVE</span><h2>지난 전시회</h2></div><a class="text-link" href="#/archive">모두 보기 ${icon("arrow-up-right")}</a></div>${closed.length ? `<div class="archive-row-list">${closed.slice(0, 2).map(archiveRow).join("")}</div>` : `<div class="empty-state">아직 종료된 전시회가 없습니다.</div>`}</section>`;
}
function exhibitionTile([id, item]) {
  const entries = works(item);
  const imageUrl = safeImage(entries[0]?.[1].imageUrl);
  const previewUrl = previewImage(imageUrl);
  return `<a class="exhibition-tile" href="#/e/${encodeURIComponent(id)}"><div class="tile-art" aria-hidden="true">${imageUrl ? `<img src="${escapeHtml(previewUrl)}" ${previewUrl !== imageUrl ? `data-original="${escapeHtml(imageUrl)}"` : ""} alt="" loading="lazy" decoding="async">` : ""}</div><div class="tile-content"><div class="tile-meta">${tag(item.status, entries.length)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="tile-bottom"><span>${dateLabel(item.startsAt)} 시작</span><span class="round-arrow">${icon("arrow-up-right")}</span></div></div></a>`;
}
function archiveRow([id, item], index) {
  return `<a class="archive-row" href="#/e/${encodeURIComponent(id)}"><span class="row-index">${String(index + 1).padStart(2, "0")}</span><span class="row-title">${escapeHtml(item.title)}<small>${dateLabel(item.endsAt || item.startsAt)} · 작품 ${works(item).length}점</small></span><span class="row-action">결과 보기 ${icon("arrow-up-right")}</span></a>`;
}
function renderArchive() {
  const closed = exhibitionEntries().filter(([, item]) => item.status === "closed");
  app.innerHTML = `<section class="section-block archive-list-page"><div class="section-heading"><div><span class="eyebrow">PAST EXHIBITIONS</span><h1>지난 전시회</h1></div><span class="section-counter">${String(closed.length).padStart(2, "0")}</span></div>${closed.length ? `<div class="archive-row-list">${closed.map(archiveRow).join("")}</div>` : `<div class="empty-state">아직 지난 전시회가 없습니다.</div>`}</section>`;
}
function renderExhibition(id) {
  const item = state.exhibitions[id];
  if (!item || !["active", "closed"].includes(item.status)) { app.innerHTML = `<section class="missing-state"><h1>전시회를 찾을 수 없습니다.</h1><a class="primary-button" href="#/">홈으로 돌아가기 ${icon("arrow-up-right")}</a></section>`; return; }
  const entries = works(item);
  if (state.activeIndex >= 0) state.activeIndex = Math.min(state.activeIndex, Math.max(entries.length - 1, 0));
  const voted = hasVoted(id);
  const note = item.status === "closed" ? "투표가 종료되었습니다. 작품과 최종 결과를 둘러보세요." : voted ? "이 전시회에 투표했습니다. 실시간 결과를 확인해보세요." : "";
  app.innerHTML = `<div class="exhibition-page"><div class="exhibition-top"><a class="back-link" href="#/">${icon("arrow-left")} 전시회 목록</a><div class="exhibition-kicker">${tag(item.status, entries.length)}</div><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.description)}</p>${note ? `<div class="exhibition-note">${note}</div>` : ""}</div>
  <section class="gallery" aria-label="전시 작품"><div class="gallery-heading"><span class="eyebrow gold">THE WORKS</span><span>전체 ${entries.length}개 작품</span></div><div class="card-stage" aria-label="작품 카드 덱">${entries.map(([workId, work], index) => cardHtml(workId, work, index + 1, index, entries.length, item.status, voted)).join("")}</div><div class="gallery-controls work-navigation"><button type="button" data-step="-1" aria-label="이전 작품">${icon("arrow-left")}</button><span class="work-position" aria-live="polite"><strong></strong><small></small></span><button type="button" data-step="1" aria-label="다음 작품">${icon("arrow-right")}</button></div></section>
  <div class="exhibition-bottom"><button type="button" class="outline-button" data-open-results>${item.status === "closed" ? "최종 결과 보기" : "실시간 개표 보기"} ${icon("chart-column-increasing")}</button></div></div>`;
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
  const previewUrl = previewImage(imageUrl);
  return `<article class="work-card ${focused ? "focused" : ""} ${flipped ? "flipped" : ""}" style="--angle:${angle}deg;--compact-angle:${compactAngle}deg;--shift:${shift}px;--stack:${index + 1}" data-card="${escapeHtml(id)}"><div class="card-inner"><div class="card-face card-front" ${flipped ? "inert" : ""}><button class="front-button" type="button" data-focus="${escapeHtml(id)}" aria-label="${escapeHtml(work.title)} 설명 보기"><span class="card-topline"><span>PICKSPOT</span><b>${String(number).padStart(2, "0")}</b></span><span class="poster-art">${imageUrl ? `<img src="${escapeHtml(previewUrl)}" ${previewUrl !== imageUrl ? `data-original="${escapeHtml(imageUrl)}"` : ""} alt="" loading="eager" decoding="async" fetchpriority="${index === count - 1 ? "high" : "low"}">` : ""}</span><span class="card-caption"><strong>${escapeHtml(work.title)}</strong></span></button>${imageUrl ? `<button class="view-poster" type="button" data-view-poster="${escapeHtml(id)}" aria-label="${escapeHtml(work.title)} 작품 크게보기">작품 크게보기 ${icon("arrow-up-right")}</button>` : ""}</div><div class="card-face card-back" ${flipped ? "" : "inert"}><button class="card-back-content" type="button" data-unflip="${escapeHtml(id)}" aria-label="${escapeHtml(work.title)} 앞면 보기"><span class="card-back-number">${String(number).padStart(2, "0")} / WORK</span><span class="card-back-title">${escapeHtml(work.title)}</span><span class="card-back-description">${escapeHtml(work.description)}</span><span class="card-back-hint">${icon("rotate-ccw")} 터치하여 앞면 보기</span></button><div class="card-back-actions">${status === "active" && !voted ? `<button class="vote-button" type="button" data-vote="${escapeHtml(id)}">${icon("vote")}<span class="button-label">이 작품에 투표하기</span></button>` : `<button class="vote-button muted" type="button" data-open-results>${status === "closed" ? "최종 결과 보기" : "실시간 결과 보기"} ${icon("chart-column-increasing")}</button>`}</div></div></div></article>`;
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
  });
  const entries = works(item);
  const position = app.querySelector(".work-position");
  if (position) {
    position.querySelector("strong").textContent = !entries.length ? "작품 0개" : state.activeIndex < 0 ? `전체 ${entries.length}개 작품` : `${String(state.activeIndex + 1).padStart(2, "0")} / ${String(entries.length).padStart(2, "0")}`;
    position.querySelector("small").textContent = !entries.length ? "등록된 작품이 없습니다" : state.activeIndex < 0 ? "좌우로 넘겨보세요" : entries[state.activeIndex][1].title;
    app.querySelector('[data-step="-1"]').disabled = entries.length < 2;
    app.querySelector('[data-step="1"]').disabled = entries.length < 2;
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
  const nextIndex = state.activeIndex < 0 ? (direction > 0 ? 0 : entries.length - 1) : (state.activeIndex + direction + entries.length) % entries.length;
  if (nextIndex !== state.activeIndex || !state.focused) selectCard(entries[nextIndex][0]);
}
function renderResults() {
  const item = current();
  if (!item) return;
  const items = works(item).map(([id, work]) => ({ id, ...work, votes: Number(state.votes[id]) || 0 })).sort((a, b) => b.votes - a.votes || (a.order || 0) - (b.order || 0));
  const total = items.reduce((sum, work) => sum + work.votes, 0);
  resultsContent.innerHTML = `<div class="results-summary"><div><span>총 투표수</span><strong>${total.toLocaleString("ko-KR")}</strong></div><div><span>참여 작품</span><strong>${items.length}</strong></div><div><span>상태</span><strong class="summary-status">${item.status === "active" ? "진행 중" : "최종 결과"}</strong></div></div><div class="result-list">${items.map(work => { const percent = total ? Math.round(work.votes / total * 100) : 0; const imageUrl = safeImage(work.imageUrl); const previewUrl = previewImage(imageUrl); return `<div class="result-item"><div class="result-item-head"><span class="result-thumb">${imageUrl ? `<img src="${escapeHtml(previewUrl)}" ${previewUrl !== imageUrl ? `data-original="${escapeHtml(imageUrl)}"` : ""} alt="" loading="lazy" decoding="async">` : ""}</span><strong>${escapeHtml(work.title)}</strong><span class="result-votes">${work.votes}표</span></div><div class="result-track"><span style="width:${percent}%"></span></div><div class="result-percent">${percent}%</div></div>`; }).join("")}</div><p class="results-footnote">${item.status === "active" ? "투표 결과는 실시간으로 반영됩니다." : "종료된 전시회의 최종 기록입니다."}</p>`;
  resultsContent.querySelectorAll(".result-item").forEach((row, index) => {
    row.dataset.resultPoster = items[index].id;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `${items[index].title} 작품 크게보기`);
  });
  document.querySelector("#results-title").textContent = item.status === "active" ? "실시간 개표 현황" : "최종 투표 결과";
}
function openResults() { closePoster(); clearTimeout(closeTimer); state.lastFocus = document.activeElement; renderResults(); sheet.hidden = false; backdrop.hidden = false; requestAnimationFrame(() => { sheet.classList.add("open"); backdrop.classList.add("open"); document.querySelector("#close-results").focus(); }); document.body.classList.add("modal-open"); }
function closeResults() { if (sheet.hidden) return; sheet.classList.remove("open"); backdrop.classList.remove("open"); document.body.classList.remove("modal-open"); clearTimeout(closeTimer); closeTimer = setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 260); state.lastFocus?.focus?.(); }
function openPoster(id) {
  const work = current()?.works?.[id];
  if (!work) return;
  posterLastFocus = document.activeElement;
  posterDialog.hidden = false;
  posterBackdrop.hidden = false;
  document.body.classList.add("modal-open");
  showPoster(id);
  document.querySelector("#close-poster").focus();
}
function resetPosterSlide() {
  if (posterSlideFrame !== null) cancelAnimationFrame(posterSlideFrame);
  clearTimeout(posterSlideTimer);
  posterSlideFrame = null;
  posterSlideTimer = null;
  posterViewport.querySelector(".poster-slide-outgoing")?.remove();
  posterSlide.style.transition = "";
  posterSlide.style.transform = "";
}
function showPoster(id, direction = 0) {
  const entries = works(current());
  const index = entries.findIndex(([workId]) => workId === id);
  if (index < 0) return;
  const work = entries[index][1];
  resetPosterSlide();
  const animate = direction && posterId && !posterDialog.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let outgoing;
  if (animate) {
    outgoing = posterSlide.cloneNode(true);
    outgoing.removeAttribute("id");
    outgoing.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
    outgoing.classList.add("poster-slide-outgoing");
    outgoing.setAttribute("aria-hidden", "true");
    posterViewport.prepend(outgoing);
    posterSlide.style.transition = "none";
    posterSlide.style.transform = `translateX(${direction * 100}%)`;
    posterSlide.getBoundingClientRect();
  }
  posterId = id;
  selectCard(id);
  const original = safeImage(work?.imageUrl);
  const revision = ++posterRevision;
  document.querySelector("#poster-title").textContent = work.title;
  document.querySelector("#poster-position").textContent = `${String(index + 1).padStart(2, "0")} / ${String(entries.length).padStart(2, "0")}`;
  document.querySelector("#poster-prev").disabled = entries.length < 2;
  document.querySelector("#poster-next").disabled = entries.length < 2;
  posterVote.disabled = votingInProgress || current().status !== "active" || hasVoted(state.exhibitionId);
  posterVote.querySelector(".button-label").textContent = current().status !== "active" ? "투표가 종료되었습니다" : hasVoted(state.exhibitionId) ? "투표 완료" : "투표하기";
  document.querySelector("#poster-no-image").hidden = Boolean(original);
  posterImage.hidden = !original;
  posterImage.alt = work.title;
  posterImage.removeAttribute("src");
  posterImage.onerror = null;
  if (original) {
    posterImage.onerror = () => { if (revision === posterRevision && posterImage.src !== original) posterImage.src = original; };
    posterImage.src = previewImage(original);
    if (posterImage.src !== original) {
      const fullImage = new Image();
      fullImage.onload = () => { if (revision === posterRevision && !posterDialog.hidden) posterImage.src = original; };
      fullImage.src = original;
    }
  }
  if (outgoing) {
    posterSlide.style.transition = "";
    posterSlideFrame = requestAnimationFrame(() => {
      posterSlideFrame = null;
      if (revision !== posterRevision || posterDialog.hidden) return;
      outgoing.style.transform = `translateX(${-direction * 100}%)`;
      posterSlide.style.transform = "translateX(0)";
      posterSlideTimer = setTimeout(resetPosterSlide, 450);
    });
  }
}
function stepPoster(direction) {
  const entries = works(current());
  if (entries.length < 2) return;
  const index = entries.findIndex(([id]) => id === posterId);
  showPoster(entries[(index + direction + entries.length) % entries.length][0], direction);
}
function closePoster() {
  if (posterDialog.hidden) return;
  const returnFocus = posterLastFocus?.isConnected ? posterLastFocus : [...resultsContent.querySelectorAll("[data-result-poster]")].find(row => row.dataset.resultPoster === posterId);
  resetPosterSlide();
  posterRevision++;
  posterDialog.hidden = true;
  posterBackdrop.hidden = true;
  posterImage.onerror = null;
  posterImage.removeAttribute("src");
  posterId = null;
  if (!sheet.classList.contains("open")) document.body.classList.remove("modal-open");
  returnFocus?.focus?.();
}
function openVoteConfirm(workId, sourceButton) {
  const id = state.exhibitionId;
  if (votingInProgress || !id || current()?.status !== "active" || hasVoted(id)) {
    notify("이 전시회의 투표에 이미 참여했거나 투표가 종료되었습니다.");
    return;
  }
  pendingVote = { exhibitionId: id, workId, sourceButton };
  voteConfirmDialog.hidden = false;
  voteConfirmBackdrop.hidden = false;
  document.body.classList.add("modal-open");
  document.querySelector("#cancel-vote").focus();
}
function closeVoteConfirm() {
  if (voteConfirmDialog.hidden) return;
  const sourceButton = pendingVote?.sourceButton;
  pendingVote = null;
  voteConfirmDialog.hidden = true;
  voteConfirmBackdrop.hidden = true;
  if (posterDialog.hidden && !sheet.classList.contains("open")) document.body.classList.remove("modal-open");
  sourceButton?.focus?.();
}
async function switchRoute() {
  closeVoteConfirm();
  closeResults();
  closePoster();
  const next = route();
  const id = next.name === "exhibition" ? next.id : null;
  const changed = state.exhibitionId !== id;
  const revision = changed ? ++routeRevision : routeRevision;
  if (changed) {
    state.unsubscribeVotes?.(); state.unsubscribeVotes = null;
    state.exhibitionId = id; state.votes = {}; state.activeIndex = -1; state.focused = null; state.flipped = null;
    if (id) {
      try {
        const unsubscribe = await subscribeVotes(id, votes => { if (revision === routeRevision && state.exhibitionId === id) { state.votes = votes; if (!sheet.hidden) renderResults(); } }, error => notify(`결과를 불러오지 못했습니다: ${error.message}`));
        if (revision !== routeRevision) { unsubscribe(); return; }
        state.unsubscribeVotes = unsubscribe;
      }
      catch (error) { notify(`결과를 불러오지 못했습니다: ${error.message}`); }
    }
  }
  if (revision !== routeRevision) return;
  render();
  window.scrollTo(0, 0);
}

app.addEventListener("click", async event => {
  if (performance.now() < ignoreClickUntil) return;
  const step = event.target.closest("[data-step]");
  if (step) { stepWork(Number(step.dataset.step)); return; }
  const viewPoster = event.target.closest("[data-view-poster]");
  if (viewPoster) { openPoster(viewPoster.dataset.viewPoster); return; }
  const focus = event.target.closest("[data-focus]");
  if (focus) { const id = focus.dataset.focus; selectCard(id, state.focused === id); return; }
  const unflip = event.target.closest("[data-unflip]");
  if (unflip) { selectCard(unflip.dataset.unflip); return; }
  const voteButton = event.target.closest("[data-vote]");
  if (voteButton) {
    openVoteConfirm(voteButton.dataset.vote, voteButton);
    return;
  }
  if (event.target.closest("[data-open-results]")) { openResults(); return; }
  if (state.focused && event.target.closest(".exhibition-page") && !event.target.closest(".work-card, button, a")) selectCard(null);
});
async function submitVote(workId, button) {
  const id = state.exhibitionId;
  if (votingInProgress) return;
  if (!id || current()?.status !== "active" || hasVoted(id)) { notify("이 전시회의 투표에 이미 참여했거나 투표가 종료되었습니다."); return; }
  votingInProgress = true;
  const buttonLabel = button.querySelector(".button-label") || button;
  const originalLabel = buttonLabel.textContent;
  button.disabled = true; buttonLabel.textContent = "투표를 반영하고 있습니다…";
  try {
    await voteFor(id, workId);
    sessionVotes.add(voteKey(id));
    let stored = true;
    try { localStorage.setItem(voteKey(id), workId); } catch { stored = false; }
    render(); openResults();
    notify(stored ? "투표가 완료되었습니다." : "투표가 완료되었습니다. 이 브라우저에 참여 기록은 저장되지 않았습니다.");
  } catch (error) {
    button.disabled = false; buttonLabel.textContent = originalLabel;
    notify(`투표하지 못했습니다: ${error.message}`);
  } finally {
    votingInProgress = false;
    if (!posterDialog.hidden && posterId) showPoster(posterId);
  }
}
app.addEventListener("transitionend", event => {
  const card = event.target.closest(".work-card.settling");
  if (card && event.target === card && event.propertyName === "transform" && !card.classList.contains("focused")) card.classList.remove("settling");
});
app.addEventListener("error", event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.dataset.original) {
    image.src = image.dataset.original;
    delete image.dataset.original;
  } else if (image instanceof HTMLImageElement && image.closest(".tile-art, .result-thumb")) {
    image.remove();
  }
}, true);
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
resultsContent.addEventListener("click", event => {
  const row = event.target.closest("[data-result-poster]");
  if (row) openPoster(row.dataset.resultPoster);
});
resultsContent.addEventListener("keydown", event => {
  if (!["Enter", " "].includes(event.key)) return;
  const row = event.target.closest("[data-result-poster]");
  if (row) { event.preventDefault(); openPoster(row.dataset.resultPoster); }
});
document.querySelector("#close-poster").addEventListener("click", closePoster);
posterBackdrop.addEventListener("click", closePoster);
document.querySelector("#poster-prev").addEventListener("click", () => stepPoster(-1));
document.querySelector("#poster-next").addEventListener("click", () => stepPoster(1));
posterVote.addEventListener("click", () => { if (posterId) openVoteConfirm(posterId, posterVote); });
document.querySelector("#cancel-vote").addEventListener("click", closeVoteConfirm);
voteConfirmBackdrop.addEventListener("click", closeVoteConfirm);
document.querySelector("#confirm-vote").addEventListener("click", () => {
  const vote = pendingVote;
  closeVoteConfirm();
  if (vote && vote.exhibitionId === state.exhibitionId) submitVote(vote.workId, vote.sourceButton);
});
document.querySelector("#poster-swipe-area").addEventListener("pointerdown", event => { posterSwipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }; });
document.addEventListener("pointerup", event => {
  if (!posterSwipeStart || posterSwipeStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - posterSwipeStart.x;
  const dy = event.clientY - posterSwipeStart.y;
  posterSwipeStart = null;
  if (!posterDialog.hidden && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.25) stepPoster(dx < 0 ? 1 : -1);
});
document.addEventListener("pointercancel", () => { posterSwipeStart = null; });
document.addEventListener("keydown", event => {
  if (!voteConfirmDialog.hidden) {
    if (event.key === "Escape") { event.preventDefault(); closeVoteConfirm(); }
    if (event.key === "Tab") {
      const controls = [...voteConfirmDialog.querySelectorAll("button")];
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0].focus(); }
    }
    return;
  }
  if (event.key === "Escape" && !posterDialog.hidden) closePoster();
  else if (event.key === "Escape" && !sheet.hidden) closeResults();
  if (!posterDialog.hidden && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); stepPoster(event.key === "ArrowRight" ? 1 : -1); }
  if (event.key === "Tab" && !posterDialog.hidden) {
    const controls = [...posterDialog.querySelectorAll("button:not(:disabled)")];
    const index = controls.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && (index === -1 || index === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
  }
});
window.addEventListener("hashchange", switchRoute);

app.innerHTML = `<div class="loading-state">전시회를 불러오고 있습니다…</div>`;
try {
  await subscribeExhibitions(exhibitions => { state.exhibitions = exhibitions; exhibitionsLoaded = true; exhibitionsError = null; render(); }, error => { exhibitionsError = error; render(); notify(error.message); });
  await switchRoute();
} catch (error) { exhibitionsError = error; render(); notify(error.message); }
