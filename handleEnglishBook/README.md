# Book Handle

一个用于解析 PDF、EPUB、TXT 等文本文件并提取结构化内容的 Node.js 工具。

## 功能特性

- 📄 支持 PDF 文件解析
- 📚 支持 EPUB 文件解析
- 📝 支持 TXT 文件解析（支持多种编码：UTF-8、GBK、GB2312 等）
- 📊 提取文本、段落、目录、图片等结构化信息
- 💾 输出为简洁的 JSON 数据结构
- 🔍 自动识别标题、段落、章节结构

## 安装

```bash
npm install
```

## 使用方法

### 命令行使用

```bash
# 解析文件并保存为 JSON
node index.js example.pdf output.json

# 如果不指定输出路径，会自动生成（如 example.pdf -> example.json）
node index.js example.epub
```

### 代码中使用

```javascript
import { parseFile } from './src/parser.js';

// 解析 PDF
const pdfResult = await parseFile('example.pdf');

// 解析 EPUB
const epubResult = await parseFile('example.epub');

// 解析 TXT
const txtResult = await parseFile('example.txt');

console.log(JSON.stringify(result, null, 2));
```

## 输出格式

解析后的 JSON 数据结构如下：

```json
{
  "metadata": {
    "title": "文档标题",
    "author": "作者",
    "creator": "创建者",
    "subject": "主题",
    "keywords": "关键词",
    "creationDate": "2024-01-01T00:00:00.000Z",
    "modificationDate": "2024-01-01T00:00:00.000Z",
    "language": "zh-CN"
  },
  "tableOfContents": [
    {
      "title": "第一章",
      "page": 1,
      "level": 1
    }
  ],
  "content": [
    {
      "id": "heading_0",
      "type": "heading",
      "text": "第一章 引言",
      "level": 1
    },
    {
      "id": "para_1",
      "type": "paragraph",
      "text": "这是段落内容..."
    }
  ],
  "images": [
    {
      "id": "image_0",
      "href": "images/cover.jpg",
      "mediaType": "image/jpeg"
    }
  ],
  "stats": {
    "totalParagraphs": 100,
    "totalImages": 5,
    "totalTocItems": 10,
    "totalWords": 5000
  }
}
```

## 项目结构

```
book-handle/
├── src/
│   ├── parser.js           # 主解析器入口
│   └── parsers/
│       ├── pdfParser.js    # PDF 解析器
│       ├── epubParser.js   # EPUB 解析器
│       └── txtParser.js    # TXT 解析器
├── index.js                # 命令行入口
├── example.js             # 使用示例
├── package.json
└── README.md
```

## 依赖说明

- `pdf-parse`: PDF 文件解析
- `epub`: EPUB 文件解析

## 注意事项

1. PDF 解析：当前版本主要提取文本内容，图片提取功能有限
2. EPUB 解析：支持提取章节、段落和图片信息
3. TXT 解析：自动检测编码格式，支持中文和英文文档
4. 目录识别：基于文本模式识别，可能不完全准确

## 许可证

MIT

