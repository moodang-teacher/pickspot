import { firebaseConfig } from "./firebase-config.js";

export const isDemo = !firebaseConfig.apiKey || !firebaseConfig.databaseURL || !firebaseConfig.projectId;
const DEMO_KEY = "contest-hunters-demo-v1";
const sdkVersion = "12.19.0";
let firebase;

const demoSeed = {
  exhibitions: {
    "autumn-ideas": {
      title: "2026 가을 아이디어 전시회", description: "우리의 일상에서 발견한 작은 문제들. 학생들의 시선으로 그린 새로운 가능성을 만나보세요.",
      status: "active", startsAt: Date.now() - 86400000, createdAt: Date.now() - 86400000,
      works: {
        "work-1": { title: "도시의 숨", description: "회색 도시 안에서 자연의 호흡을 되찾는 방법을 제안합니다.", order: 1, imageUrl: "" },
        "work-2": { title: "다시, 쓰다", description: "버려진 물건의 두 번째 이야기를 만드는 순환 디자인 프로젝트입니다.", order: 2, imageUrl: "" },
        "work-3": { title: "소리 없는 신호", description: "누구에게나 전달될 수 있는 새로운 안내 언어를 탐구합니다.", order: 3, imageUrl: "" },
        "work-4": { title: "내일의 식탁", description: "지속 가능한 먹거리와 함께하는 가까운 미래를 상상합니다.", order: 4, imageUrl: "" },
        "work-5": { title: "틈의 발견", description: "익숙한 공간의 작은 틈에서 새로운 쓰임을 발견합니다.", order: 5, imageUrl: "" },
        "work-6": { title: "느린 길", description: "속도보다 풍경을 선택하는 이동 경험을 디자인합니다.", order: 6, imageUrl: "" },
        "work-7": { title: "별을 잇다", description: "서로 다른 이야기들을 연결하는 참여형 전시입니다.", order: 7, imageUrl: "" },
        "work-8": { title: "작은 파동", description: "하나의 실천이 만드는 커다란 변화의 시작을 기록합니다.", order: 8, imageUrl: "" },
        "work-9": { title: "우리의 온도", description: "세대와 지역을 잇는 따뜻한 공공 공간을 제안합니다.", order: 9, imageUrl: "" }
      }
    },
    "spring-2026": {
      title: "2026 봄 포스터 전시회", description: "지난 봄, 캠퍼스를 채운 다섯 가지 생각을 다시 만납니다.",
      status: "closed", startsAt: new Date("2026-04-01T09:00:00+09:00").getTime(), endsAt: new Date("2026-04-15T18:00:00+09:00").getTime(), createdAt: new Date("2026-03-20T09:00:00+09:00").getTime(),
      works: {
        "work-1": { title: "빛의 결", description: "자연광이 공간과 사람에게 남기는 흔적을 시각화했습니다.", order: 1 },
        "work-2": { title: "초록 편지", description: "도시에서 자연에게 보내는 짧은 메시지입니다.", order: 2 },
        "work-3": { title: "다른 시선", description: "평범한 사물을 낯선 각도에서 바라봅니다.", order: 3 },
        "work-4": { title: "공유의 모양", description: "함께 쓰는 물건과 공간의 가능성을 그렸습니다.", order: 4 },
        "work-5": { title: "여백의 힘", description: "비워둔 자리가 만들어 내는 풍부한 이야기를 담았습니다.", order: 5 }
      }
    }
  },
  voteCounts: { "autumn-ideas": { "work-1": 24, "work-2": 18, "work-3": 12, "work-4": 15, "work-5": 8, "work-6": 11, "work-7": 17, "work-8": 9, "work-9": 14 }, "spring-2026": { "work-1": 41, "work-2": 28, "work-3": 36, "work-4": 19, "work-5": 24 } }
};

function demoData() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || demoSeed; }
  catch { return demoSeed; }
}
function saveDemo(data) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("demo-data-change"));
}
export function resetDemoData() {
  if (!isDemo) return;
  localStorage.removeItem(DEMO_KEY);
  Object.keys(localStorage).filter(key => key.startsWith("hasVoted:")).forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new Event("demo-data-change"));
}
function watchDemo(read, callback) {
  const listener = () => callback(read(demoData()));
  window.addEventListener("storage", listener);
  window.addEventListener("demo-data-change", listener);
  listener();
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("demo-data-change", listener); };
}
async function getFirebase() {
  if (firebase) return firebase;
  const [appSdk, dbSdk, authSdk] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-database.js`),
    import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-auth.js`)
  ]);
  const app = appSdk.initializeApp(firebaseConfig);
  firebase = { db: dbSdk.getDatabase(app), auth: authSdk.getAuth(app), dbSdk, authSdk };
  return firebase;
}

export async function subscribeExhibitions(callback, onError) {
  if (isDemo) return watchDemo(data => data.exhibitions, callback);
  const { db, dbSdk } = await getFirebase();
  return dbSdk.onValue(dbSdk.ref(db, "exhibitions"), snapshot => callback(snapshot.val() || {}), onError);
}
export async function subscribeVotes(exhibitionId, callback, onError) {
  if (isDemo) return watchDemo(data => data.voteCounts?.[exhibitionId] || {}, callback);
  const { db, dbSdk } = await getFirebase();
  return dbSdk.onValue(dbSdk.ref(db, `voteCounts/${exhibitionId}`), snapshot => callback(snapshot.val() || {}), onError);
}
export async function voteFor(exhibitionId, workId) {
  if (isDemo) {
    const data = demoData();
    if (data.exhibitions?.[exhibitionId]?.status !== "active" || !data.exhibitions[exhibitionId].works?.[workId]) throw new Error("투표가 종료되었거나 작품을 찾을 수 없습니다.");
    data.voteCounts[exhibitionId] ||= {};
    data.voteCounts[exhibitionId][workId] = (Number(data.voteCounts[exhibitionId][workId]) || 0) + 1;
    saveDemo(data);
    return;
  }
  const { db, dbSdk } = await getFirebase();
  const result = await dbSdk.runTransaction(dbSdk.ref(db, `voteCounts/${exhibitionId}/${workId}`), current => (Number(current) || 0) + 1, { applyLocally: false });
  if (!result.committed) throw new Error("투표가 완료되지 않았습니다.");
}

async function hasAdminRole(uid) {
  const { db, dbSdk } = await getFirebase();
  const snapshot = await dbSdk.get(dbSdk.ref(db, `admins/${uid}`));
  return snapshot.val() === true;
}
export async function onAdminState(callback) {
  if (isDemo) { callback(null); return () => {}; }
  const { auth, authSdk } = await getFirebase();
  let revision = 0;
  const unsubscribe = authSdk.onAuthStateChanged(auth, async user => {
    const currentRevision = ++revision;
    callback(null);
    if (!user) return;
    try {
      const authorized = await hasAdminRole(user.uid);
      if (currentRevision === revision && auth.currentUser?.uid === user.uid) callback(authorized ? user : null);
    } catch (error) {
      if (currentRevision === revision) callback(null);
      console.error("관리자 권한을 확인하지 못했습니다.", error);
    }
  });
  return () => { revision++; unsubscribe(); };
}
export async function signInAdmin(email, password) {
  if (isDemo) throw new Error("Firebase 프로젝트를 연결한 뒤 로그인할 수 있습니다.");
  const { auth, authSdk } = await getFirebase();
  const credential = await authSdk.signInWithEmailAndPassword(auth, email, password);
  let authorized;
  try { authorized = await hasAdminRole(credential.user.uid); }
  catch (error) { await authSdk.signOut(auth); throw error; }
  if (!authorized) {
    await authSdk.signOut(auth);
    throw new Error("관리자 권한이 없는 계정입니다.");
  }
}
export async function signOutAdmin() {
  if (isDemo) return;
  const { auth, authSdk } = await getFirebase();
  await authSdk.signOut(auth);
}
export async function createExhibition(exhibition) {
  if (isDemo) {
    const data = demoData();
    const id = `expo-${Date.now().toString(36)}`;
    data.exhibitions[id] = exhibition;
    data.voteCounts[id] = Object.fromEntries(Object.keys(exhibition.works).map(key => [key, 0]));
    saveDemo(data);
    return id;
  }
  const { db, dbSdk } = await getFirebase();
  const id = dbSdk.push(dbSdk.ref(db, "exhibitions")).key;
  const updates = { [`exhibitions/${id}`]: exhibition };
  Object.keys(exhibition.works).forEach(key => { updates[`voteCounts/${id}/${key}`] = 0; });
  await dbSdk.update(dbSdk.ref(db), updates);
  return id;
}
export async function closeExhibition(id) {
  if (isDemo) {
    const data = demoData();
    if (!data.exhibitions[id]) throw new Error("전시회를 찾을 수 없습니다.");
    data.exhibitions[id].status = "closed";
    data.exhibitions[id].endsAt = Date.now();
    saveDemo(data);
    return;
  }
  const { db, dbSdk } = await getFirebase();
  await dbSdk.update(dbSdk.ref(db, `exhibitions/${id}`), { status: "closed", endsAt: Date.now() });
}
