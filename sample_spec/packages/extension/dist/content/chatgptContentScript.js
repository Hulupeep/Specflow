"use strict";(()=>{var c={assistantMessage:'[data-message-author-role="assistant"]',messageContent:".markdown",conversationTitle:"h1",messageContainer:'[data-testid^="conversation-turn"]'};function p(){let t=document.querySelectorAll(c.assistantMessage);return Array.from(t)}function m(t){try{let e=t.querySelector(c.messageContent);if(!e)return null;let n=M(e);return!n||n.trim().length===0?null:n.trim()}catch{return null}}function M(t){var n;let e=[];for(let s of t.childNodes)if(s.nodeType===Node.TEXT_NODE)e.push(s.textContent||"");else if(s.nodeType===Node.ELEMENT_NODE){let r=s,o=r.tagName.toLowerCase();if(o==="p")e.push(r.textContent||""),e.push("");else if(o==="pre"){let a=r.querySelector("code"),i=((n=a==null?void 0:a.className.match(/language-(\w+)/))==null?void 0:n[1])||"";e.push("```"+i),e.push((a==null?void 0:a.textContent)||r.textContent||""),e.push("```"),e.push("")}else if(o==="ul"||o==="ol")r.querySelectorAll("li").forEach((i,v)=>{let E=o==="ol"?`${v+1}. `:"- ";e.push(E+(i.textContent||""))}),e.push("");else if(o.match(/^h[1-6]$/)){let a=parseInt(o[1]);e.push("#".repeat(a)+" "+(r.textContent||"")),e.push("")}else e.push(r.textContent||"")}return e.join(`
`).replace(/\n{3,}/g,`

`)}function f(){var t;try{let e=document.querySelector(c.conversationTitle);return((t=e==null?void 0:e.textContent)==null?void 0:t.trim())||null}catch{return null}}function g(t){return t.querySelector("[data-chat2repo-button]")!==null}function h(t){let e=t.querySelector('[class*="actions"], [class*="buttons"], [class*="toolbar"]');return e||t}var x="chat2repo-toast-container";function w(){let t=document.getElementById(x);return t||(t=document.createElement("div"),t.id=x,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `,document.body.appendChild(t)),t}function l(t){let e=w(),n=document.createElement("div");n.setAttribute("data-testid","toast"),n.style.cssText=`
    background: ${t.type==="error"?"#dc3545":t.type==="success"?"#28a745":"#17a2b8"};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 400px;
    pointer-events: auto;
    animation: slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `;let s=document.createElement("span");if(s.textContent=t.message,s.style.flex="1",n.appendChild(s),t.action){let o=document.createElement("button");o.textContent=t.action.label,o.style.cssText=`
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    `,o.onclick=t.action.onClick,n.appendChild(o)}if(t.link){let o=document.createElement("a");o.textContent=t.link.label,o.href=t.link.url,o.target="_blank",o.rel="noopener noreferrer",o.style.cssText=`
      color: white;
      text-decoration: underline;
      font-size: 13px;
    `,n.appendChild(o)}let r=document.createElement("button");r.textContent="\xD7",r.style.cssText=`
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.7;
  `,r.onclick=()=>n.remove(),n.appendChild(r),e.appendChild(n),setTimeout(()=>{n.style.animation="slideOut 0.3s ease",setTimeout(()=>n.remove(),300)},5e3)}function y(t,e){l({type:"success",message:t,link:{label:"Open",url:e}})}function u(t,e){let n={type:"error",message:t};e==="not_configured"&&(n.action={label:"Open settings",onClick:()=>{chrome.runtime.sendMessage({type:"open-options"})}}),l(n)}function b(){l({type:"info",message:"Couldn't detect message content. Select the text and use 'Quick send to GitHub' instead."})}var T=document.createElement("style");T.textContent=`
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;document.head.appendChild(T);var S="chat2repo-send-btn";function L(t){let e=document.createElement("button");e.className=S,e.setAttribute("data-chat2repo-button","true"),e.setAttribute("data-testid","send-to-repo"),e.title="Send to repo",e.innerHTML=`
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>
      <path d="m21.854 2.147-10.94 10.939"/>
    </svg>
  `;let n=()=>{var o;return document.documentElement.classList.contains("dark")||document.body.classList.contains("dark")||window.matchMedia("(prefers-color-scheme: dark)").matches||((o=getComputedStyle(document.body).backgroundColor.match(/^rgb\((\d+)/))==null?void 0:o[1])<"128"},s=()=>{let o=n();return{normal:o?"#a0a0a0":"#6b7280",hover:o?"#ffffff":"#1f2937",hoverBg:o?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}},r=s();return e.style.cssText=`
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    color: ${r.normal};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
    margin-left: 4px;
  `,e.addEventListener("mouseenter",()=>{let o=s();e.style.background=o.hoverBg,e.style.color=o.hover}),e.addEventListener("mouseleave",()=>{let o=s();e.style.background="transparent",e.style.color=o.normal}),e.addEventListener("click",o=>{o.preventDefault(),o.stopPropagation(),O(t)}),e}async function O(t){let e=m(t);if(!e){b();return}if(!(await chrome.runtime.sendMessage({type:"get-config-status"})).configured){u("GitHub is not configured. Open extension options to add your token and repo.","not_configured");return}let s=await chrome.runtime.sendMessage({type:"get-quick-send-defaults"});s!=null&&s.dontAskAgain?await d(e):await d(e)}async function d(t){let e=f(),n=await chrome.runtime.sendMessage({type:"quick-capture",payload:{content:t,source:"chatgpt",sourceUrl:window.location.href,sourceTitle:document.title,pageContext:e||void 0}});if(n.success){let s=n.result.path.split("/").pop()||"note";y(`Saved: ${s}`,n.result.htmlUrl)}else u(n.error,n.errorType)}function C(){let t=p();for(let e of t){if(g(e))continue;let n=h(e);if(n){let s=L(e);n.appendChild(s)}}}function k(){new MutationObserver(()=>{setTimeout(C,100)}).observe(document.body,{childList:!0,subtree:!0}),C()}chrome.runtime.onMessage.addListener((t,e,n)=>(t.type==="context-menu-quick-send"&&(d(t.payload.content),n({received:!0})),!0));document.readyState==="loading"?document.addEventListener("DOMContentLoaded",k):k();})();
