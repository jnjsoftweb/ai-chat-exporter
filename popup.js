document.getElementById('downloadBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: "extract_chat" }, (response) => {
    if (chrome.runtime.lastError) {
      alert("페이지 연결 오류: " + chrome.runtime.lastError.message + "\n(새로고침(F5) 후 다시 시도해보세요.)");
      return;
    }

    if (response && response.markdown) {
      downloadMarkdown(response.markdown, response.title);
    } else if (response && response.error) {
      alert("추출 중 오류 발생: " + response.error); // 에러 원인을 팝업으로 표시
    } else {
      alert("대화 내용을 추출할 수 없거나 지원하지 않는 페이지입니다.");
    }
  });
});

function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url: url, filename: `${filename}.md`, saveAs: true });
}