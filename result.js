import { subscribeExhibitions, subscribeVotes } from "./data.js";

const page = document.querySelector("#result-page");
const printButton = document.querySelector("#print-result");
const message = document.querySelector("#result-message");
const exhibitionId = new URLSearchParams(location.search).get("id");
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
let exhibition;
let votes = {};
let unsubscribeVotes;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const safeImage = value => typeof value === "string" && /^(?:assets\/works\/|https:\/\/)/i.test(value) ? value : "";
const thumbnail = path => path.startsWith("assets/works/") ? `assets/work-thumbs/${path.slice("assets/works/".length)}.thumb.webp` : path;
const formatDate = value => value ? dateFormat.format(value) : "-";

document.addEventListener("error", event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.dataset.original) {
    image.src = image.dataset.original;
    delete image.dataset.original;
  }
}, true);

function rankedWorks() {
  const items = Object.entries(exhibition?.works || {})
    .map(([id, work]) => ({ id, ...work, votes: Number(votes[id]) || 0 }))
    .sort((a, b) => b.votes - a.votes || (a.order || 0) - (b.order || 0));
  let previousVotes;
  let previousRank = 0;
  return items.map((work, index) => {
    const rank = index === 0 || work.votes !== previousVotes ? index + 1 : previousRank;
    previousVotes = work.votes;
    previousRank = rank;
    return { ...work, rank };
  });
}

function render() {
  if (!exhibition) return;
  const items = rankedWorks();
  const total = items.reduce((sum, work) => sum + work.votes, 0);
  const period = exhibition.endsAt
    ? `${formatDate(exhibition.startsAt)} – ${formatDate(exhibition.endsAt)}`
    : `${formatDate(exhibition.startsAt)} 시작`;
  page.classList.toggle("dense", items.length > 10);
  page.innerHTML = `<header class="report-header"><div><p class="report-kicker">EXHIBITION EVALUATION RESULT</p><h1>${escapeHtml(exhibition.title || "제목 없는 전시회")}</h1><p class="report-meta">평가 기간 ${escapeHtml(period)} · 출력일 ${formatDate(Date.now())}</p></div><div class="report-mark"><img src="assets/pickspot_logo.webp" alt=""><span>PickSpot</span></div></header>
    <section class="report-summary" aria-label="평가 요약"><div class="summary-item"><span>총 투표수</span><strong>${total.toLocaleString("ko-KR")}</strong></div><div class="summary-item"><span>참여 작품</span><strong>${items.length}</strong></div><div class="summary-item"><span>상태</span><strong class="summary-status">${exhibition.status === "active" ? "투표 진행 중" : "최종 결과"}</strong></div></section>
    <section><div class="ranking-heading"><h2>작품별 평가 순위</h2><span>득표수 기준 내림차순 · 동점 공동 순위</span></div><div class="ranking-list">${items.map(work => {
      const percent = total ? Math.round(work.votes / total * 100) : 0;
      const image = safeImage(work.imageUrl);
      const preview = image ? thumbnail(image) : "";
      return `<article class="ranking-item"><div class="rank-number"><small>RANK</small>${work.rank}</div><span class="rank-thumb">${image ? `<img src="${escapeHtml(preview)}" ${preview !== image ? `data-original="${escapeHtml(image)}"` : ""} alt="" loading="eager" decoding="async">` : ""}</span><div class="rank-content"><strong class="rank-title">${escapeHtml(work.title || "제목 없는 작품")}</strong><div class="rank-bar" aria-hidden="true"><span style="width:${percent}%"></span></div></div><div class="rank-score"><strong>${work.votes.toLocaleString("ko-KR")}표</strong><span>${percent}%</span></div></article>`;
    }).join("")}</div></section>
    <footer class="report-footer"><span>${exhibition.status === "active" ? "이 결과는 출력 시점의 실시간 집계입니다." : "종료된 전시회의 최종 평가결과입니다."}</span><span>PickSpot · 巫堂先生</span></footer>`;
  document.title = `${exhibition.title || "전시회"} 평가결과 | PickSpot`;
  printButton.disabled = false;
}

function showError(text) {
  page.innerHTML = `<div class="result-error">${escapeHtml(text)}</div>`;
  message.textContent = text;
  printButton.disabled = true;
}

printButton.addEventListener("click", () => window.print());
window.addEventListener("beforeunload", () => unsubscribeVotes?.());

if (!exhibitionId) {
  showError("출력할 전시회가 지정되지 않았습니다.");
} else {
  try {
    await subscribeExhibitions(async exhibitions => {
      const next = exhibitions[exhibitionId];
      if (!next) { showError("전시회를 찾을 수 없습니다."); return; }
      exhibition = next;
      render();
      if (!unsubscribeVotes) {
        unsubscribeVotes = await subscribeVotes(exhibitionId, nextVotes => { votes = nextVotes; render(); }, error => showError(`투표 결과를 불러오지 못했습니다: ${error.message}`));
      }
    }, error => showError(`전시회를 불러오지 못했습니다: ${error.message}`));
  } catch (error) {
    showError(`평가결과 화면을 시작하지 못했습니다: ${error.message}`);
  }
}
