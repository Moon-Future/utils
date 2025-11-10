import { parsePDF } from './parsers/pdfParser.js';
import { parseEPUB } from './parsers/epubParser.js';
import { parseTXT } from './parsers/txtParser.js';
import path from 'path';
import fs from 'fs/promises';

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
      ...metadata
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
    }
  };
}

