# Gemini 최근 청약 뉴스 목업

최근 21일 동안 발표된 청약홈 공고 중 접수 중이거나 접수 예정인 공고를 조회해 `api/generating_news/generated_news.json`에 뉴스를 저장합니다.

프로젝트 최상위 폴더에서 실행하세요. `--region`을 생략하면 서울을 조회합니다.

```powershell
python -X utf8 -B .\api\generating_news\generating_recent_news.py --region 경기
```
