chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_chat") {
    try {
      const markdown = extractChat();
      if (!markdown) {
        sendResponse({ error: "현재 URL은 지원하지 않는 사이트입니다." });
        return;
      }
      const title = document.title.replace(/[^a-z0-9가-힣]/gi, '_');
      sendResponse({ markdown: markdown, title: title });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
  return true; 
});

// ==========================================
// [공용 함수 1] 완벽한 마크다운 파서 탑재
// ==========================================
function convertToMarkdown(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  
  // 1. 불필요한 UI 요소 우선 제거
  const garbages = clone.querySelectorAll('button, svg, img, [aria-hidden="true"], .sr-only');
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

    // ✨ 마법의 로직: 코드 블록 전체를 감싸는 부모(Wrapper) 찾아서 통째로 교체하기
    // (이 로직이 코드 블록 위에 떠다니는 'bash' 같은 텍스트를 함께 먹어서 없애줍니다)
    let wrapper = pre;
    while (wrapper.parentElement && wrapper.parentElement !== clone) {
      let parentText = wrapper.parentElement.textContent.trim();
      let preText = pre.textContent.trim();
      // 부모의 텍스트 길이가 코드 텍스트 길이와 비슷하다면(UI 텍스트 몇 자만 추가된 상태라면) 부모로 인정
      if (parentText.length <= preText.length + 50) {
        wrapper = wrapper.parentElement;
      } else {
        break;
      }
    }

    const mdCode = `\n\n\`\`\`${lang}\n${codeText.replace(/\n$/, '')}\n\`\`\`\n\n`;

    // 처리된 코드 블록을 임시 div로 교체
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

// ✨ HTML 태그를 마크다운으로 번역해주는 핵심 파서 엔진
function parseDOMToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent; // 일반 텍스트 반환
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  // 앞서 변환한 코드 블록은 그대로 반환
  if (node.className === 'processed-code-block') {
    return node.textContent;
  }

  let tagName = node.tagName.toLowerCase();

  // 테이블은 별도 함수로 처리 (재귀 파서로는 셀 구분이 어려움)
  if (tagName === 'table') {
    return convertTableToMarkdown(node);
  }

  // 자식 노드들 먼저 번역 (Bottom-up 방식)
  let childrenMD = "";
  for (let child of node.childNodes) {
    childrenMD += parseDOMToMarkdown(child);
  }

  // HTML 태그별 마크다운 기호 매칭
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
      return childrenMD; // div, span 등은 구조만 유지
  }
}

// ✨ HTML 테이블을 마크다운 테이블로 변환
function convertTableToMarkdown(table) {
  let md = "\n\n";
  const rows = table.querySelectorAll('tr');

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td');
    const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
    md += `| ${cellTexts.join(' | ')} |\n`;

    // 헤더 행 다음에 구분선 추가
    if (rowIndex === 0 && row.querySelector('th')) {
      md += `| ${cellTexts.map(() => '---').join(' | ')} |\n`;
    }
  });

  return md + "\n";
}

// ==========================================
// [공용 함수 2] '사용자-AI' 구분선 포맷팅
// ==========================================
function formatTurn(author, content) {
  return `### ${author}\n\n${content}\n\n---\n\n`;
}

// ==========================================
// 메인 실행 함수 및 개별 사이트 로직
// ==========================================
function extractChat() {
  const url = window.location.hostname;
  let markdown = "";

  if (url.includes("claude.ai")) markdown = parseClaude();
  else if (url.includes("chatgpt.com")) markdown = parseChatGPT();
  else if (url.includes("gemini.google.com")) markdown = parseGemini();
  else if (url.includes("aistudio.google.com")) markdown = parseAIStudio();
  else if (url.includes("genspark.ai")) markdown = parseGenspark();
  else return null; 

  if (markdown.split('\n').length < 5) {
    throw new Error("대화 내용을 찾을 수 없습니다.");
  }
  return markdown;
}

function parseClaude() {
  let md = "# Claude 대화 내역\n\n---\n\n";
  const messages = document.querySelectorAll('[data-testid="user-message"], .font-claude-message, .font-claude-response'); 
  messages.forEach(msg => {
    const isUser = msg.getAttribute('data-testid') === 'user-message';
    const author = isUser ? '👤 사용자 (User)' : '🧠 클로드 (Claude)';
    const cleanContent = convertToMarkdown(msg);
    if (cleanContent) md += formatTurn(author, cleanContent);
  });
  return md;
}

function parseChatGPT() {
  let md = "# ChatGPT 대화 내역\n\n---\n\n";
  const messages = document.querySelectorAll('[data-message-author-role]');
  messages.forEach(msg => {
    const isUser = msg.getAttribute('data-message-author-role') === 'user';
    const author = isUser ? '👤 사용자 (User)' : '🤖 챗GPT (ChatGPT)';
    const cleanContent = convertToMarkdown(msg);
    if (cleanContent) md += formatTurn(author, cleanContent);
  });
  return md;
}

function parseGemini() {
  let md = "# Gemini 대화 내역\n\n---\n\n";
  const messages = document.querySelectorAll('user-query, model-response');
  messages.forEach(msg => {
    const isUser = msg.tagName.toLowerCase() === 'user-query';
    const author = isUser ? '👤 사용자 (User)' : '✨ 제미나이 (Gemini)';
    const cleanContent = convertToMarkdown(msg);
    if (cleanContent) md += formatTurn(author, cleanContent);
  });
  return md;
}

function parseAIStudio() {
  let md = "# Google AI Studio 대화 내역\n\n---\n\n";
  const turns = document.querySelectorAll('ms-chat-turn');
  turns.forEach((turn, index) => {
    let isUser = index % 2 === 0; 
    const container = turn.querySelector('.chat-turn-container, .turn');
    if (container) {
      if (container.classList.contains('user') || container.classList.contains('input')) isUser = true;
      if (container.classList.contains('model') || container.classList.contains('output')) isUser = false;
    }
    const author = isUser ? '👤 사용자 (User)' : '⚙️ 모델 (Model)';
    const contentBox = turn.querySelector('.turn-content') || turn;
    
    const cleanContent = convertToMarkdown(contentBox);
    if (cleanContent) md += formatTurn(author, cleanContent);
  });
  return md;
}

function parseGenspark() {
  let md = "# Genspark 대화 내역\n\n---\n\n";
  const turns = document.querySelectorAll('article, [class*="message"], [class*="chat-turn"], [class*="bubble"]');
  const seenTexts = new Set();

  turns.forEach((turn) => {
    const htmlString = turn.outerHTML.toLowerCase();
    const isUser = htmlString.includes('user') || htmlString.includes('query') || htmlString.includes('human');
    const author = isUser ? '👤 사용자 (User)' : '✨ 젠스파크 (Genspark)';
    
    const cleanContent = convertToMarkdown(turn);
    if (!cleanContent || seenTexts.has(cleanContent)) return;
    seenTexts.add(cleanContent);
    
    md += formatTurn(author, cleanContent);
  });
  return md;
}