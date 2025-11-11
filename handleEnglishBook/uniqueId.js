function generateUniqueId() {
  // 生成类似 "1443767254437888" 的16位数字ID
  // 使用时间戳（13位）的后12位 + 计数器（4位）组合，确保唯一性
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10);
  const idCounter = (random + 1) % 10000;
  // 取时间戳的后12位，加上4位计数器，总共16位
  const timestampPart = String(timestamp).slice(-12);
  const counterPart = String(idCounter).padStart(4, '0');
  return timestampPart + counterPart;
}

console.log(generateUniqueId());
