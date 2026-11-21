# 집콕 (Zip-Cok) — Frontend

청약 매칭 + 분양권 C2C 거래 부동산 플랫폼. React + TypeScript + Tailwind 기반 프론트엔드 프로토타입.

## 실행

```
pnpm install
pnpm dev      # http://localhost:3000
pnpm check    # 타입 체크
pnpm build    # 프로덕션 빌드
```

## 구조

- `client/src/App.tsx` — 앱 쉘 (테마, 라우팅)
- `client/src/pages/Home.tsx` — 화면 상태(홈/매물/채팅/관심/MY) 및 하단 탭 전환
- `client/src/components/ui/` — shadcn/ui 컴포넌트 모음
- `client/src/index.css` — 색상 토큰, 레이아웃 스타일

현재 버전은 실제 백엔드 없이 더미 데이터 + 로컬 상태로 동작하는 프로토타입이다. 자세한 기획 내용은 `plan.md`, 진행 체크리스트는 `TODO.md` 참고.
