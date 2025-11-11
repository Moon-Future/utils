import { parseFile, generateBookInfoFiles } from './src/parser.js';

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
    const epubResult = await parseFile('books/example.epub');
    console.log('解析完成！');
    
    // 生成书籍信息文件
    console.log('\n=== 生成书籍信息文件 ===');
    const result = await generateBookInfoFiles(epubResult, 'bookInfo', 'books/example.epub');
    console.log(`书籍信息已保存到: ${result.bookInfoPath}`);
    console.log(`生成了 ${result.chapterFiles.length} 个章节文件`);
    console.log(`BookId: ${result.bookId}`);

    // 解析 TXT 文件
    console.log('\n=== 解析 TXT 文件示例 ===');
    // const txtResult = await parseFile('example.txt');
    // console.log(JSON.stringify(txtResult, null, 2));

    console.log('\n请将示例文件放在项目根目录，然后取消注释相应的代码行来测试。');
  } catch (error) {
    console.error('错误:', error.message);
  }
}

example();
