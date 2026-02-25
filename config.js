const DEFAULT_FORMAT_CONFIG = {
  author: "",
  email: "",
  frontmatter: "---\ntitle: {title}\nmodel: {model}\nauthor: {author}\nemail: {email}\nurl: {url}\ncreatedAt: {createdAt}\nmessageCount: {messageCount}\ntags: []\n---",
  userTitleFormat: "### 👤 사용자 (User)",
  aiTitleFormat: "### {emoji} {authorLabel}",
  turnSeparator: "---",
  qaSeparator: "---"
};

const DEFAULT_SITE_CONFIGS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    hostname: "chatgpt.com",
    emoji: "🤖",
    authorLabel: "챗GPT (ChatGPT)",
    messageSelector: "[data-message-author-role]",
    userAttribute: { attr: "data-message-author-role", value: "user" },
    contentSelector: "",
    ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",
    titlePrefix: "ChatGPT 대화 내역"
  },
  {
    id: "claude",
    name: "Claude",
    hostname: "claude.ai",
    emoji: "🧠",
    authorLabel: "클로드 (Claude)",
    messageSelector: "[data-testid='user-message'], .font-claude-message, .font-claude-response",
    userAttribute: { attr: "data-testid", value: "user-message" },
    contentSelector: "",
    ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",
    titlePrefix: "Claude 대화 내역"
  },
  {
    id: "gemini",
    name: "Gemini",
    hostname: "gemini.google.com",
    emoji: "✨",
    authorLabel: "제미나이 (Gemini)",
    messageSelector: "user-query, model-response",
    userAttribute: { tag: "user-query" },
    contentSelector: "",
    ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",
    titlePrefix: "Gemini 대화 내역"
  },
  {
    id: "aistudio",
    name: "Google AI Studio",
    hostname: "aistudio.google.com",
    emoji: "⚙️",
    authorLabel: "모델 (Model)",
    messageSelector: "ms-chat-turn",
    userAttribute: { containerSelector: ".chat-turn-container", userClass: ["user"], aiClass: ["model"] },
    contentSelector: ".turn-content",
    ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only, .actions-container, .author-label, ms-thought-chunk",
    titlePrefix: "Google AI Studio 대화 내역"
  },
  {
    id: "genspark",
    name: "Genspark",
    hostname: "www.genspark.ai",
    emoji: "✨",
    authorLabel: "젠스파크 (Genspark)",
    messageSelector: "article, [class*='message'], [class*='chat-turn'], [class*='bubble']",
    userAttribute: { htmlMatch: ["user", "query", "human"] },
    contentSelector: "",
    ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",
    titlePrefix: "Genspark 대화 내역",
    deduplicate: true
  }
];
