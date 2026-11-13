// Công thức tích lũy Kusala — bất biến trong CLAUDE.md/AGENTS.md, phải giống nhau ở client và máy chủ.
// E = B × (trước + trong + sau)/3 × M_trí (1,5 nếu như lý tác ý) × M_tự giác (1,25 nếu tự giác), làm tròn 2 chữ số.
export const KUSALA = Object.freeze({ BASE: 10, MIN: 0.5, MAX: 1.2, WISE: 1.5, SELF: 1.25, PILLARS: Object.freeze(['duc', 'thien', 'tue']) });

export function kusala({ base = 10, pre = 1, during = 1, post = 1, wise = false, self = false }) {
  return Math.round(base * ((pre + during + post) / 3) * (wise ? 1.5 : 1) * (self ? 1.25 : 1) * 100) / 100;
}

// Kiểm đầu vào ở máy chủ: thanh trượt chỉ trong [0,5; 1,2].
export const validFactor = (x) => typeof x === 'number' && Number.isFinite(x) && x >= KUSALA.MIN && x <= KUSALA.MAX;
