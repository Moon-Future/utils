import { parsePDF } from './parsers/pdfParser.js';
import { parseEPUB } from './parsers/epubParser.js';
import { parseTXT } from './parsers/txtParser.js';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

/**
 * 解析文件并提取结构化内容
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 解析后的结构化数据
 */
export async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  console.log(ext);
  console.log(filePath);
  // 检查文件是否存在
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  switch (ext) {
    case '.pdf':
      return await parsePDF(filePath);
    case '.epub':
      return await parseEPUB(filePath);
    case '.txt':
      return await parseTXT(filePath);
    default:
      throw new Error(`不支持的文件类型: ${ext}`);
  }
}

/**
 * 统一的输出数据结构
 */
export function createDocumentStructure(metadata = {}, content = [], images = [], toc = [], text = '') {
  return {
    metadata: {
      title: metadata.title || '',
      author: metadata.author || '',
      creator: metadata.creator || '',
      subject: metadata.subject || '',
      keywords: metadata.keywords || '',
      creationDate: metadata.creationDate || null,
      modificationDate: metadata.modificationDate || null,
      language: metadata.language || 'zh-CN',
      ...metadata,
    },
    tableOfContents: toc,
    content: content,
    images: images,
    // text: text,
    stats: {
      totalParagraphs: content.length,
      totalImages: images.length,
      totalTocItems: toc.length,
      totalWords: content.reduce((sum, item) => {
        return sum + (item.text ? item.text.split(/\s+/).length : 0);
      }, 0),
    },
  };
}

/**
 * 生成唯一ID（数字字符串格式，16位）
 */
let idCounter = 0;
function generateUniqueId() {
  // 生成类似 "1443767254437888" 的16位数字ID
  // 使用时间戳（13位）的后12位 + 计数器（4位）组合，确保唯一性
  const timestamp = Date.now();
  idCounter = (idCounter + 1) % 10000;
  // 取时间戳的后12位，加上4位计数器，总共16位
  const timestampPart = String(timestamp).slice(-12);
  const counterPart = String(idCounter).padStart(4, '0');
  return timestampPart + counterPart;
}

/**
 * 生成唯一bookId
 */
function generateBookId() {
  return randomUUID().replace(/-/g, '');
}

/**
 * 判断是否为有效章节（过滤掉封面、目录等）
 */
function isValidChapter(tocItem) {
  const title = (tocItem.title || '').toLowerCase();
  const id = (tocItem.id || '').toLowerCase();

  // 排除封面、目录、版权页等
  const excludeKeywords = ['cover', 'title page', 'copyright', 'contents', 'toc', 'dedication', 'preview', 'special preview'];
  const excludeIds = ['cvi', 'cvt', 'tp', 'cop', 'toc', 'ded', 'fm1', 'fm2', 'fm3', 'bm1', 'c011']; // 常见的非章节ID

  // 如果ID在排除列表中，直接排除
  if (excludeIds.includes(id)) {
    return false;
  }

  // 检查标题是否包含排除关键词
  return !excludeKeywords.some((keyword) => title.includes(keyword));
}

/**
 * 将章节名称转换为文件名（去除特殊字符）
 */
function chapterNameToFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^chapter\s*(\d+)/i, 'chapter_$1')
    .substring(0, 50); // 限制长度
}

/**
 * 生成书籍信息文件和章节文件
 * @param {Object} document - 解析后的文档结构（createDocumentStructure的返回值）
 * @param {string} outputDir - 输出目录，默认为 'bookInfo'
 * @param {string} filePath - 原始文件路径（可选）
 * @returns {Promise<Object>} 返回生成的文件信息
 */
export async function generateBookInfoFiles(document, outputDir = 'bookInfo', filePath = '') {
  const { metadata, tableOfContents, content } = document;

  // 确保输出目录存在
  const fullOutputDir = path.resolve(outputDir);
  await fs.mkdir(fullOutputDir, { recursive: true });

  // 生成bookId
  const bookId = generateBookId();

  // 过滤有效章节，保持原始顺序
  const allTocItems = tableOfContents.filter(isValidChapter);
  const validChapters = allTocItems.map((tocItem, index) => {
    const fileName = chapterNameToFileName(tocItem.title) || `chapter_${index + 1}`;
    return {
      name: tocItem.title || `Chapter ${index + 1}`,
      file: fileName,
      index: index + 1,
      zh: '',
      tocId: tocItem.id,
    };
  });

  // 如果没有有效章节，尝试从content中提取章节
  if (validChapters.length === 0) {
    // 从content中查找章节
    const chapterMap = new Map();
    content.forEach((item) => {
      if (item.chapter && !chapterMap.has(item.chapter)) {
        const chapterName = item.text || `Chapter ${item.chapterIndex || chapterMap.size + 1}`;
        const fileName = chapterNameToFileName(chapterName) || `chapter_${chapterMap.size + 1}`;
        chapterMap.set(item.chapter, {
          name: chapterName,
          file: fileName,
          index: chapterMap.size + 1,
          zh: '',
          tocId: item.chapter,
        });
      }
    });
    validChapters.push(...Array.from(chapterMap.values()));
  }

  // 如果还是没有章节，创建一个默认章节
  if (validChapters.length === 0) {
    validChapters.push({
      name: 'Chapter 1',
      file: 'chapter_1',
      index: 1,
      zh: '',
      tocId: 'default',
    });
  }

  // 创建bookinfo.json
  const bookInfo = {
    name: metadata.title || 'Untitled',
    zh: '',
    summary: metadata.description || '',
    cover: '',
    chapters: validChapters.map(({ name, file, index, zh }) => ({
      name,
      file,
      index,
      zh,
    })),
    filePath: filePath,
    bookId: bookId,
  };

  // 保存bookinfo.json
  const bookInfoPath = path.join(fullOutputDir, 'bookinfo.json');
  await fs.writeFile(bookInfoPath, JSON.stringify(bookInfo, null, 2), 'utf-8');

  // 按章节分组内容
  const contentByChapter = new Map();

  // 初始化所有章节
  validChapters.forEach((chapter) => {
    contentByChapter.set(chapter.tocId, []);
  });

  // 将内容分配到对应章节
  content.forEach((item) => {
    const chapterId = item.chapter || 'default';
    if (contentByChapter.has(chapterId)) {
      contentByChapter.get(chapterId).push(item);
    } else {
      // 如果章节不存在，添加到默认章节或第一个章节
      const defaultChapterId = validChapters[0]?.tocId || 'default';
      if (!contentByChapter.has(defaultChapterId)) {
        contentByChapter.set(defaultChapterId, []);
      }
      contentByChapter.get(defaultChapterId).push(item);
    }
  });

  // 为每个章节生成文件
  const chapterFiles = [];
  for (const chapter of validChapters) {
    const chapterContent = contentByChapter.get(chapter.tocId) || [];

    // 将内容转换为页面格式
    // 如果没有分页信息，将所有内容放在一页
    const pages = [];
    const currentPage = [];

    chapterContent.forEach((item) => {
      // 包含段落和标题
      if (item.text && item.text.trim()) {
        currentPage.push({
          en: item.text.trim(),
          zh: '',
          id: generateUniqueId(),
        });
      }
    });

    // 如果有内容，添加到pages
    if (currentPage.length > 0) {
      pages.push(currentPage);
    } else {
      // 如果没有内容，至少创建一个空页面
      pages.push([]);
    }

    // 创建章节JSON
    const chapterData = {
      name: chapter.name,
      zh: '',
      pages: pages,
    };

    // 保存章节文件
    const chapterFilePath = path.join(fullOutputDir, `${chapter.file}.json`);
    await fs.writeFile(chapterFilePath, JSON.stringify(chapterData, null, 2), 'utf-8');
    chapterFiles.push(chapterFilePath);
  }

  return {
    bookInfoPath,
    chapterFiles,
    bookId,
  };
}
