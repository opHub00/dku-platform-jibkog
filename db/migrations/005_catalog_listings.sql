-- 청약 카탈로그(수집한 청약 공고) 기반 매물 필드와 예시 매물 표시. docs/api-catalog.md 5·6절
-- catalog_complex_id: GET /api/catalog/complexes의 id(청약홈 주택관리번호). 카탈로그는 서버 캐시라 외래키는 걸지 않는다.
-- housing_model_number: 그 공고 주택형의 모델번호("01").
-- is_demo: 서버가 만든 시연용 예시 매물이면 TRUE. 화면은 "시연용 예시 매물"로 표시한다.
ALTER TABLE listings
  ADD COLUMN catalog_complex_id TEXT,
  ADD COLUMN housing_model_number TEXT,
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE listings
  ADD CONSTRAINT listings_catalog_pair
    CHECK ((catalog_complex_id IS NULL) = (housing_model_number IS NULL)),
  ADD CONSTRAINT listings_catalog_trade_only
    CHECK (type = 'trade' OR (catalog_complex_id IS NULL AND is_demo = FALSE));

-- 예시 매물 시드는 (단지, 주택형, 판매자)마다 하나만 만든다. 재시작해도 중복 생성하지 않는지 확인할 때 쓴다.
CREATE INDEX listings_catalog ON listings(catalog_complex_id, housing_model_number)
  WHERE catalog_complex_id IS NOT NULL;
