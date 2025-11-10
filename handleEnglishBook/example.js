import { parseFile } from './src/parser.js';

/**
 * 使用示例
 */
async function example() {
  try {
    // 解析 PDF 文件
    console.log('=== 解析 PDF 文件示例 ===');
    // const pdfResult = await parseFile('example.pdf');
    // console.log(JSON.stringify(pdfResult, null, 2));

    // 解析 EPUB 文件
    console.log('=== 解析 EPUB 文件示例 ===');
    const epubResult = await parseFile('example.epub');
    // console.log(JSON.stringify(epubResult, null, 2));

    // 解析 TXT 文件
    console.log('=== 解析 TXT 文件示例 ===');
    // const txtResult = await parseFile('example.txt');
    // console.log(JSON.stringify(txtResult, null, 2));

    console.log('\n请将示例文件放在项目根目录，然后取消注释相应的代码行来测试。');
  } catch (error) {
    console.error('错误:', error.message);
  }
}

example();
