// item là bí danh content_item ở câu truy vấn ngoài.
// Bản ngừng chặn các bản cũ cùng id, bất kể tier/kind dùng để lọc danh mục.
export const publicContent = `item.status = 'da_duyet' AND NOT EXISTS (
  SELECT 1 FROM content_item AS stopped
  WHERE stopped.id = item.id AND stopped.version > item.version AND stopped.status = 'ngung'
)`;
