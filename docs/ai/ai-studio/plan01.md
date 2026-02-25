"""
claude, chatgpt, gemini 와 같은 인공지능 특정 세션의 웹페이지에서 채팅 내용들을 일괄적으로 markdown 파일로 다운받을 수 있는 기능이 있는 크롬 익스텐션을 개발하고 싶어요.
"""

ChatGPT, Claude, Gemini와 같은 AI 챗봇의 대화 내용을 마크다운(Markdown) 파일로 다운로드하는 크롬 익스텐션 개발은 매우 훌륭하고 실용적인 아이디어입니다. 

크롬 익스텐션(Manifest V3 기준)을 개발하기 위한 전체적인 아키텍처와 단계별 핵심 코드를 안내해 드리겠습니다.

---

### 1. 작동 원리 (Architecture)
1. **Popup (사용자 UI):** 익스텐션 아이콘을 클릭하여 '다운로드' 버튼을 누릅니다.
2. **Content Script (웹페이지 접근):** 현재 열려있는 탭(ChatGPT, Claude 등)의 DOM(HTML 요소)에 접근하여 대화 내용을 크롤링합니다.
3. **Parsing (데이터 가공):** 크롤링한 HTML 데이터를 Markdown 포맷으로 변환합니다. (이때 `Turndown.js` 같은 라이브러리를 쓰면 코드 블록, 굵은 글씨 등을 쉽게 마크다운으로 바꿀 수 있습니다.)
4. **Download (파일 저장):** 변환된 마크다운 텍스트를 `.md` 파일로 사용자 PC에 저장합니다.

---

### 2. 프로젝트 폴더 구조
```text
ai-chat-exporter/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
├── turndown.js (선택: HTML to Markdown 라이브러리)
└── icons/
    ├── icon48.png
    └── icon128.png
```

---

### 3. 단계별 핵심 코드 작성

#### Step 1: `manifest.json` 작성
익스텐션의 권한과 대상 사이트를 정의합니다.
```json
{
  "manifest_version": 3,
  "name": "AI Chat to Markdown Exporter",
  "version": "1.0",
  "description": "ChatGPT, Claude, Gemini의 대화를 Markdown으로 다운로드합니다.",
  "permissions": ["activeTab", "scripting", "downloads"],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*", "https://claude.ai/*", "https://gemini.google.com/*"],
      "js": ["turndown.js", "content.js"]
    }
  ]
}
```

#### Step 2: `popup.html` 및 `popup.js` (UI 및 명령 전달)
버튼을 클릭하면 현재 탭의 `content.js`로 메시지를 보냅니다.

**popup.html**
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 200px; padding: 10px; font-family: sans-serif; text-align: center; }
    button { padding: 10px; width: 100%; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 5px; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h3>AI Chat Exporter</h3>
  <button id="downloadBtn">Markdown으로 다운로드</button>
  <script src="popup.js"></script>
</body>
</html>
```

**popup.js**
```javascript
document.getElementById('downloadBtn').addEventListener('click', async () => {
  // 현재 활성화된 탭 찾기
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // content.js에 추출 명령 보내기
  chrome.tabs.sendMessage(tab.id, { action: "extract_chat" }, (response) => {
    if (response && response.markdown) {
      downloadMarkdown(response.markdown, response.title);
    } else {
      alert("대화 내용을 추출할 수 없거나 지원하지 않는 페이지입니다.");
    }
  });
});

// Markdown 파일 다운로드 함수
function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: `${filename}.md`,
    saveAs: true
  });
}
```

#### Step 3: `content.js` (대화 내용 추출 로직)
가장 까다로운 부분입니다. 각 서비스마다 HTML 구조(DOM)가 다르기 때문입니다.

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_chat") {
    const markdown = extractChat();
    const title = document.title.replace(/[^a-z0-9가-힣]/gi, '_'); // 파일명 안전하게 변환
    sendResponse({ markdown: markdown, title: title });
  }
});

function extractChat() {
  const url = window.location.hostname;
  let markdown = "";
  
  // Turndown 서비스 초기화 (HTML의 코드블록, 볼드체 등을 마크다운으로 변환해 줌)
  // html 원본을 사용하지 않고 text만 필요하다면 생략 가능하지만, 코드블록 보존을 위해 추천합니다.
  const turndownService = new TurndownService();

  if (url.includes("chatgpt.com")) {
    markdown = parseChatGPT(turndownService);
  } else if (url.includes("claude.ai")) {
    markdown = parseClaude(turndownService);
  } else if (url.includes("gemini.google.com")) {
    markdown = parseGemini(turndownService);
  } else {
    return null;
  }

  return markdown;
}

// 1. ChatGPT 파싱 로직
function parseChatGPT(turndown) {
  let md = "# ChatGPT 대화 내역\n\n";
  // ChatGPT는 data-message-author-role 속성을 사용합니다.
  const messages = document.querySelectorAll('[data-message-author-role]');
  
  messages.forEach(msg => {
    const role = msg.getAttribute('data-message-author-role');
    const author = role === 'user' ? '👤 **User**' : '🤖 **ChatGPT**';
    const contentHtml = msg.innerHTML; 
    
    md += `${author}\n\n${turndown.turndown(contentHtml)}\n\n---\n\n`;
  });
  return md;
}

// 2. Claude 파싱 로직 (클래스명은 Claude 업데이트에 따라 자주 변할 수 있음)
function parseClaude(turndown) {
  let md = "# Claude 대화 내역\n\n";
  // 예시: Claude의 메시지는 특정 클래스로 구분됩니다. (개발자 도구로 최신 클래스명 확인 필수)
  const messages = document.querySelectorAll('.font-user-message, .font-claude-message'); 
  
  messages.forEach(msg => {
    const isUser = msg.classList.contains('font-user-message'); // 실제 클래스명으로 교체 필요
    const author = isUser ? '👤 **User**' : '🧠 **Claude**';
    
    md += `${author}\n\n${turndown.turndown(msg.innerHTML)}\n\n---\n\n`;
  });
  return md;
}

// 3. Gemini 파싱 로직
function parseGemini(turndown) {
  let md = "# Gemini 대화 내역\n\n";
  // 예시: Gemini 사용자 질의와 응답 컨테이너
  const messages = document.querySelectorAll('user-query, model-response');
  
  messages.forEach(msg => {
    const isUser = msg.tagName.toLowerCase() === 'user-query';
    const author = isUser ? '👤 **User**' : '✨ **Gemini**';
    
    md += `${author}\n\n${turndown.turndown(msg.innerHTML)}\n\n---\n\n`;
  });
  return md;
}
```

---

### 4. 개발 시 반드시 고려해야 할 난제 및 팁 (Troubleshooting)

1. **DOM 구조의 잦은 변경:**
   * AI 회사들(OpenAI, Anthropic, Google)은 웹사이트 UI를 자주 업데이트합니다.
   * 이에 따라 `content.js`의 `querySelector` 클래스명이나 속성값이 작동하지 않게 될 수 있습니다.
   * **해결책:** 익스텐션 배포 후에도 주기적으로 각 사이트의 개발자 도구(F12)를 열어 태그와 클래스를 확인하고 업데이트해야 합니다.

2. **코드 블록(Code Block) 유지:**
   * 단순히 `.innerText`로 긁어오면 코드 블록의 들여쓰기나 언어(python, javascript 등) 정보가 날아갑니다.
   * **해결책:** 위 코드 예시처럼 [Turndown.js](https://github.com/mixmark-io/turndown) 같은 HTML to Markdown 라이브러리를 사용하는 것이 좋습니다. Turndown을 사용하면 `<b>`, `<code>`, `<pre>` 태그를 깔끔하게 Markdown 문법으로 변환해 줍니다.

3. **지연 로딩 (Lazy Loading / Infinite Scroll):**
   * 긴 대화의 경우 스크롤을 위로 올리지 않으면 과거 대화 내용이 DOM에 렌더링되지 않은 상태일 수 있습니다.
   * **고급 기능 추가:** 크롤링 시작 전 JavaScript로 스크롤을 맨 위까지 자동으로 올려서 모든 메시지를 로딩시킨 후 추출하는 로직을 추가하면 완벽해집니다.

4. **로컬 테스트 방법:**
   * 크롬 브라우저 주소창에 `chrome://extensions/` 입력
   * 우측 상단 `개발자 모드` 켜기
   * 좌측 상단 `압축해제된 확장 프로그램을 로드합니다.` 클릭 후 작업 중인 폴더 선택

이 기본 뼈대를 바탕으로 시작하시면, 원하시는 훌륭한 크롬 익스텐션을 빠르게 완성하실 수 있을 것입니다! 추가로 막히는 부분이 있다면 언제든 질문해주세요.