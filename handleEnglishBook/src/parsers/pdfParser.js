import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createDocumentStructure } from '../parser.js';

/**
 * 安全解析 PDF 日期
 */
function safeParseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.replace(/^D:/, '').replace(/[^\d]/g, '').padEnd(14, '0');
    const iso = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(8, 10)}:${cleaned.slice(10, 12)}:${cleaned.slice(12, 14)}Z`;
    return new Date(iso).toISOString();
  } catch {
    return null;
  }
}

/**
 * 提取 PDF 文本（优先 pdf-parse，失败则 fallback 到 pdfjs-dist）
 */
async function extractTextWithFallback(buffer) {
  try {
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  } catch {
    console.warn('⚠️ pdf-parse 解析失败，使用 pdfjs-dist 回退方案...');
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }
    return text;
  }
}

/**
 * 主解析函数
 */
export async function parsePDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer).catch(() => ({}));
    const text = await extractTextWithFallback(dataBuffer);

    console.log('pdfData', pdfData, text);

    const metadata = {
      title: pdfData.info?.Title || '',
      author: pdfData.info?.Author || '',
      creator: pdfData.info?.Creator || '',
      subject: pdfData.info?.Subject || '',
      keywords: pdfData.info?.Keywords || '',
      creationDate: safeParseDate(pdfData.info?.CreationDate),
      modificationDate: safeParseDate(pdfData.info?.ModDate),
      language: pdfData.info?.Language || 'zh-CN',
      pages: pdfData.numpages || null,
      version: pdfData.version || null
    };

    const content = extractParagraphs(text);
    const toc = extractTOC(text);
    const images = []; // PDF-parse 不支持图片

    return createDocumentStructure(metadata, content, images, toc, text);
  } catch (error) {
    throw new Error(`PDF 解析失败: ${error.message}`);
  }
}

/**
 * 提取段落与标题
 */
function extractParagraphs(text) {
  const lines = text.split(/\r?\n/);
  const paragraphs = [];
  let current = '';
  let id = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const next = lines[i + 1]?.trim() || '';

    if (isHeading(line, next)) {
      if (current) {
        paragraphs.push({ id: `para_${id++}`, type: 'paragraph', text: current });
        current = '';
      }
      paragraphs.push({
        id: `heading_${id++}`,
        type: 'heading',
        text: line,
        level: estimateHeadingLevel(line)
      });
    } else {
      current += (current ? ' ' : '') + line;
    }
  }

  if (current) {
    paragraphs.push({ id: `para_${id++}`, type: 'paragraph', text: current });
  }

  return paragraphs;
}

/**
 * 判断是否是标题
 */
function isHeading(line, next) {
  // 1️⃣ 明显的编号样式
  if (/^(第[一二三四五六七八九十百]+章|第\d+节|Chapter\s+\d+)/.test(line)) return true;
  // 2️⃣ 英文大写或全角标题
  if (/^[A-Z\s]+$/.test(line) && line.length < 50) return true;
  // 3️⃣ 带数字编号
  if (/^\d+(\.|、)\s*/.test(line)) return true;
  // 4️⃣ 后跟空行或明显分隔
  if (next.length === 0) return true;
  return false;
}

/**
 * 估算标题层级
 */
function estimateHeadingLevel(line) {
  if (/第[一二三四五六七八九十百]+章/.test(line)) return 1;
  if (/第\d+节/.test(line)) return 2;
  const match = line.match(/^(\d+(\.|、))+?/);
  return match ? match[0].split(/\.|、/).length : 3;
}

/**
 * 从文本中提取目录结构
 */
function extractTOC(text) {
  const toc = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    const tocMatch = trimmed.match(/^(.+?)\s+\.{3,}\s*(\d+)$/);
    if (tocMatch) {
      toc.push({
        title: tocMatch[1],
        page: parseInt(tocMatch[2]),
        level: estimateHeadingLevel(tocMatch[1])
      });
    } else if (isHeading(trimmed, '')) {
      toc.push({
        title: trimmed,
        page: null,
        level: estimateHeadingLevel(trimmed)
      });
    }
  }

  return toc;
}
