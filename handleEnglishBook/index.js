import { parseFile, generateBookInfoFiles } from './src/parser.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 主入口文件
 * 使用示例
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法:');
    console.log('  1. 解析文件并保存JSON: node index.js <文件路径> [输出路径]');
    console.log('  2. 生成书籍信息文件: node index.js <文件路径> --book-info [输出目录]');
    console.log('\n示例:');
    console.log('  node index.js example.pdf output.json');
    console.log('  node index.js example.epub --book-info bookInfo');
    process.exit(1);
  }

  const filePath = args[0];
  const isBookInfoMode = args.includes('--book-info');
  const outputDirIndex = args.indexOf('--book-info');
  const outputPath = isBookInfoMode 
    ? (args[outputDirIndex + 1] || 'bookInfo')
    : (args[1] || filePath.replace(/\.[^.]+$/, '.json'));

  try {
    console.log(`正在解析文件: ${filePath}`);
    const result = await parseFile(filePath);
    
    if (isBookInfoMode) {
      // 生成书籍信息文件
      console.log(`\n正在生成书籍信息文件到: ${outputPath}`);
      const bookInfoResult = await generateBookInfoFiles(result, outputPath, filePath);
      console.log(`\n生成完成！`);
      console.log(`- 书籍信息文件: ${bookInfoResult.bookInfoPath}`);
      console.log(`- 章节文件数: ${bookInfoResult.chapterFiles.length}`);
      console.log(`- BookId: ${bookInfoResult.bookId}`);
    } else {
      // 保存原始解析结果
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`解析完成！结果已保存到: ${outputPath}`);
      console.log(`\n统计信息:`);
      console.log(`- 段落数: ${result.stats.totalParagraphs}`);
      console.log(`- 图片数: ${result.stats.totalImages}`);
      console.log(`- 目录项: ${result.stats.totalTocItems}`);
      console.log(`- 总字数: ${result.stats.totalWords}`);
    }
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

export { parseFile, generateBookInfoFiles };

