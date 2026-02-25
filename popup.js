document.getElementById('downloadBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "extract_chat" }, async (response) => {
    if (chrome.runtime.lastError) {
      alert("페이지 연결 오류: " + chrome.runtime.lastError.message + "\n(새로고침(F5) 후 다시 시도해보세요.)");
      return;
    }

    if (response && response.markdown) {
      await downloadMarkdown(response.markdown, response.title, response.model);
    } else if (response && response.error) {
      alert("추출 중 오류 발생: " + response.error);
    } else {
      alert("대화 내용을 추출할 수 없거나 지원하지 않는 페이지입니다.");
    }
  });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function downloadMarkdown(content, pageTitle, model) {
  let formatConfig = {};
  try {
    const stored = await chrome.storage.local.get('formatConfig');
    if (stored.formatConfig) formatConfig = stored.formatConfig;
  } catch (e) {}

  const now = new Date();
  const date = now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const datetime = date + '_' + time;

  // 파일명 생성
  const filenameFormat = formatConfig.filenameFormat || '{model}_{title}_{date}';
  let filename = filenameFormat
    .replace(/\{title\}/g, pageTitle)
    .replace(/\{model\}/g, model || '')
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{datetime\}/g, datetime);

  // 파일명에서 사용 불가 문자 제거
  filename = filename.replace(/[<>:"/\\|?*]/g, '_').replace(/_{2,}/g, '_');

  // 저장 경로 조합
  const savePath = (formatConfig.savePath || '').replace(/[<>:"|?*]/g, '_').replace(/\\/g, '/').replace(/\/+$/, '');
  const fullPath = savePath ? `${savePath}/${filename}.md` : `${filename}.md`;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url: url, filename: fullPath, saveAs: true });
}