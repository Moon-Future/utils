import EPub from 'epub';
import { createDocumentStructure } from '../parser.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * 安全地将值转换为字符串（处理数组和非数组）
 * @param {any} value - 要转换的值
 * @param {string} separator - 数组连接符，默认为 ', '
 * @returns {string} 转换后的字符串
 */
function safeJoin(value, separator = ', ') {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.join(separator);
  }
  return String(value);
}

/**
 * 解析 EPUB 文件
 * @param {string} filePath - EPUB 文件路径
 * @returns {Promise<Object>} 解析后的结构化数据
 */
export async function parseEPUB(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const epub = new EPub(filePath);

      epub.on('end', async () => {
        try {
          // 提取元数据
          const metadata = {
            title: epub.metadata.title || '',
            author: safeJoin(epub.metadata.creator),
            creator: safeJoin(epub.metadata.creator),
            subject: safeJoin(epub.metadata.subject),
            keywords: safeJoin(epub.metadata.subject),
            language: epub.metadata.language || 'zh-CN',
            publisher: epub.metadata.publisher || '',
            description: epub.metadata.description || '',
            date: epub.metadata.date || null,
          };

          console.log('epub', epub);

          // 提取目录
          const toc = extractTOC(epub.flow);

          // 提取内容
          const content = await extractContent(epub);

          // 提取图片
          const images = await extractImages(epub, filePath);

          const result = createDocumentStructure(metadata, content, images, toc);
          resolve(result);
        } catch (error) {
          reject(new Error(`EPUB 内容提取失败: ${error.message}`));
        }
      });

      epub.on('error', (error) => {
        reject(new Error(`EPUB 解析失败: ${error.message}`));
      });

      epub.parse();
    } catch (error) {
      reject(new Error(`EPUB 文件打开失败: ${error.message}`));
    }
  });
}

/**
 * 提取目录结构
 */
function extractTOC(flow) {
  const toc = [];

  if (!flow || !Array.isArray(flow)) {
    return toc;
  }

  flow.forEach((item, index) => {
    if (item.title) {
      toc.push({
        title: item.title,
        id: item.id || `chapter_${index}`,
        level: item.level || 1,
        order: index,
      });
    }
  });

  return toc;
}

/**
 * 提取文本内容
 */
async function extractContent(epub) {
  return new Promise((resolve, reject) => {
    const content = [];
    let chapterIndex = 0;

    epub.flow.forEach((chapter, index) => {
      epub.getChapter(chapter.id, (error, text) => {
        if (error) {
          console.warn(`章节 ${chapter.id} 读取失败:`, error.message);
          return;
        }

        // 解析 HTML 内容，提取文本和段落
        const paragraphs = extractParagraphsFromHTML(text, chapter.id, chapterIndex++);
        content.push(...paragraphs);

        // 当所有章节处理完成
        if (index === epub.flow.length - 1) {
          resolve(content);
        }
      });
    });

    if (epub.flow.length === 0) {
      resolve(content);
    }
  });
}

/**
 * 从 HTML 中提取段落
 */
function extractParagraphsFromHTML(html, chapterId, chapterIndex) {
  const paragraphs = [];

  // 简单的 HTML 标签移除和文本提取
  // 移除 script 和 style 标签
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 提取标题
  const headingMatches = text.matchAll(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi);
  for (const match of headingMatches) {
    paragraphs.push({
      id: `${chapterId}_heading_${paragraphs.length}`,
      type: 'heading',
      text: stripHTML(match[2]),
      level: parseInt(match[1]),
      chapter: chapterId,
      chapterIndex: chapterIndex,
    });
  }

  // 提取段落
  const paragraphMatches = text.matchAll(/<p[^>]*>(.*?)<\/p>/gi);
  for (const match of paragraphMatches) {
    const paraText = stripHTML(match[1]);
    if (paraText.trim().length > 0) {
      paragraphs.push({
        id: `${chapterId}_para_${paragraphs.length}`,
        type: 'paragraph',
        text: paraText.trim(),
        chapter: chapterId,
        chapterIndex: chapterIndex,
      });
    }
  }

  // 如果没有找到段落，尝试提取所有文本
  if (paragraphs.length === 0) {
    const cleanText = stripHTML(text);
    const lines = cleanText.split('\n').filter((line) => line.trim().length > 0);
    lines.forEach((line, idx) => {
      if (line.trim().length > 0) {
        paragraphs.push({
          id: `${chapterId}_para_${idx}`,
          type: 'paragraph',
          text: line.trim(),
          chapter: chapterId,
          chapterIndex: chapterIndex,
        });
      }
    });
  }

  return paragraphs;
}

/**
 * 移除 HTML 标签
 */
function stripHTML(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 根据 MIME 类型获取文件扩展名
 */
function getExtensionFromMimeType(mimeType) {
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
  };
  return mimeMap[mimeType?.toLowerCase()] || '.jpg';
}

/**
 * 提取图片信息并保存图片文件
 * @param {EPub} epub - EPUB 对象
 * @param {string} epubFilePath - EPUB 文件路径
 * @returns {Promise<Array>} 图片信息数组
 */
async function extractImages(epub, epubFilePath) {
  return new Promise(async (resolve, reject) => {
    const images = [];

    if (!epub.manifest || typeof epub.manifest !== 'object') {
      resolve(images);
      return;
    }

    // 创建图片输出目录（在 EPUB 文件同目录下创建 images 子目录）
    const epubDir = path.dirname(epubFilePath);
    const epubName = path.basename(epubFilePath, path.extname(epubFilePath));
    const imagesDir = path.join(epubDir, `${epubName}_images`);

    try {
      // 确保图片目录存在
      await fs.mkdir(imagesDir, { recursive: true });
    } catch (error) {
      console.warn(`创建图片目录失败: ${error.message}`);
    }

    // 筛选出图片项（manifest 是对象，键为 id，值为 item 对象）
    const imageItems = Object.entries(epub.manifest)
      .filter(([id, item]) => {
        const mediaType = item['media-type'] || item.mediaType;
        return mediaType && mediaType.startsWith('image/');
      })
      .map(([id, item]) => ({
        id: id,
        href: item.href || '',
        mediaType: item['media-type'] || item.mediaType || 'image/unknown',
      }));

    if (imageItems.length === 0) {
      resolve(images);
      return;
    }

    // 并发获取所有图片
    const imagePromises = imageItems.map((item, index) => {
      return new Promise((resolveItem) => {
        const imageId = item.id;

        epub.getImage(imageId, async (error, imgBuffer, mimeType) => {
          if (error) {
            console.warn(`图片 ${imageId} 读取失败:`, error.message);
            // 即使读取失败，也记录图片信息
            images.push({
              id: imageId,
              href: item.href || '',
              mediaType: item.mediaType || mimeType || 'image/unknown',
              size: null,
              savedPath: null,
              error: error.message,
            });
            resolveItem();
            return;
          }

          try {
            // 确定文件扩展名
            const extension = getExtensionFromMimeType(mimeType || item.mediaType);

            // 生成文件名（使用原始文件名或基于 ID）
            let filename = path.basename(item.href || imageId);
            // 如果没有扩展名，添加扩展名
            if (!path.extname(filename)) {
              filename = `${filename}${extension}`;
            }
            // 清理文件名，移除特殊字符
            filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

            // 如果文件名已存在，添加索引
            let finalFilename = filename;
            let counter = 1;
            let imagePath = path.join(imagesDir, finalFilename);

            // 检查文件是否已存在，如果存在则添加索引
            while (true) {
              try {
                await fs.access(imagePath);
                // 文件存在，需要重命名
                const nameWithoutExt = path.basename(filename, path.extname(filename));
                finalFilename = `${nameWithoutExt}_${counter}${path.extname(filename)}`;
                imagePath = path.join(imagesDir, finalFilename);
                counter++;
              } catch {
                // 文件不存在，可以使用这个文件名
                break;
              }
            }

            // 保存图片文件
            await fs.writeFile(imagePath, imgBuffer);

            // 获取文件大小
            const stats = await fs.stat(imagePath);

            images.push({
              id: imageId,
              href: item.href || '',
              mediaType: mimeType || item.mediaType || 'image/unknown',
              size: stats.size,
              savedPath: imagePath,
            });

            console.log(`图片已保存: ${imagePath}`);
          } catch (saveError) {
            console.warn(`图片 ${imageId} 保存失败:`, saveError.message);
            images.push({
              id: imageId,
              href: item.href || '',
              mediaType: mimeType || item.mediaType || 'image/unknown',
              size: null,
              savedPath: null,
              error: saveError.message,
            });
          }

          resolveItem();
        });
      });
    });

    // 等待所有图片处理完成
    await Promise.all(imagePromises);

    // 按原始顺序排序（保持 imageItems 的顺序）
    images.sort((a, b) => {
      const indexA = imageItems.findIndex((item) => item.id === a.id);
      const indexB = imageItems.findIndex((item) => item.id === b.id);
      return indexA - indexB;
    });

    resolve(images);
  });
}
