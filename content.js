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

function extractChat() {
  const url = window.location.hostname;
  let markdown = "";

  if (url.includes("chatgpt.com")) {
    markdown = parseChatGPT();
  } else if (url.includes("claude.ai")) {
    markdown = parseClaude();
  } else if (url.includes("gemini.google.com")) {
    markdown = parseGemini();
  } else if (url.includes("aistudio.google.com")) {
    markdown = parseAIStudio();
  } else if (url.includes("genspark.ai")) {
    markdown = parseGenspark(); // Genspark 추가!
  } else {
    return null; 
  }

  if (markdown.split('\n').length < 5) {
    throw new Error("대화 내용을 찾을 수 없습니다. (채팅창이 열려있는지 확인하세요!)");
  }

  return markdown;
}

// 1. ChatGPT 파싱
function parseChatGPT() {
  let md = "# ChatGPT 대화 내역\n\n";
  const messages = document.querySelectorAll('[data-message-author-role]');
  messages.forEach(msg => {
    const role = msg.getAttribute('data-message-author-role');
    const author = role === 'user' ? '👤 **User**' : '🤖 **ChatGPT**';
    md += `${author}\n\n${msg.innerText}\n\n---\n\n`;
  });
  return md;
}

// 2. Claude 파싱 
function parseClaude() {
  let md = "# Claude 대화 내역\n\n";
  const messages = document.querySelectorAll('[data-testid="user-message"], .font-claude-message, .font-claude-response'); 
  messages.forEach(msg => {
    const isUser = msg.getAttribute('data-testid') === 'user-message';
    const author = isUser ? '👤 **User**' : '🧠 **Claude**';
    md += `${author}\n\n${msg.innerText}\n\n---\n\n`;
  });
  return md;
}

// 3. Gemini 파싱
function parseGemini() {
  let md = "# Gemini 대화 내역\n\n";
  const messages = document.querySelectorAll('user-query, model-response');
  messages.forEach(msg => {
    const isUser = msg.tagName.toLowerCase() === 'user-query';
    const author = isUser ? '👤 **User**' : '✨ **Gemini**';
    md += `${author}\n\n${msg.innerText}\n\n---\n\n`;
  });
  return md;
}

// 4. Google AI Studio 파싱 
function parseAIStudio() {
  let md = "# Google AI Studio 대화 내역\n\n";
  const turns = document.querySelectorAll('ms-chat-turn');
  
  turns.forEach((turn, index) => {
    let isUser = index % 2 === 0; 
    const container = turn.querySelector('.chat-turn-container, .turn');
    if (container) {
      if (container.classList.contains('user') || container.classList.contains('input')) isUser = true;
      if (container.classList.contains('model') || container.classList.contains('output')) isUser = false;
    }
    const author = isUser ? '👤 **User**' : '⚙️ **Model**';
    
    const contentBox = turn.querySelector('.turn-content') || turn;
    let text = contentBox.innerText || "";
    
    const ignoreWords = ['edit', 'more_vert', 'content_copy', 'report', 'chevron_right', 'expand to view model thoughts', 'thoughts'];
    let lines = text.split('\n').filter(line => !ignoreWords.includes(line.trim().toLowerCase()));
    
    text = lines.join('\n').trim();
    if (text) md += `${author}\n\n${text}\n\n---\n\n`;
  });
  return md;
}

// 5. Genspark 파싱 (새로 추가됨)
function parseGenspark() {
  let md = "# Genspark 대화 내역\n\n";
  
  // Genspark의 채팅 영역 요소를 타겟팅합니다.
  const turns = document.querySelectorAll('article, [class*="message"], [class*="chat-turn"], [class*="bubble"]');
  
  // 제거할 쓸데없는 버튼/아이콘 텍스트들
  const ignoreWords = [
    'copy', 'share', 'edit', 'regenerate', 'like', 'dislike', 'report',
    'translate', 'read aloud', 'save', 'bookmarks', 'more', 'reply'
  ];

  // 만약 위 선택자로 잡히지 않는 레이아웃이라면, 화면 전체 본문을 추출합니다 (스마트 폴백)
  if (turns.length === 0) {
      const main = document.querySelector('main') || document.body;
      let lines = (main.innerText || "").split('\n');
      lines = lines.filter(line => !ignoreWords.includes(line.trim().toLowerCase()) && line.trim() !== "");
      
      let text = lines.join('\n').trim();
      if (text) md += "✨ **Genspark Search Result**\n\n" + text + "\n\n";
      return md;
  }

  // 중복 추출 방지용 Set
  const seenTexts = new Set();

  turns.forEach((turn) => {
    // HTML 속성을 보고 사용자인지 AI인지 유추합니다.
    const htmlString = turn.outerHTML.toLowerCase();
    const isUser = htmlString.includes('user') || htmlString.includes('query') || htmlString.includes('human');
    const author = isUser ? '👤 **User**' : '✨ **Genspark**';
    
    // 텍스트 추출 및 쓸데없는 버튼 글씨 제거
    let text = turn.innerText || "";
    let lines = text.split('\n').filter(line => {
      const lower = line.trim().toLowerCase();
      return !ignoreWords.includes(lower) && lower.length > 0;
    });
    
    text = lines.join('\n').trim();
    
    // 내용이 없거나, 이미 추출한 텍스트(부모-자식 요소 중복)면 건너뜁니다.
    if (!text || seenTexts.has(text)) return;
    seenTexts.add(text);
    
    md += `${author}\n\n${text}\n\n---\n\n`;
  });
  
  return md;
}