# Worldsmith — 게놈 컴파일러

말(텍스트) → 게놈(JSON) → 형태(3D). LLM은 게놈만 쓰고, 형태는 브라우저가 컴파일한다.

- `index.html` 테스트 화면. 같은 말에서 변주 3개, 다이얼(크기·장식·세월·색·재료), 시대 4종.
- `src/genome.js` 텍스트→게놈 로컬 파서(LLM 대역). 실제 서버는 같은 JSON을 돌려준다.
- `src/compile/building.js` 형태 문법: 평면(원·다각·L·T·십자·베이) → 층 → 지붕(hip/gable/dome/cone/tiered/flat/stepped) → 장식·twist.
- `src/compile/creature.js` 메타볼(마칭큐브) 척추 + 다리·날개·지느러미·뿔.
- `src/compile/tree.js` 재귀 분기(L-시스템) + 시대별 잎.
- `src/eras.js` 시대·땅 카드(팔레트, 지붕 취향, 재료, 잠긴 재료).

## 실행
```
npm i
node tools/shot.cjs out.png "하늘을 나는 고래" "낡은 성"   # 헤드리스 렌더 스크린샷
```
브라우저에서는 `index.html`을 정적 서버로 열면 된다(importmap이 jsdelivr의 three 0.170을 쓴다).
