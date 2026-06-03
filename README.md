# Instagram 비즈니스 콘텐츠 성과 대시보드

Meta Graph API(v21.0)로 인스타그램 비즈니스 계정의 최근 게시물 25개 인사이트를
불러와 카드 형태로 보여주는 대시보드입니다.

## 보여주는 지표
도달(reach), 조회(views), 좋아요(likes), 댓글(comments), 저장(saved), 공유(shares),
그리고 게시물별 **저장율 = 저장 ÷ 도달**.

## 설치 & 실행
```bash
npm install
cp .env.example .env   # .env를 열어 토큰과 계정 ID 입력
npm start              # http://localhost:3000
```

## .env 설정
| 변수 | 설명 |
|------|------|
| `ACCESS_TOKEN` | 장기 액세스 토큰 (권한: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`) |
| `IG_ACCOUNT_ID` | 인스타그램 비즈니스 계정 ID (숫자 ID, @username 아님) |
| `PORT` | (선택) 서버 포트, 기본 3000 |

## 보안 메모
- 토큰은 **서버에서만** `.env`로 읽습니다. 브라우저로 노출되지 않습니다.
- 프론트엔드는 토큰 없이 자체 `/api/posts` 엔드포인트만 호출합니다.
- `.env`는 `.gitignore`에 포함되어 커밋되지 않습니다.

## 참고
- 일부 지표(`views`, `shares` 등)는 미디어 타입에 따라 지원되지 않을 수 있습니다.
  서버는 그런 경우 해당 지표만 건너뛰고 나머지는 정상 표시합니다.
- 도달이 0이면 저장율은 `—`로 표시됩니다.
