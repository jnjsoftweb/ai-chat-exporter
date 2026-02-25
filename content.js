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
      // 에러가 발생하면 원인을 popup으로 전송
      sendResponse({ error: error.message });
    }
  }
  return true; // 비동기 응답을 위해 true 반환
});

function extractChat() {
  const url = window.location.hostname;
  let markdown = "";
  
  // TurndownService가 없는 경우 에러를 발생시킴
  if (typeof TurndownService === "undefined") {
    throw new Error("turndown.js 라이브러리가 로드되지 않았습니다. 폴더에 파일이 있는지 확인하세요.");
  }
  
  const turndownService = new TurndownService();

  if (url.includes("chatgpt.com")) {
    markdown = parseChatGPT(turndownService);
  } else if (url.includes("claude.ai")) {
    markdown = parseClaude(turndownService);
  } else if (url.includes("gemini.google.com")) {
    markdown = parseGemini(turndownService);
  } else {
    return null; // 지원하지 않는 URL
  }

  // 추출된 메시지가 없는 경우
  if (markdown.split('\n').length < 5) {
    throw new Error("대화 내용을 찾을 수 없습니다. (사이트의 HTML 구조가 변경되었을 수 있습니다.)");
  }

  return markdown;
}

function parseChatGPT(turndown) {
  let md = "# ChatGPT 대화 내역\n\n";
  const messages = document.querySelectorAll('[data-message-author-role]');
  messages.forEach(msg => {
    const role = msg.getAttribute('data-message-author-role');
    const author = role === 'user' ? '👤 **User**' : '🤖 **ChatGPT**';
    md += `${author}\n\n${turndown.turndown(msg.innerHTML)}\n\n---\n\n`;
  });
  return md;
}

// 2. Claude 파싱 (최신 구조 반영)
function parseClaude() {
  let md = "# Claude 대화 내역\n\n";
  
  // 최신 Claude 구조 (사용자: data-testid="user-message", 클로드: .font-claude-message 또는 .font-claude-response)
  const messages = document.querySelectorAll('[data-testid="user-message"], .font-claude-message, .font-claude-response'); 
  
  messages.forEach(msg => {
    // 사용자가 쓴 글인지 판별
    const isUser = msg.getAttribute('data-testid') === 'user-message';
    const author = isUser ? '👤 **User**' : '🧠 **Claude**';
    
    md += `${author}\n\n${msg.innerText}\n\n---\n\n`;
  });
  
  return md;
}

function parseGemini(turndown) {
  let md = "# Gemini 대화 내역\n\n";
  const messages = document.querySelectorAll('user-query, model-response');
  messages.forEach(msg => {
    const isUser = msg.tagName.toLowerCase() === 'user-query';
    const author = isUser ? '👤 **User**' : '✨ **Gemini**';
    md += `${author}\n\n${turndown.turndown(msg.innerHTML)}\n\n---\n\n`;
  });
  return md;
}