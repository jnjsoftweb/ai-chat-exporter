let configs = [];
let selectedIndex = -1;
let formatConfig = {};

document.addEventListener('DOMContentLoaded', () => {
  loadConfigs();
  loadFormatConfig();

  // 탭 전환
  document.getElementById('tabFormat').addEventListener('click', () => switchTab('format'));
  document.getElementById('tabSites').addEventListener('click', () => switchTab('sites'));

  // 사이트 설정 버튼
  document.getElementById('addSiteBtn').addEventListener('click', addNewSite);
  document.getElementById('resetBtn').addEventListener('click', resetToDefaults);
  document.getElementById('saveBtn').addEventListener('click', saveConfigs);
  document.getElementById('deleteSiteBtn').addEventListener('click', deleteSelectedSite);
  document.getElementById('cfgUserAttrType').addEventListener('change', renderAttrFields);

  // 출력 형식 버튼
  document.getElementById('saveFormatBtn').addEventListener('click', saveFormatConfig);
  document.getElementById('resetFormatBtn').addEventListener('click', resetFormatConfig);

  // 미리보기 실시간 갱신
  ['fmtAuthor', 'fmtEmail', 'fmtSavePath', 'fmtFilename', 'fmtFrontmatter', 'fmtUserTitle', 'fmtAiTitle', 'fmtTurnSeparator', 'fmtQaSeparator'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateFormatPreview);
  });
});

function switchTab(tab) {
  const isFormat = tab === 'format';
  document.getElementById('formatTab').style.display = isFormat ? 'block' : 'none';
  document.getElementById('sitesTab').style.display = isFormat ? 'none' : 'block';
  document.getElementById('tabFormat').className = 'tab-btn' + (isFormat ? ' active' : '');
  document.getElementById('tabSites').className = 'tab-btn' + (isFormat ? '' : ' active');
}

// ==========================================
// 출력 형식 설정
// ==========================================
async function loadFormatConfig() {
  try {
    const stored = await chrome.storage.local.get('formatConfig');
    formatConfig = stored.formatConfig
      ? { ...DEFAULT_FORMAT_CONFIG, ...stored.formatConfig }
      : { ...DEFAULT_FORMAT_CONFIG };
  } catch (e) {
    formatConfig = { ...DEFAULT_FORMAT_CONFIG };
  }
  showFormatForm();
}

function showFormatForm() {
  document.getElementById('fmtAuthor').value = formatConfig.author || '';
  document.getElementById('fmtEmail').value = formatConfig.email || '';
  document.getElementById('fmtSavePath').value = formatConfig.savePath || '';
  document.getElementById('fmtFilename').value = formatConfig.filenameFormat || '{model}_{title}_{date}';
  document.getElementById('fmtFrontmatter').value = formatConfig.frontmatter || '';
  document.getElementById('fmtUserTitle').value = formatConfig.userTitleFormat || '';
  document.getElementById('fmtAiTitle').value = formatConfig.aiTitleFormat || '';
  document.getElementById('fmtTurnSeparator').value = formatConfig.turnSeparator || '';
  document.getElementById('fmtQaSeparator').value = formatConfig.qaSeparator || '';
  updateFormatPreview();
}

function updateFormatPreview() {
  const fm = document.getElementById('fmtFrontmatter').value;
  const author = document.getElementById('fmtAuthor').value;
  const email = document.getElementById('fmtEmail').value;
  const userTitle = document.getElementById('fmtUserTitle').value;
  const aiTitle = document.getElementById('fmtAiTitle').value
    .replace(/\{emoji\}/g, '🤖')
    .replace(/\{authorLabel\}/g, '챗GPT (ChatGPT)');
  const turnSep = document.getElementById('fmtTurnSeparator').value;
  const qaSep = document.getElementById('fmtQaSeparator').value;

  const now = new Date();
  const createdAt = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0') + ' '
    + String(now.getHours()).padStart(2, '0') + ':'
    + String(now.getMinutes()).padStart(2, '0');

  let preview = '';
  if (fm) {
    preview += fm
      .replace(/\{title\}/g, 'ChatGPT - 예제 대화')
      .replace(/\{model\}/g, 'ChatGPT')
      .replace(/\{author\}/g, author || '홍길동')
      .replace(/\{email\}/g, email || 'user@gmail.com')
      .replace(/\{url\}/g, 'https://chatgpt.com/c/abc123')
      .replace(/\{createdAt\}/g, createdAt)
      .replace(/\{messageCount\}/g, '4');
    preview += '\n\n';
  }
  preview += '# ChatGPT 대화 내역\n\n';
  preview += qaSep + '\n\n';
  preview += userTitle + '\n\n';
  preview += '안녕하세요, 질문이 있습니다.\n\n';
  preview += turnSep + '\n\n';
  preview += aiTitle + '\n\n';
  preview += '네, 무엇이든 물어보세요!\n\n';
  preview += qaSep + '\n\n';
  preview += userTitle + '\n\n';
  preview += '감사합니다.\n\n';
  preview += turnSep + '\n\n';
  preview += aiTitle + '\n\n';
  preview += '도움이 되어 기쁩니다.\n\n';
  preview += qaSep;

  document.getElementById('formatPreview').textContent = preview;

  // 파일명 미리보기
  const savePath = document.getElementById('fmtSavePath').value.replace(/\\/g, '/').replace(/\/+$/, '');
  const fnFormat = document.getElementById('fmtFilename').value || '{model}_{title}_{date}';
  let fnPreview = fnFormat
    .replace(/\{title\}/g, 'ChatGPT___예제_대화')
    .replace(/\{model\}/g, 'ChatGPT')
    .replace(/\{date\}/g, now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0'))
    .replace(/\{time\}/g, String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0'))
    .replace(/\{datetime\}/g, now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0'));
  fnPreview = fnPreview.replace(/[<>:"|?*]/g, '_');
  const fullPath = savePath ? `[다운로드]/${savePath}/${fnPreview}.md` : `[다운로드]/${fnPreview}.md`;
  document.getElementById('filenamePreview').textContent = fullPath;
}

async function saveFormatConfig() {
  formatConfig = {
    author: document.getElementById('fmtAuthor').value.trim(),
    email: document.getElementById('fmtEmail').value.trim(),
    savePath: document.getElementById('fmtSavePath').value.trim(),
    filenameFormat: document.getElementById('fmtFilename').value.trim(),
    frontmatter: document.getElementById('fmtFrontmatter').value,
    userTitleFormat: document.getElementById('fmtUserTitle').value.trim(),
    aiTitleFormat: document.getElementById('fmtAiTitle').value.trim(),
    turnSeparator: document.getElementById('fmtTurnSeparator').value.trim(),
    qaSeparator: document.getElementById('fmtQaSeparator').value.trim()
  };
  await chrome.storage.local.set({ formatConfig });
  showToast('출력 형식이 저장되었습니다.');
}

async function resetFormatConfig() {
  if (!confirm('출력 형식을 기본값으로 초기화하시겠습니까?')) return;
  formatConfig = { ...DEFAULT_FORMAT_CONFIG };
  await chrome.storage.local.remove('formatConfig');
  showFormatForm();
  showToast('출력 형식이 기본값으로 초기화되었습니다.');
}

// ==========================================
// 사이트 설정
// ==========================================
async function loadConfigs() {
  try {
    const stored = await chrome.storage.local.get('siteConfigs');
    configs = (stored.siteConfigs && stored.siteConfigs.length > 0)
      ? stored.siteConfigs
      : JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIGS));
  } catch (e) {
    configs = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIGS));
  }
  renderSiteList();
}

function renderSiteList() {
  const container = document.getElementById('siteListItems');
  container.innerHTML = '';
  configs.forEach((cfg, i) => {
    const item = document.createElement('div');
    item.className = 'site-item' + (i === selectedIndex ? ' active' : '');
    item.innerHTML = `<span class="site-emoji">${cfg.emoji}</span> ${cfg.name}`;
    item.addEventListener('click', () => selectSite(i));
    container.appendChild(item);
  });
}

function selectSite(index) {
  selectedIndex = index;
  renderSiteList();
  showEditForm(configs[index]);
}

function showEditForm(cfg) {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('editForm').style.display = 'block';
  document.getElementById('editTitle').textContent = `${cfg.emoji} ${cfg.name} 설정`;

  document.getElementById('cfgId').value = cfg.id || '';
  document.getElementById('cfgName').value = cfg.name || '';
  document.getElementById('cfgHostname').value = cfg.hostname || '';
  document.getElementById('cfgEmoji').value = cfg.emoji || '';
  document.getElementById('cfgAuthorLabel').value = cfg.authorLabel || '';
  document.getElementById('cfgTitlePrefix').value = cfg.titlePrefix || '';
  document.getElementById('cfgMessageSelector').value = cfg.messageSelector || '';
  document.getElementById('cfgContentSelector').value = cfg.contentSelector || '';
  document.getElementById('cfgIgnoreSelector').value = cfg.ignoreSelector || '';
  document.getElementById('cfgDeduplicate').checked = !!cfg.deduplicate;

  const ua = cfg.userAttribute || {};
  let type = 'attr';
  if (ua.tag) type = 'tag';
  else if (ua.containerSelector) type = 'container';
  else if (ua.htmlMatch) type = 'htmlMatch';
  document.getElementById('cfgUserAttrType').value = type;
  renderAttrFields();
}

function renderAttrFields() {
  const type = document.getElementById('cfgUserAttrType').value;
  const container = document.getElementById('attrFields');
  const cfg = selectedIndex >= 0 ? configs[selectedIndex] : {};
  const ua = cfg.userAttribute || {};

  let html = '';
  switch (type) {
    case 'attr':
      html = `
        <div class="attr-fields">
          <input type="text" id="attrName" placeholder="속성명 (예: data-message-author-role)" value="${ua.attr || ''}">
          <input type="text" id="attrValue" placeholder="사용자 값 (예: user)" value="${ua.value || ''}">
        </div>
        <div class="hint">지정한 속성이 해당 값이면 사용자 메시지로 판별</div>`;
      break;
    case 'tag':
      html = `
        <div class="attr-fields">
          <input type="text" id="attrTag" placeholder="사용자 태그명 (예: user-query)" value="${ua.tag || ''}">
        </div>
        <div class="hint">해당 태그명이면 사용자 메시지로 판별</div>`;
      break;
    case 'container':
      html = `
        <div class="attr-fields">
          <input type="text" id="attrContainerSel" placeholder="컨테이너 셀렉터" value="${ua.containerSelector || ''}">
        </div>
        <div class="attr-fields" style="margin-top:6px;">
          <input type="text" id="attrUserClass" placeholder="사용자 클래스 (쉼표 구분)" value="${(ua.userClass || []).join(', ')}">
          <input type="text" id="attrAiClass" placeholder="AI 클래스 (쉼표 구분)" value="${(ua.aiClass || []).join(', ')}">
        </div>
        <div class="hint">컨테이너 내 클래스로 사용자/AI 판별</div>`;
      break;
    case 'htmlMatch':
      html = `
        <div class="attr-fields">
          <input type="text" id="attrHtmlMatch" placeholder="키워드 (쉼표 구분, 예: user, query, human)" value="${(ua.htmlMatch || []).join(', ')}">
        </div>
        <div class="hint">메시지 HTML에 키워드가 포함되면 사용자 메시지로 판별</div>`;
      break;
  }
  container.innerHTML = html;
}

function readFormToConfig() {
  const cfg = {
    id: document.getElementById('cfgId').value.trim(),
    name: document.getElementById('cfgName').value.trim(),
    hostname: document.getElementById('cfgHostname').value.trim(),
    emoji: document.getElementById('cfgEmoji').value.trim(),
    authorLabel: document.getElementById('cfgAuthorLabel').value.trim(),
    titlePrefix: document.getElementById('cfgTitlePrefix').value.trim(),
    messageSelector: document.getElementById('cfgMessageSelector').value.trim(),
    contentSelector: document.getElementById('cfgContentSelector').value.trim(),
    ignoreSelector: document.getElementById('cfgIgnoreSelector').value.trim(),
    deduplicate: document.getElementById('cfgDeduplicate').checked
  };

  const type = document.getElementById('cfgUserAttrType').value;
  switch (type) {
    case 'attr':
      cfg.userAttribute = {
        attr: document.getElementById('attrName').value.trim(),
        value: document.getElementById('attrValue').value.trim()
      };
      break;
    case 'tag':
      cfg.userAttribute = { tag: document.getElementById('attrTag').value.trim() };
      break;
    case 'container':
      cfg.userAttribute = {
        containerSelector: document.getElementById('attrContainerSel').value.trim(),
        userClass: document.getElementById('attrUserClass').value.split(',').map(s => s.trim()).filter(Boolean),
        aiClass: document.getElementById('attrAiClass').value.split(',').map(s => s.trim()).filter(Boolean)
      };
      break;
    case 'htmlMatch':
      cfg.userAttribute = {
        htmlMatch: document.getElementById('attrHtmlMatch').value.split(',').map(s => s.trim()).filter(Boolean)
      };
      break;
  }

  return cfg;
}

async function saveConfigs() {
  if (selectedIndex >= 0) {
    const updated = readFormToConfig();
    if (!updated.id || !updated.hostname || !updated.messageSelector) {
      showToast('ID, Hostname, 메시지 셀렉터는 필수입니다.', true);
      return;
    }
    configs[selectedIndex] = updated;
  }

  await chrome.storage.local.set({ siteConfigs: configs });
  renderSiteList();
  showToast('설정이 저장되었습니다.');
}

function addNewSite() {
  const newConfig = {
    id: 'new_site_' + Date.now(),
    name: '새 사이트',
    hostname: '',
    emoji: '💬',
    authorLabel: 'AI',
    messageSelector: '',
    userAttribute: { attr: '', value: '' },
    contentSelector: '',
    ignoreSelector: "button, svg, img, [aria-hidden='true'], .sr-only",
    titlePrefix: '새 사이트 대화 내역',
    deduplicate: false
  };
  configs.push(newConfig);
  selectSite(configs.length - 1);
  showToast('새 사이트가 추가되었습니다. 설정 후 저장하세요.');
}

function deleteSelectedSite() {
  if (selectedIndex < 0) return;
  const name = configs[selectedIndex].name;
  if (!confirm(`"${name}" 사이트 설정을 삭제하시겠습니까?`)) return;

  configs.splice(selectedIndex, 1);
  selectedIndex = -1;
  document.getElementById('editForm').style.display = 'none';
  document.getElementById('emptyState').style.display = 'block';
  renderSiteList();
  chrome.storage.local.set({ siteConfigs: configs });
  showToast(`"${name}" 설정이 삭제되었습니다.`);
}

async function resetToDefaults() {
  if (!confirm('모든 사이트 설정을 기본값으로 초기화하시겠습니까?')) return;
  configs = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIGS));
  selectedIndex = -1;
  document.getElementById('editForm').style.display = 'none';
  document.getElementById('emptyState').style.display = 'block';
  await chrome.storage.local.remove('siteConfigs');
  renderSiteList();
  showToast('기본값으로 초기화되었습니다.');
}

function showToast(message, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = isError ? '#dc3545' : '#28a745';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}