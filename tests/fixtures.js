// Shared test data: five players and a small content pack.
export const P5 = [
  { id: 'p1', name: '민지', color: 'yellow' },
  { id: 'p2', name: '준혁', color: 'orange' },
  { id: 'p3', name: '서연', color: 'sky' },
  { id: 'p4', name: '도윤', color: 'green' },
  { id: 'p5', name: '하은', color: 'pink' },
];

const W = (id, text, cat, extra = {}) => ({ id, text, cat, diff: 1, yesno: true, decoy: text + '2', aliases: [], tags: [], ...extra });

export const C = {
  words: [
    W('w1', '떡볶이', '분식·간식', { decoy: '순대', aliases: ['떡뽁이'] }),
    W('w2', '붕어빵', '분식·간식', { decoy: '호떡' }),
    W('w3', '호떡', '분식·간식', { decoy: '붕어빵' }),
    W('w4', '김치찌개', '음식', { decoy: '된장찌개' }),
    W('w5', '냉면', '음식', { decoy: '밀면' }),
    W('w6', '비빔밥', '음식', { decoy: '볶음밥' }),
    W('w7', '고양이', '동물', { decoy: '강아지' }),
    W('w8', '펭귄', '동물', { decoy: '오리' }),
    W('w9', '수달', '동물', { decoy: '해달' }),
    W('w10', '우산', '물건', { decoy: '양산' }),
    W('w11', '이어폰', '물건', { decoy: '헤드폰' }),
    W('w12', '셀카봉', '물건', { decoy: '삼각대' }),
    W('w13', '편의점', '장소', { decoy: '마트' }),
    W('w14', '노래방', '장소', { decoy: '오락실' }),
    W('w15', '찜질방', '장소', { decoy: '목욕탕' }),
    W('w16', '무한도전', '드라마·예능', { yesno: false, decoy: '런닝맨' }),
  ],
  spectrums: Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, left: `왼쪽${i}`, right: `오른쪽${i}`, diff: 1 })),
  scales: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, theme: `주제${i}`, low: '낮음', high: '높음' })),
};

export const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
};
