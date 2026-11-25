const number = new Intl.NumberFormat('ko-KR');
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });

function won(value) {
  const abs = value < 0n ? -value : value;
  const sign = value < 0 ? '-' : '';
  if (abs < 10000n) return sign + number.format(abs) + '원';
  const eok = abs / 100000000n;
  const man = abs % 100000000n / 10000n;
  return sign + [eok && number.format(eok) + '억', man && number.format(man) + '만'].filter(Boolean).join(' ');
}

function noticeStatus(row, today) {
  if (row.applications_close && today > row.applications_close) return '청약 마감';
  if (row.applications_open && today < row.applications_open) return '청약 예정';
  if (row.applications_open && row.applications_close) return '접수 중';
  return '일정 확인';
}

function card(row, today) {
  const trade = row.type === 'trade';
  const detail = [];
  if (trade) {
    if (row.move_in_month) detail.push('입주 예정 ' + row.move_in_month.replace('-', '. '));
    const premium = Math.abs(row.premium) >= 100000000
      ? Number((row.premium / 100000000).toFixed(1)) + '억' : won(BigInt(row.premium));
    detail.push('프리미엄 ' + premium);
  } else {
    const dates = [row.applications_open, row.applications_close]
      .map(date => date ? date.slice(5).replace('-', '. ') : '미정');
    if (row.applications_open || row.applications_close) detail.push('신청 ' + dates.join(' ~ '));
    if (row.total_units !== null) detail.push('총 ' + number.format(row.total_units) + '세대');
  }
  return {
    id: row.id, type: row.type, title: row.title, location: row.address,
    ...(row.district ? { district: row.district } : {}), image: row.image ?? '/assets/modern-home.jpg',
    price: trade ? won(BigInt(row.sale_price) + BigInt(row.premium) + BigInt(row.option_cost)) : noticeStatus(row, today),
    detail: detail.join(' · '), date: row.posted_day === today ? '오늘' : row.posted_day,
    tag: trade ? '분양권 거래' : '청약공고', tagTone: trade ? 'green' : 'navy',
    liked: Boolean(row.liked), urgent: Boolean(row.urgent),
    ...(row.latitude === null ? {} : { lat: row.latitude, lng: row.longitude }),
  };
}

// userId is supplied by the server after authentication.
export async function listCards(db, { scope = 'public', userId = null, now = new Date() } = {}) {
  if (!['public', 'favorites', 'mine'].includes(scope)) throw new Error('Unknown listing scope');
  if (userId !== null && (!Number.isSafeInteger(userId) || userId <= 0)) throw new Error('Invalid user ID');
  if (scope !== 'public' && userId === null) throw new Error('A user ID is required');
  const source = scope === 'mine' ? 'listings' : 'public_listings';
  const filter = { public: '', favorites: 'WHERE f.user_id IS NOT NULL', mine: 'WHERE l.seller_id = $1' }[scope];
  const { rows } = await db.query(`
    SELECT l.id, l.type, l.title, l.sale_price, l.premium, l.option_cost, l.total_units, l.urgent,
           to_char(l.applications_open, 'YYYY-MM-DD') AS applications_open,
           to_char(l.applications_close, 'YYYY-MM-DD') AS applications_close,
           to_char(l.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS posted_day,
           c.address, c.move_in_month, c.image, c.latitude, c.longitude,
           d.sido || ' ' || d.sigungu AS district, f.user_id IS NOT NULL AS liked
    FROM ${source} AS l
    JOIN complexes AS c ON c.id = l.complex_id
    LEFT JOIN districts AS d ON d.id = c.district_id
    LEFT JOIN favorites AS f ON f.listing_id = l.id AND f.user_id = $1
    ${filter}
    ORDER BY l.created_at DESC, l.id DESC
  `, [userId]);
  const today = calendar.format(now);
  return rows.map(row => card(row, today));
}
