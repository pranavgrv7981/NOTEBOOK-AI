/**
 * RAG Q&A Bot - Thin Client
 * Communicates with the Node.js backend.
 */

const dom = {
  appLayout: document.getElementById('appLayout'),
  chatMessages: document.getElementById('chatMessages'),
  questionInput: document.getElementById('questionInput'),
  askBtn: document.getElementById('sendBtn'),
  fileInput: document.getElementById('fileInput'),
  dropZone: document.getElementById('uploadZone'),
  docList: document.getElementById('documentList'),
  toastContainer: document.getElementById('toastContainer'),
  typingIndicator: document.getElementById('typingIndicator'),
  settingsBtn: document.getElementById('settingsToggle'),
  settingsPanel: document.getElementById('settingsPanel'),
  closeSettingsBtn: document.getElementById('settingsClose'),
  topKSlider: document.getElementById('topKSlider'),
  topKValue: document.getElementById('topKValue'),
  emptyState: document.getElementById('emptyState'),
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
};

let isProcessing = false;
let chatHistory = [];

async function loadDocuments() {
  try {
    const res = await fetch('/api/documents');
    const docs = await res.json();
    renderDocs(docs);
  } catch (err) {
    showToast('Failed to load documents', 'error');
  }
}

function renderDocs(docs) {
  dom.docList.innerHTML = '';
  const docCountEl = document.getElementById('docCount');
  if (docCountEl) {
    docCountEl.textContent = `${docs.length} doc${docs.length === 1 ? '' : 's'}`;
  }

  if (docs.length === 0) {
    dom.docList.innerHTML = '<div class="empty-docs" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: var(--fs-sm);">No documents uploaded.</div>';
    return;
  }
  
  docs.forEach(doc => {
    const item = document.createElement('div');
    item.className = 'document-item';
    item.innerHTML = `
      <div class="doc-icon" style="font-size: 1.2rem; margin-right: 4px;">📄</div>
      <div class="doc-info" style="flex: 1; min-width: 0;">
        <div class="doc-name" style="font-size: var(--fs-sm); font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${doc.filename}</div>
      </div>
      <button class="btn-delete" aria-label="Delete">🗑️</button>
    `;
    item.querySelector('.btn-delete').onclick = (e) => {
      e.stopPropagation();
      deleteDocument(doc.id);
    };
    dom.docList.appendChild(item);
  });
}

async function handleFileUpload(file) {
  if (!file || file.type !== 'application/pdf') {
    showToast('Only PDF files are supported.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('pdf', file);

  showToast('Uploading and processing... This may take a minute.', 'info');
  isProcessing = true;
  
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showToast('Document processed successfully!', 'success');
    loadDocuments();
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, 'error');
  } finally {
    isProcessing = false;
    dom.fileInput.value = '';
  }
}

async function deleteDocument(id) {
  try {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    loadDocuments();
    showToast('Document deleted', 'info');
  } catch (err) {
    showToast('Failed to delete', 'error');
  }
}

async function handleAsk() {
  const question = dom.questionInput.value.trim();
  if (!question || isProcessing) return;

  if (dom.emptyState) {
    dom.emptyState.style.display = 'none';
  }

  appendMessage('user', question);
  dom.questionInput.value = '';
  dom.typingIndicator.hidden = false;
  isProcessing = true;

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, topK: dom.topKSlider.value })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    appendMessage('assistant', data.answer);
  } catch (err) {
    appendMessage('assistant', `**Error:** ${err.message}`);
  } finally {
    dom.typingIndicator.hidden = true;
    isProcessing = false;
  }
}

function appendMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${role}`;
  wrapper.innerHTML = `<div class="message-bubble">${parseMarkdown(text)}</div>`;
  dom.chatMessages.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: 'smooth' });
}

function parseMarkdown(text) {
  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    return marked.parse(text);
  }
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Event Listeners
dom.askBtn.addEventListener('click', handleAsk);
dom.questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleAsk();
  }
});

// Hint chips
const hintChips = document.querySelectorAll('.hint-chip');
hintChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const question = chip.getAttribute('data-question');
    if (question) {
      dom.questionInput.value = question;
      handleAsk();
    }
  });
});

dom.dropZone.addEventListener('click', () => dom.fileInput.click());
dom.fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    handleFileUpload(e.target.files[0]);
  }
});

dom.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dom.dropZone.classList.add('dragover');
});
dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('dragover'));
dom.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dom.dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    handleFileUpload(e.dataTransfer.files[0]);
  }
});

// Settings Panel toggle
if (dom.settingsBtn && dom.settingsPanel && dom.appLayout) {
  dom.settingsBtn.addEventListener('click', () => {
    dom.appLayout.classList.toggle('settings-collapsed');
    dom.settingsPanel.classList.toggle('collapsed');
    dom.settingsPanel.classList.toggle('open');
  });
}
if (dom.closeSettingsBtn && dom.settingsPanel && dom.appLayout) {
  dom.closeSettingsBtn.addEventListener('click', () => {
    dom.appLayout.classList.add('settings-collapsed');
    dom.settingsPanel.classList.add('collapsed');
    dom.settingsPanel.classList.remove('open');
  });
}

dom.topKSlider.addEventListener('input', () => {
  dom.topKValue.textContent = dom.topKSlider.value;
});

// Sidebar Toggle (Mobile)
if (dom.sidebarToggle && dom.sidebar) {
  dom.sidebarToggle.addEventListener('click', () => {
    dom.sidebar.classList.toggle('open');
  });
}

// Clear Actions
if (dom.clearChatBtn) {
  dom.clearChatBtn.addEventListener('click', () => {
    const messages = dom.chatMessages.querySelectorAll('.chat-message');
    messages.forEach(m => m.remove());
    if (dom.emptyState) {
      dom.emptyState.style.display = 'flex';
    }
    chatHistory = [];
    showToast('Chat history cleared', 'info');
  });
}

if (dom.clearAllBtn) {
  dom.clearAllBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all documents and data?')) {
      try {
        const res = await fetch('/api/documents');
        const docs = await res.json();
        for (const doc of docs) {
          await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
        }
        loadDocuments();
        if (dom.clearChatBtn) {
          dom.clearChatBtn.click();
        }
        showToast('All documents and database cleared', 'info');
      } catch (err) {
        showToast('Failed to clear data', 'error');
      }
    }
  });
}

// Init
loadDocuments();
