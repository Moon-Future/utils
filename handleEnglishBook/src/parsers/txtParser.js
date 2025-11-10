import fs from 'fs/promises';
import path from 'path';
import { createDocumentStructure } from '../parser.js';

/**
 * 解析 TXT 文件
 * @param {string} filePath - TXT 文件路径
 * @returns {Promise<Object>} 解析后的结构化数据
 */
export async function parseTXT(filePath) {
  try {
    // 尝试不同的编码
    let content = '';
    const encodings = ['utf8', 'utf-8', 'gbk', 'gb2312', 'latin1'];
    
    for (const encoding of encodings) {
      try {
        content = await fs.readFile(filePath, encoding);
        break;
      } catch (error) {
        // 尝试下一个编码
        continue;
      }
    }

    if (!content) {
      // 如果所有编码都失败，使用 Buffer 读取
      const buffer = await fs.readFile(filePath);
      content = buffer.toString('utf8');
    }

    // 提取元数据（TXT 文件通常没有元数据，使用文件名）
    const metadata = {
      title: extractTitleFromContent(content) || path.basename(filePath, '.txt'),
      language: detectLanguage(content)
    };

    // 提取段落和目录
    const { paragraphs, toc } = extractStructureFromText(content);

    return createDocumentStructure(metadata, paragraphs, [], toc);
  } catch (error) {
    throw new Error(`TXT 解析失败: ${error.message}`);
  }
}

/**
 * 从内容中提取标题
 */
function extractTitleFromContent(content) {
  const lines = content.split('\n').slice(0, 10);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 100) {
      // 可能是标题
      return trimmed;
    }
  }
  return null;
}

/**
 * 检测语言
 */
function detectLanguage(text) {
  // 简单的语言检测
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const englishWords = text.match(/[a-zA-Z]+/g);
  
  if (chineseChars && chineseChars.length > 100) {
    return 'zh-CN';
  }
  if (englishWords && englishWords.length > 100) {
    return 'en';
  }
  return 'zh-CN';
}

/**
 * 从文本中提取结构和段落
 */
function extractStructureFromText(text) {
  const paragraphs = [];
  const toc = [];
  const lines = text.split('\n');
  
  let currentParagraph = '';
  let paragraphIndex = 0;
  let inTOCSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 检测目录区域（通常包含"目录"、"目 录"等关键词）
    if (line.match(/^[目目录录]{1,2}$/i) || line.match(/^目\s*录$/i)) {
      inTOCSection = true;
      continue;
    }
    
    // 检测目录项
    if (inTOCSection) {
      const tocMatch = line.match(/^(.+?)\s+\.{3,}\s*(\d+)$/) || 
                       line.match(/^(\d+[\.、]\s*.+?)$/);
      if (tocMatch) {
        toc.push({
          title: tocMatch[1] || tocMatch[0],
          page: tocMatch[2] ? parseInt(tocMatch[2]) : null,
          level: estimateHeadingLevel(tocMatch[1] || tocMatch[0])
        });
        continue;
      }
      
      // 如果遇到空行或正文内容，退出目录区域
      if (line.length === 0 || line.length > 50) {
        inTOCSection = false;
      }
    }
    
    // 处理正文
    if (line.length === 0) {
      // 空行，结束当前段落
      if (currentParagraph.trim().length > 0) {
        paragraphs.push({
          id: `para_${paragraphIndex++}`,
          type: 'paragraph',
          text: currentParagraph.trim()
        });
        currentParagraph = '';
      }
    } else if (isLikelyHeading(line, lines[i + 1])) {
      // 可能是标题
      if (currentParagraph.trim().length > 0) {
        paragraphs.push({
          id: `para_${paragraphIndex++}`,
          type: 'paragraph',
          text: currentParagraph.trim()
        });
        currentParagraph = '';
      }
      
      paragraphs.push({
        id: `heading_${paragraphIndex++}`,
        type: 'heading',
        text: line,
        level: estimateHeadingLevel(line)
      });
    } else {
      // 普通文本行
      currentParagraph += (currentParagraph ? ' ' : '') + line;
    }
  }

  // 添加最后一个段落
  if (currentParagraph.trim().length > 0) {
    paragraphs.push({
      id: `para_${paragraphIndex++}`,
      type: 'paragraph',
      text: currentParagraph.trim()
    });
  }

  return { paragraphs, toc };
}

/**
 * 判断是否可能是标题
 */
function isLikelyHeading(line, nextLine) {
  // 标题通常较短
  if (line.length > 100) return false;
  
  // 检查是否全大写（英文标题）
  if (/^[A-Z\s]+$/.test(line) && line.length < 50 && line.length > 3) return true;
  
  // 检查是否包含数字编号（如 "1. 第一章" 或 "第一章"）
  if (/^\d+[\.、]\s*/.test(line)) return true;
  if (/^第[一二三四五六七八九十\d]+[章节部分篇卷]/i.test(line)) return true;
  
  // 检查是否后跟空行
  if (nextLine && nextLine.trim().length === 0) return true;
  
  // 检查是否居中（通过前后空格判断，简单方法）
  if (line.length < 50 && !line.includes('。') && !line.includes('，')) {
    return true;
  }
  
  return false;
}

/**
 * 估算标题级别
 */
function estimateHeadingLevel(text) {
  // 根据编号深度判断
  const numberMatch = text.match(/^(\d+[\.、]\s*)+/);
  if (numberMatch) {
    return numberMatch[0].split(/[\.、]/).length - 1;
  }
  
  // 根据中文章节判断
  const chapterMatch = text.match(/^第[一二三四五六七八九十\d]+([章节部分篇卷])/i);
  if (chapterMatch) {
    const type = chapterMatch[1];
    if (type === '章' || type === '卷') return 1;
    if (type === '节' || type === '篇') return 2;
    if (type === '部分') return 3;
  }
  
  // 根据长度判断
  if (text.length < 20) return 1;
  if (text.length < 40) return 2;
  return 3;
}

