chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_chat") {
    loadConfigAndExtract().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ error: error.message });
    });
  }
  return true;
});

async function loadConfigAndExtract() {
  let configs = DEFAULT_SITE_CONFIGS;
  let formatConfig = DEFAULT_FORMAT_CONFIG;
  try {
    const stored = await chrome.storage.local.get(['siteConfigs', 'formatConfig']);
    if (stored.siteConfigs && stored.siteConfigs.length > 0) {
      configs = stored.siteConfigs;
    }
    if (stored.formatConfig) {
      formatConfig = { ...DEFAULT_FORMAT_CONFIG, ...stored.formatConfig };
    }
  } catch (e) {
    // storage 접근 실패 시 기본 설정 사용
  }

  const hostname = window.location.hostname;
  const config = configs.find(c => hostname.includes(c.hostname));
  if (!config) {
    return { error: "현재 URL은 지원하지 않는 사이트입니다." };
  }

  // Google AI Studio 가상 스크롤 대응: 모든 턴을 스크롤하여 콘텐츠 렌더링
  if (hostname.includes('aistudio.google.com')) {
    await scrollAllTurns(config.messageSelector);
  }

  const markdown = parseWithConfig(config, formatConfig);
  if (markdown.split('\n').length < 5) {
    throw new Error("대화 내용을 찾을 수 없습니다.");
  }
  const title = document.title.replace(/[^a-z0-9가-힣]/gi, '_');
  return { markdown, title, model: config.name };
}

// Google AI Studio 가상 스크롤: 각 턴으로 스크롤하여 DOM 렌더링 유도
async function scrollAllTurns(messageSelector) {
  const turns = document.querySelectorAll(messageSelector);
  for (const turn of turns) {
    turn.scrollIntoView({ behavior: 'instant', block: 'center' });
    await new Promise(r => setTimeout(r, 300));
  }
  // 마지막에 맨 위로 돌아가기
  turns[0]?.scrollIntoView({ behavior: 'instant', block: 'start' });
  await new Promise(r => setTimeout(r, 300));
}

// ==========================================
// 범용 파서: config 기반으로 대화 추출
// ==========================================
function parseWithConfig(config, fmt) {
  const messages = document.querySelectorAll(config.messageSelector);

  // Frontmatter 생성
  let md = "";
  if (fmt.frontmatter) {
    const now = new Date();
    const createdAt = now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0') + ' '
      + String(now.getHours()).padStart(2, '0') + ':'
      + String(now.getMinutes()).padStart(2, '0');
    md += fmt.frontmatter
      .replace(/\{title\}/g, document.title)
      .replace(/\{model\}/g, config.name)
      .replace(/\{author\}/g, fmt.author || '')
      .replace(/\{email\}/g, fmt.email || '')
      .replace(/\{url\}/g, window.location.href)
      .replace(/\{createdAt\}/g, createdAt)
      .replace(/\{messageCount\}/g, String(messages.length));
    md += "\n\n";
  }

  md += `# ${config.titlePrefix}\n\n${fmt.qaSeparator}\n\n`;
  const seenTexts = config.deduplicate ? new Set() : null;

  // AI 타이틀 템플릿에서 플레이스홀더 치환
  const aiTitle = fmt.aiTitleFormat
    .replace(/\{emoji\}/g, config.emoji)
    .replace(/\{authorLabel\}/g, config.authorLabel);
  const userTitle = fmt.userTitleFormat;

  let prevIsUser = null;

  messages.forEach((msg, index) => {
    const isUser = detectUser(msg, config.userAttribute, index);

    const contentEl = config.contentSelector
      ? (msg.querySelector(config.contentSelector) || msg)
      : msg;

    const cleanContent = convertToMarkdown(contentEl, config.ignoreSelector);
    if (!cleanContent) return;

    if (seenTexts) {
      if (seenTexts.has(cleanContent)) return;
      seenTexts.add(cleanContent);
    }

    // 구분자 삽입: 이전 메시지가 있을 때만
    if (prevIsUser !== null) {
      if (prevIsUser && !isUser) {
        // 사용자 → AI (같은 Q&A 세트 내): turnSeparator
        md += `${fmt.turnSeparator}\n\n`;
      } else {
        // AI → 사용자 (새 Q&A 세트): qaSeparator
        md += `${fmt.qaSeparator}\n\n`;
      }
    }

    const title = isUser ? userTitle : aiTitle;
    md += `${title}\n\n${cleanContent}\n\n`;

    prevIsUser = isUser;
  });

  // 마지막 메시지 뒤에 qaSeparator
  if (prevIsUser !== null) {
    md += `${fmt.qaSeparator}\n\n`;
  }

  return md;
}

// ==========================================
// 사용자 메시지 판별
// ==========================================
function detectUser(msg, userAttr, index) {
  if (!userAttr) return index % 2 === 0;

  // 속성 기반: { attr: "data-message-author-role", value: "user" }
  if (userAttr.attr) {
    return msg.getAttribute(userAttr.attr) === userAttr.value;
  }

  // 태그명 기반: { tag: "user-query" }
  if (userAttr.tag) {
    return msg.tagName.toLowerCase() === userAttr.tag.toLowerCase();
  }

  // 컨테이너 클래스 기반 (AI Studio): { containerSelector, userClass, aiClass }
  if (userAttr.containerSelector) {
    let isUser = index % 2 === 0;
    const container = msg.querySelector(userAttr.containerSelector);
    if (container) {
      if (userAttr.userClass && userAttr.userClass.some(c => container.classList.contains(c))) isUser = true;
      if (userAttr.aiClass && userAttr.aiClass.some(c => container.classList.contains(c))) isUser = false;
    }
    return isUser;
  }

  // HTML 문자열 매칭 (Genspark): { htmlMatch: ["user", "query", "human"] }
  if (userAttr.htmlMatch) {
    const html = msg.outerHTML.toLowerCase();
    return userAttr.htmlMatch.some(keyword => html.includes(keyword));
  }

  return index % 2 === 0;
}

// ==========================================
// [공용 함수 1] 완벽한 마크다운 파서 탑재
// ==========================================
function convertToMarkdown(element, ignoreSelector) {
  if (!element) return "";
  const clone = element.cloneNode(true);

  // 1. 불필요한 UI 요소 우선 제거
  const defaultIgnore = "button, svg, img, [aria-hidden='true'], .sr-only";
  const selector = ignoreSelector || defaultIgnore;
  const garbages = clone.querySelectorAll(selector);
  garbages.forEach(el => el.remove());

  // 2. [가장 중요] 코드 블록과 UI 헤더(예: bash)를 묶어서 처리
  const preTags = clone.querySelectorAll('pre');
  preTags.forEach(pre => {
    let lang = "";
    const codeTag = pre.querySelector('code');
    const cmContent = pre.querySelector('.cm-content, [class*="cm-content"]');

    // 1. code 태그의 language-* 클래스에서 언어 추출
    if (codeTag && codeTag.className) {
      const match = codeTag.className.match(/language-(\w+)/);
      if (match) lang = match[1];
    }

    // 2. 코드 텍스트 추출: code 태그 > CodeMirror(.cm-content) > pre 전체
    let codeText;
    if (codeTag) {
      codeText = codeTag.textContent;
    } else if (cmContent) {
      codeText = cmContent.textContent;
    } else {
      codeText = pre.textContent;
    }

    // 3. 언어 정보가 없으면 pre 내부 헤더 텍스트에서 추출 (ChatGPT: "excel", "bash" 등)
    if (!lang) {
      let fullText = pre.textContent.trim();
      let codeOnly = codeText.trim();
      let idx = fullText.indexOf(codeOnly);
      if (idx > 0) {
        let extraText = fullText.slice(0, idx).trim();
        if (extraText && /^[a-zA-Z0-9_+#.-]+$/.test(extraText)) {
          lang = extraText.toLowerCase();
        }
      }
    }

    // 4. Gemini: code-block 커스텀 요소의 헤더 span에서 언어 추출
    if (!lang) {
      const codeBlockEl = pre.closest('code-block') || pre.closest('.code-block');
      if (codeBlockEl) {
        const decoration = codeBlockEl.querySelector('.code-block-decoration > span');
        if (decoration) {
          const langText = decoration.textContent.trim();
          if (langText && /^[a-zA-Z0-9_+#. -]+$/i.test(langText)) {
            lang = langText.toLowerCase();
          }
        }
      }
    }

    // 마법의 로직: 코드 블록 전체를 감싸는 부모(Wrapper) 찾아서 통째로 교체하기
    let wrapper = pre;
    while (wrapper.parentElement && wrapper.parentElement !== clone) {
      let parentText = wrapper.parentElement.textContent.trim();
      let preText = pre.textContent.trim();
      if (parentText.length <= preText.length + 50) {
        wrapper = wrapper.parentElement;
      } else {
        break;
      }
    }

    const mdCode = `\n\n\`\`\`${lang}\n${codeText.replace(/\n$/, '')}\n\`\`\`\n\n`;

    let tempDiv = document.createElement('div');
    tempDiv.className = 'processed-code-block';
    tempDiv.textContent = mdCode;
    wrapper.replaceWith(tempDiv);
  });

  // 3. 재귀적 DOM 탐색을 통해 HTML 태그를 마크다운 문법으로 1:1 번역
  let markdownText = parseDOMToMarkdown(clone);

  // 4. 여백(연속된 줄바꿈) 깔끔하게 정리
  markdownText = markdownText.replace(/\n{3,}/g, '\n\n').trim();

  return markdownText;
}

// HTML 태그를 마크다운으로 번역해주는 핵심 파서 엔진
function parseDOMToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  if (node.className === 'processed-code-block') {
    return node.textContent;
  }

  let tagName = node.tagName.toLowerCase();

  if (tagName === 'table') {
    return convertTableToMarkdown(node);
  }

  let childrenMD = "";
  for (let child of node.childNodes) {
    childrenMD += parseDOMToMarkdown(child);
  }

  switch (tagName) {
    case 'h1': return `\n# ${childrenMD.trim()}\n\n`;
    case 'h2': return `\n## ${childrenMD.trim()}\n\n`;
    case 'h3': return `\n### ${childrenMD.trim()}\n\n`;
    case 'h4': return `\n#### ${childrenMD.trim()}\n\n`;
    case 'h5': return `\n##### ${childrenMD.trim()}\n\n`;
    case 'h6': return `\n###### ${childrenMD.trim()}\n\n`;
    case 'p': return childrenMD.trim() ? `\n${childrenMD.trim()}\n\n` : "";
    case 'strong':
    case 'b': return `**${childrenMD}**`;
    case 'em':
    case 'i': return `*${childrenMD}*`;
    case 'code': return `\`${childrenMD}\``;
    case 'li': return `\n- ${childrenMD.trim()}`;
    case 'ul':
    case 'ol': return `\n${childrenMD}\n`;
    case 'a': return `[${childrenMD}](${node.getAttribute('href')})`;
    case 'br': return `\n`;
    default:
      return childrenMD;
  }
}

// HTML 테이블을 마크다운 테이블로 변환
function convertTableToMarkdown(table) {
  let md = "\n\n";
  const rows = table.querySelectorAll('tr');

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td');
    const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
    md += `| ${cellTexts.join(' | ')} |\n`;

    // 첫 번째 행 다음에 항상 구분선 추가 (마크다운 테이블 필수 문법)
    if (rowIndex === 0) {
      md += `| ${cellTexts.map(() => '---').join(' | ')} |\n`;
    }
  });

  return md + "\n";
}

