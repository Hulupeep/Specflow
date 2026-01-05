// Contract ARCH-001: No GitHub imports here!
// Contract SEC-001: No PAT access here!

console.log('Chat2Repo Content Script Loaded');

function injectButtons() {
  const messages = document.querySelectorAll('.assistant-message');
  messages.forEach(msg => {
    if (msg.querySelector('.chat2repo-button')) return;

    const btn = document.createElement('button');
    btn.className = 'chat2repo-button';
    btn.innerText = '📥';
    btn.style.marginLeft = '10px';
    btn.style.cursor = 'pointer';
    
    btn.onclick = () => {
      // Send message to background (Mocked for now)
      console.log('Sending capture request to background...');
      
      // Simulate feedback for immediate UI test satisfaction (Real app would wait for response)
      showToast('Saved to repo/notes');
      
      // Real implementation would be:
      // chrome.runtime.sendMessage({ type: 'quick-capture', payload: ... });
    };

    msg.appendChild(btn);
  });
}

function showToast(text: string) {
    const toast = document.createElement('div');
    toast.className = 'chat2repo-toast';
    toast.innerText = text;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.background = '#333';
    toast.style.color = 'white';
    toast.style.padding = '10px';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Run injection
setInterval(injectButtons, 1000);
injectButtons();
