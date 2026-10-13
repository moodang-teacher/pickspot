# PickSpot MVP

전시회를 여러 번 열고, 작품별 투표와 지난 전시회의 결과를 볼 수 있는 정적 웹앱입니다.

## 실행

로컬 서버를 실행하고 `http://localhost:8000`을 엽니다.

```powershell
python -m http.server 8000
```

현재 앱은 Firebase 프로젝트 `pickspot-4c593`와 싱가포르 Realtime Database에 연결되어 있습니다. 아직 실제 데이터베이스에 전시회를 만들지 않았으므로 첫 화면의 전시회 목록은 비어 있습니다.

`firebase-config.js`의 설정이 비어 있을 때만 관람객 화면이 **데모 모드**로 실행됩니다. 데모 데이터는 해당 브라우저의 `localStorage`에만 저장되며, 관리자 화면은 Firebase 연결 전까지 로그인할 수 없습니다.

## Firebase 연결과 관리

현재 프로젝트에는 [`database.rules.json`](database.rules.json)의 규칙이 배포되어 있고, Firebase Authentication의 관리자 계정 UID에 관리자 권한(`/admins/<UID> = true`)이 등록되어 있습니다. 이메일과 비밀번호는 소스 파일에 저장하지 않습니다.

로컬 관리자 화면에서 해당 계정으로 로그인해 전시회 관리 화면이 열리는 것까지 확인했습니다. 현재 실제 데이터베이스에는 전시회가 없습니다.

규칙을 수정한 뒤에는 프로젝트 루트에서 `firebase deploy --only database --project pickspot-4c593`로 다시 배포합니다. [`.firebaserc`](.firebaserc)와 [`firebase.json`](firebase.json)이 대상 프로젝트와 규칙 파일을 지정합니다.

다른 Firebase 프로젝트로 옮길 때는 다음 단계를 따릅니다.

1. Firebase 프로젝트를 만들고 웹 앱을 등록합니다. Realtime Database와 Authentication의 **이메일/비밀번호** 로그인 방식을 활성화합니다.
2. [`firebase-config.js`](firebase-config.js)에 웹 앱 설정(`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`)을 입력합니다. 설정값은 브라우저에 공개되는 값이며 권한은 Database Rules가 담당합니다.
3. Firebase Console의 Authentication > 사용자에서 관리자 계정을 만들고 비밀번호를 설정합니다. 이메일과 비밀번호는 웹앱 파일이나 Git에 기록하지 마세요.
4. 생성한 계정의 UID를 확인하고 Realtime Database에서 `/admins/<UID>` 값을 Boolean `true`로 만듭니다. 관리자 권한은 이 경로에서 확인하며, 클라이언트에서는 변경할 수 없습니다. 관리자를 추가할 때도 Authentication 계정 생성과 UID 등록을 반복합니다.
5. Realtime Database의 Rules 탭에 [`database.rules.json`](database.rules.json)의 `rules` 내용을 적용하거나, CLI에서 대상 프로젝트를 지정해 규칙을 배포합니다.
6. Authentication의 승인된 도메인에 배포 도메인을 추가합니다. GitHub Pages를 쓴다면 `https://<계정>.github.io/<저장소>/`에서 실행되도록 파일을 배포합니다.

이후 **巫堂先生** 링크로 관리자 화면(`admin.html`)에 들어가 로그인하면 전시회를 만들 수 있습니다. 전시회 링크는 `index.html#/e/<전시회 ID>` 형태이며, 관리자 화면의 **주소 복사** 버튼으로 받을 수 있습니다. 이 URL을 QR 코드로 만들어 현장 포스터에 넣으면 됩니다.

## 작품 이미지 라이브러리

작품 이미지를 `assets/works/` 폴더 바로 아래에 넣습니다. JPG, PNG, WebP, AVIF, GIF 파일을 사용할 수 있습니다. GitHub에 푸시하면 배포된 관리자 화면의 **라이브러리에서 선택** 버튼이 공개 GitHub 저장소의 이미지 파일 목록을 읽어 썸네일로 보여줍니다. 선택한 상대 경로만 Firebase에 저장됩니다. 이미지는 GitHub Pages에서 제공하므로 Firebase Storage 요금제를 설정할 필요가 없습니다.

로컬에서 새 이미지를 바로 확인하려면 `python scripts/build_work_library.py`를 실행하고 관리자 화면을 새로고침합니다. GitHub Pages의 배포 소스는 저장소 설정에서 **main 브랜치의 /(root)**로 선택합니다. GitHub API가 일시적으로 작동하지 않을 때에는 `assets/works/index.json`을 대체 목록으로 사용합니다. 전시회에 사용 중인 이미지 파일을 삭제하거나 이름을 바꾸면 기존 전시회의 이미지도 보이지 않으므로 경로를 유지하세요.

## MVP 범위

- 전시회 생성, 종료, 여러 전시회 기록 보관
- 작품 수 제한 없는 등록, 모든 작품을 겹쳐 펼치는 카드 덱과 스와이프 탐색
- 전시회별 `localStorage` 중복 투표 방지
- Firebase 트랜잭션 투표, 실시간 결과 및 지난 전시회 결과 조회
- Firebase Authentication 이메일 로그인과 `/admins/<UID>` 권한 확인, Database Rules를 통한 데이터 관리 권한

전시회 생성 후 작품 수정, 자동 종료 예약, 앱 안의 QR 이미지 생성은 다음 단계로 남겨두었습니다. 관람객 인증을 요구하지 않으므로 같은 사람이 다른 브라우저나 기기로 재투표하는 것은 막지 않습니다.

## 파일

- `index.html`, `app.js`, `styles.css`: 관람객 화면
- `admin.html`, `admin.js`, `admin.css`: 운영자 화면
- `data.js`: Firebase와 데모 데이터 어댑터
- `firebase-config.js`, `database.rules.json`, `firebase.json`, `.firebaserc`: Firebase 설정과 권한 규칙 배포
- `brand.css`, `assets/`: PickSpot 로고와 작품 이미지
- `scripts/build_work_library.py`, `assets/works/index.json`: 로컬 작품 이미지 목록 생성과 공개 저장소 API의 대체 목록

## 로고 사용 기준

- `assets/pickspot_logo.png`: PWA 아이콘 원본, 파비콘, 모바일 화면과 좁은 영역의 로고. 현재 헤더와 파비콘에 사용합니다.
- `assets/pickspot_logo_big.png`: 넓은 영역의 로고. 현재 데스크톱 첫 화면의 큰 로고에 사용합니다.

PWA를 추가할 때 아이콘은 `pickspot_logo.png`를 원본으로 사용합니다.

Firebase 웹 SDK는 공식 CDN의 모듈을 사용합니다. 네트워크 접속이 필요한 것은 Firebase 연결 상태에서만이며, 데모 모드는 별도 설치 없이 실행됩니다.
