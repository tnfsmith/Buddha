// Mã Phước nghiệp sự (10, theo Chú giải) và Ba-la-mật (10, theo Buddhavaṃsa) — PROJECT_ROADMAP.md Phụ lục H.
// Dùng trong kusala_entry, deed_log và content/. Câu chữ hiển thị chờ Hội đồng cố vấn Pháp học duyệt.
export const PUNNA = Object.freeze({
  dana: 'Bố thí', sila: 'Trì giới', bhavana: 'Tu tập (thiền)', apacayana: 'Cung kính', veyyavacca: 'Phục vụ',
  pattidana: 'Hồi hướng', pattanumodana: 'Tùy hỷ', dhammassavana: 'Nghe Pháp', dhammadesana: 'Thuyết Pháp / chia sẻ Pháp', ditthujukamma: 'Chỉnh trực tri kiến',
});
export const PARAMI = Object.freeze({
  dana: 'Bố thí', sila: 'Trì giới', nekkhamma: 'Xuất ly', panna: 'Trí tuệ', viriya: 'Tinh tấn',
  khanti: 'Nhẫn nại', sacca: 'Chân thật', adhitthana: 'Quyết định', metta: 'Tâm từ', upekkha: 'Xả',
});
// Ba trụ cột của Tầng 0 (Sīla – Dāna – Bhāvanā) ↔ ba trục Đức – Thiện – Tuệ
export const PILLAR_PUNNA = Object.freeze({ duc: 'sila', thien: 'dana', tue: 'bhavana' });
export const isPunna = (c) => Object.hasOwn(PUNNA, c);
export const isParami = (c) => Object.hasOwn(PARAMI, c);
