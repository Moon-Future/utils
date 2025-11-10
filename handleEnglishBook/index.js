import { parseFile } from './src/parser.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 主入口文件
 * 使用示例
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法: node index.js <文件路径> [输出路径]');
    console.log('示例: node index.js example.pdf output.json');
    process.exit(1);
  }

  const filePath = args[0];
  const outputPath = args[1] || filePath.replace(/\.[^.]+$/, '.json');

  try {
    console.log(`正在解析文件: ${filePath}`);
    const result = await parseFile(filePath);
    
    // 保存结果
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`解析完成！结果已保存到: ${outputPath}`);
    console.log(`\n统计信息:`);
    console.log(`- 段落数: ${result.stats.totalParagraphs}`);
    console.log(`- 图片数: ${result.stats.totalImages}`);
    console.log(`- 目录项: ${result.stats.totalTocItems}`);
    console.log(`- 总字数: ${result.stats.totalWords}`);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { parseFile };

