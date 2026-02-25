"""
google ai studio 의 경우는 markdown에 불필요한 내용도 많고, 누락되거나 순서가 바뀐 내용들도 많아요.

ai별 웹페이지에서
- user chat 영역, ai chat 영역 및 무시해야할 영역에 대해 selector 나 xpath 등으로 설정을 따로 하고, 이 설정값들을 사용자가 수정할 수 있도록 하는 건 어떤가요?
"""



╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Plan to implement                                                                                                                    │
│                                                                                                                                      │
│ Plan: 사이트별 셀렉터 설정을 외부 config로 분리 + 옵션 페이지                                                                        │
│                                                                                                                                      │
│ Context                                                                                                                              │
│                                                                                                                                      │
│ 현재 각 사이트별 파서(parseClaude, parseChatGPT 등)에 DOM 셀렉터가 하드코딩되어 있어서, 사이트 구조가 변경되면 코드를 직접 수정해야  │
│ 한다. 특히 Google AI Studio에서 불필요한 내용 추출, 누락, 순서 뒤바뀜 등 문제가 있다. 셀렉터를 설정으로 분리하고, 사용자가 옵션      │
│ 페이지에서 편집 가능하게 만든다.                                                                                                     │
│                                                                                                                                      │
│ 구현 계획                                                                                                                            │
│                                                                                                                                      │
│ 1. 기본 설정 구조 정의 (config.js 신규)                                                                                              │
│                                                                                                                                      │
│ 사이트별 설정을 아래 구조의 배열로 정의:                                                                                             │
│                                                                                                                                      │
│ const DEFAULT_SITE_CONFIGS = [                                                                                                       │
│   {                                                                                                                                  │
│     id: "chatgpt",                                                                                                                   │
│     name: "ChatGPT",                                                                                                                 │
│     hostname: "chatgpt.com",                                                                                                         │
│     emoji: "🤖",                                                                                                                     │
│     messageSelector: "[data-message-author-role]",                                                                                   │
│     userAttribute: { attr: "data-message-author-role", value: "user" },                                                              │
│     contentSelector: null,  // null이면 메시지 요소 자체를 사용                                                                      │
│     ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",                                                              │
│     titlePrefix: "ChatGPT 대화 내역"                                                                                                 │
│   },                                                                                                                                 │
│   {                                                                                                                                  │
│     id: "claude",                                                                                                                    │
│     name: "Claude",                                                                                                                  │
│     hostname: "claude.ai",                                                                                                           │
│     emoji: "🧠",                                                                                                                     │
│     messageSelector: "[data-testid='user-message'], .font-claude-message, .font-claude-response",                                    │
│     userAttribute: { attr: "data-testid", value: "user-message" },                                                                   │
│     contentSelector: null,                                                                                                           │
│     ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",                                                              │
│     titlePrefix: "Claude 대화 내역"                                                                                                  │
│   },                                                                                                                                 │
│   // ... gemini, aistudio, genspark                                                                                                  │
│ ];                                                                                                                                   │
│                                                                                                                                      │
│ 각 필드 설명:                                                                                                                        │
│ - hostname: URL 매칭용                                                                                                               │
│ - messageSelector: 대화 메시지 목록을 가져오는 CSS 셀렉터                                                                            │
│ - userAttribute: 사용자 메시지를 구분하는 방법 (속성명+값, 또는 태그명)                                                              │
│ - contentSelector: 메시지 내 실제 콘텐츠 영역 (null이면 메시지 자체)                                                                 │
│ - ignoreSelector: 제거할 UI 요소들의 CSS 셀렉터                                                                                      │
│ - titlePrefix: 마크다운 제목                                                                                                         │
│                                                                                                                                      │
│ 2. content.js 리팩토링                                                                                                               │
│                                                                                                                                      │
│ 기존 parseClaude, parseChatGPT 등 개별 함수를 하나의 범용 파서로 통합:                                                               │
│                                                                                                                                      │
│ function parseWithConfig(config) {                                                                                                   │
│   let md = `# ${config.titlePrefix}\n\n---\n\n`;                                                                                     │
│   const messages = document.querySelectorAll(config.messageSelector);                                                                │
│   messages.forEach(msg => {                                                                                                          │
│     const isUser = detectUser(msg, config.userAttribute);                                                                            │
│     const author = isUser ? '👤 사용자 (User)' : `${config.emoji} ${config.name}`;                                                   │
│     const contentEl = config.contentSelector ? msg.querySelector(config.contentSelector) : msg;                                      │
│     const cleanContent = convertToMarkdown(contentEl, config.ignoreSelector);                                                        │
│     if (cleanContent) md += formatTurn(author, cleanContent);                                                                        │
│   });                                                                                                                                │
│   return md;                                                                                                                         │
│ }                                                                                                                                    │
│                                                                                                                                      │
│ extractChat()에서:                                                                                                                   │
│ 1. chrome.storage.local에서 사용자 설정을 로드                                                                                       │
│ 2. 현재 hostname에 맞는 config를 찾아 parseWithConfig(config) 호출                                                                   │
│                                                                                                                                      │
│ convertToMarkdown()의 ignoreSelector를 config에서 받도록 변경.                                                                       │
│                                                                                                                                      │
│ 3. manifest.json 수정                                                                                                                │
│                                                                                                                                      │
│ {                                                                                                                                    │
│   "permissions": ["activeTab", "scripting", "downloads", "storage"],                                                                 │
│   "options_page": "options.html"                                                                                                     │
│ }                                                                                                                                    │
│                                                                                                                                      │
│ - storage 권한 추가 (설정 저장용)                                                                                                    │
│ - options_page 추가                                                                                                                  │
│                                                                                                                                      │
│ 4. 옵션 페이지 (options.html + options.js 신규)                                                                                      │
│                                                                                                                                      │
│ - 왼쪽: 사이트 목록 (기본 5개 + 사용자 추가분)                                                                                       │
│ - 오른쪽: 선택한 사이트의 셀렉터 편집 폼                                                                                             │
│   - hostname, messageSelector, userAttribute, contentSelector, ignoreSelector 등                                                     │
│ - "새 사이트 추가" 버튼                                                                                                              │
│ - "기본값으로 초기화" 버튼                                                                                                           │
│ - "저장" 버튼 → chrome.storage.local에 저장                                                                                          │
│                                                                                                                                      │
│ 5. popup.html 수정                                                                                                                   │
│                                                                                                                                      │
│ 기존 다운로드 버튼 아래에 "설정" 링크 추가 → 클릭 시 chrome.runtime.openOptionsPage() 호출                                           │
│                                                                                                                                      │
│ 수정 파일 목록                                                                                                                       │
│                                                                                                                                      │
│ ┌─────────────────────┬──────────────────────────────────────────────────────┐                                                       │
│ │        파일         │                      변경 내용                       │                                                       │
│ ├─────────────────────┼──────────────────────────────────────────────────────┤                                                       │
│ │ config.js (신규)    │ 기본 사이트 설정 상수 정의                           │                                                       │
│ ├─────────────────────┼──────────────────────────────────────────────────────┤                                                       │
│ │ content.js          │ 개별 파서 → 범용 parseWithConfig(), config 로딩 추가 │                                                       │
│ ├─────────────────────┼──────────────────────────────────────────────────────┤                                                       │
│ │ manifest.json       │ storage 권한, options_page 추가                      │                                                       │
│ ├─────────────────────┼──────────────────────────────────────────────────────┤                                                       │
│ │ options.html (신규) │ 설정 편집 UI                                         │                                                       │
│ ├─────────────────────┼──────────────────────────────────────────────────────┤                                                       │
│ │ options.js (신규)   │ 설정 로드/저장/초기화 로직                           │                                                       │
│ ├─────────────────────┼──────────────────────────────────────────────────────┤                                                       │
│ │ popup.html          │ 설정 링크 추가                                       │                                                       │
│ ├─────────────────────┼──────────────────────────────────────────────────────┤                                                       │
│ │ popup.js            │ 설정 페이지 열기 로직 추가                           │                                                       │
│ └─────────────────────┴──────────────────────────────────────────────────────┘                                                       │
│                                                                                                                                      │
│ 검증 방법                                                                                                                            │
│                                                                                                                                      │
│ 1. 확장 프로그램 새로고침 후 기존 5개 사이트에서 정상 추출 확인 (기본 설정 사용)                                                     │
│ 2. 옵션 페이지에서 셀렉터 수정 → 저장 → 해당 사이트에서 변경된 셀렉터로 추출 확인                                                    │
│ 3. 옵션 페이지에서 새 사이트 추가 → 해당 사이트에서 추출 확인                                                                        │
│ 4. "기본값으로 초기화" → 기본 설정으로 복원 확인                                                                                     │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯


● 모든 파일이 구현되었습니다. 변경 요약:                          
    
  수정/생성된 파일                                                                                                                                                              
  파일: config.js                                                                                                                                                          
  상태: 신규
  내용: 5개 사이트의 기본 셀렉터 설정 (DEFAULT_SITE_CONFIGS)                                                                                                                 ────────────────────────────────────────                                                                                                                                   파일: content.js                                                                                                                                                           상태: 수정                                                                                                                                                               
  내용: 개별 파서 5개 제거 → 범용 parseWithConfig() + detectUser() 통합, convertToMarkdown()에 ignoreSelector 파라미터 추가, chrome.storage.local에서 사용자 설정 로드
  ────────────────────────────────────────
  파일: manifest.json
  상태: 수정
  내용: storage 권한 추가, options_page 추가, config.js를 content_scripts에 포함, 버전 1.3
  ────────────────────────────────────────
  파일: options.html
  상태: 신규
  내용: 왼쪽 사이트 목록 + 오른쪽 셀렉터 편집 폼 UI
  ────────────────────────────────────────
  파일: options.js
  상태: 신규
  내용: 설정 로드/저장/초기화/삭제, 4가지 사용자 판별 방식 편집 지원
  ────────────────────────────────────────
  파일: popup.html
  상태: 수정
  내용: "설정" 링크 추가
  ────────────────────────────────────────
  파일: popup.js
  상태: 수정
  내용: 설정 페이지 열기 (chrome.runtime.openOptionsPage()) 추가

  주요 설계

  - detectUser(): 4가지 사용자 판별 방식 지원 (속성값, 태그명, 컨테이너 클래스, HTML 키워드 매칭)
  - 설정 우선순위: chrome.storage.local에 저장된 설정 > DEFAULT_SITE_CONFIGS 기본값
  - 기존 동작 보존: 설정을 커스터마이즈하지 않으면 기본값으로 기존과 동일하게 동작

