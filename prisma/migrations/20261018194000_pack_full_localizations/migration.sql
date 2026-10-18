-- Store independently translated pack chapters, closing copy and score-band labels.
-- The source pack remains authoritative for media assets, boundaries and score thresholds.
ALTER TABLE "QuizPackLocalization"
  ADD COLUMN "sections" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "closingMessage" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "scoreReviews" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Complete the already-published Korean localization of Elon Musk: Stranger Than Fiction.
-- This is a narrowly scoped, idempotent content backfill: a missing pack is left untouched.
UPDATE "QuizPackLocalization"
SET "sections" = '[{"start":1,"title":"억만장자가 되기 전","description":"12살에 게임을 만들던 소년, 형제가 함께 세운 스타트업, 그리고 첫 번째 X까지. 로켓을 쏘아 올리기 훨씬 전에 무슨 일이 있었을까요?"},{"start":6,"title":"로켓 과학과 SF의 만남","description":"세 번의 발사 실패, 스타워즈에 대한 애정, 태양 주위를 도는 궤도로 날아간 뜻밖의 탑승객까지. 현실이 SF를 닮아가는 순간들입니다."},{"start":11,"title":"테슬라의 유쾌하고 기묘한 이야기","description":"창업자에 관한 오해, 재치 있는 듯 장난스러운 차량 이름, 모두를 놀라게 한 깨진 유리창, 그리고 방귀 소리를 내는 자동차까지!"},{"start":16,"title":"억만장자의 별난 유머 감각","description":"모자, 화염방사기가 아니라는 상품, 특이한 향수, 인터넷 농담까지. 실제로 판매한 물건들이 소설보다 더 황당합니다."},{"start":21,"title":"인간 머스크, 밈 속 머스크, 그리고 사실","description":"애니메이션과 영화 속 깜짝 출연, 인공지능 연구의 초기 역사, SF 같은 로드스터 시연까지. 사실과 이미지 사이를 탐험해 보세요."}]'::jsonb,
    "closingMessage" = '8비트 우주 슈팅 게임에서 시작해 태양 궤도를 도는 자동차와 공중으로 솟구친 로드스터까지. 때로는 현실이 소설보다 훨씬 더 놀랍습니다.

어떤 이야기는 기발했고, 어떤 이야기는 황당했으며, 어떤 이야기는 아주 비싼 교훈으로 남았습니다. 일론 머스크를 어떻게 평가하든, 널리 알려진 이미지 뒤의 사실을 다시 들여다볼 만하죠.

가장 의외였던 사실은 무엇인가요? 친구에게 퀴즈를 공유하고 점수를 비교해 보세요!

인물 탐구 · 제1편',
    "scoreReviews" = '[{"minimumScore":0,"title":"지구에서 출발한 탐험가","description":"새로운 사실을 몇 가지 발견했네요! 머스크의 이야기가 로켓과 전기차에서 끝나지 않는다는 건 이제 알게 됐죠."},{"minimumScore":600,"title":"호기심 많은 우주 탐험대원","description":"꽤 잘했어요. 믿기 어려운 진짜 이야기와 과장된 소문을 어느 정도 구별할 수 있겠군요."},{"minimumScore":1150,"title":"소문을 꿰뚫는 팩트체커","description":"엉뚱한 일화는 물론 많은 사람이 놓치는 역사까지 알고 있네요. 이제 친구에게 도전장을 내밀어 보세요."},{"minimumScore":1600,"title":"현실보다 기묘한 이야기의 전문가","description":"스타맨도 감탄할 실력이에요! 인터넷 밈부터 우주 과학, 실리콘밸리의 뒷이야기까지 훌륭하게 통과했습니다."}]'::jsonb
WHERE "packId" = '6fefac38-db59-40ec-9b9a-7bc36a42280a'
  AND "locale" = 'ko'
  AND "status" = 'PUBLISHED';
