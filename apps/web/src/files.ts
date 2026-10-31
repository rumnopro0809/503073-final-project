export function fileBase64(file: File, maxBytes: number): Promise<string> {
  if (!file.size || file.size > maxBytes) return Promise.reject(new Error(`Tệp phải có dung lượng từ 1 byte đến ${maxBytes / 1024 / 1024} MB.`));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được tệp. Hãy chọn lại.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}
