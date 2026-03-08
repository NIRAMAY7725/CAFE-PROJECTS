/* ══════════════════════════════════════════════
   DAS CAFE — Responsive Chatbot
   ══════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── Knowledge base ─────────────────────────── */
  const KB = {
    greet: {
      patterns: [
        /^hi\b/i,
        /^hello\b/i,
        /^hey\b/i,
        /namaste/i,
        /good (morning|afternoon|evening)/i,
        /^hola/i,
      ],
      replies: [
        "☕ Namaste! Welcome to DAS CAFE. How can I help you today?",
        "👋 Hello! Great to see you here at DAS CAFE. What can I do for you?",
        "☕ Hey there! I'm Brew — your DAS CAFE assistant. Ask me anything!",
      ],
    },
    menu: {
      patterns: [
        /menu/i,
        /what.*serve/i,
        /food|drinks?|beverage/i,
        /what.*have/i,
        /items?/i,
      ],
      replies: [
        "🍽️ Our menu features:\n\n☕ <b>Coffee</b> — Tea ₹20, Coffee ₹40, Cold Coffee ₹50\n🍵 <b>Tea</b> — Black Tea ₹30, Full Chai ₹20\n🥪 <b>Food</b> — Balaji Snaks ₹10, Grill Sandwich ₹100\n🥤 <b>Cold Drinks</b> — ₹20–₹100, Parle Snaks ₹10–₹50\n\nVisit our full <a href='menu.html' style='color:#c8a96e;'>Menu page</a> for more!",
      ],
    },
    coffee: {
      patterns: [
        /coffee/i,
        /espresso/i,
        /cappuccino/i,
        /latte/i,
        /brew/i,
        /filter coffee/i,
      ],
      replies: [
        "☕ Our coffee selection:\n\n• <b>Coffee</b> — ₹40 (Pure Milk, Double Coffee)\n• <b>Cold Coffee</b> — ₹50 (with ice and attitude!)\n\nAll made with single-origin South Indian beans, roasted in-house twice a week! 🌿",
      ],
    },
    tea: {
      patterns: [/\btea\b/i, /chai/i, /masala/i, /black tea/i],
      replies: [
        "🍵 Our tea selection:\n\n• <b>Tea</b> — ₹20 (classic and comforting)\n• <b>Black Tea</b> — ₹30 (bold and timeless)\n• <b>Full Chai</b> — ₹20 (freshly ground spice blend with Assam CTC)\n\nPerfect for any time of day!",
      ],
    },
    food: {
      patterns: [/food|snack|eat|sandwich|dosa|pastry|bite/i],
      replies: [
        "🥪 Our food menu:\n\n• <b>Grill Sandwich</b> — ₹100 (buttery croissant, grilled cheese & mayo)\n• <b>Balaji Snaks</b> — ₹10 (so many varieties!)\n• <b>Parle Snaks</b> — ₹10–₹50\n\nAll freshly prepared daily by our chefs! 👨‍🍳",
      ],
    },
    price: {
      patterns: [/price|cost|how much|rate|charge/i],
      replies: [
        "💰 Our prices are super affordable!\n\n• Tea — ₹20\n• Coffee — ₹40\n• Cold Coffee — ₹50\n• Black Tea — ₹30\n• Full Chai — ₹20\n• Grill Sandwich — ₹100\n• Balaji Snaks — ₹10\n• Cold Drinks — ₹20–₹100\n\nGreat quality at great prices! 😊",
      ],
    },
    hours: {
      patterns: [/hours?|timing|open|close|when/i, /time/i],
      replies: [
        "🕐 We're open <b>Monday to Sunday, 10:00 AM – 10:00 PM</b>.\n\nCome anytime — we're always happy to see you! ☕",
      ],
    },
    location: {
      patterns: [/where|location|address|find you|vega|place/i],
      replies: [
        "📍 You can find us at:\n\n<b>DAS CAFE, Vega — South India</b>\n\nWe're easy to find and always welcoming! See you soon! 😊",
      ],
    },
    contact: {
      patterns: [/contact|phone|call|email|reach|number/i],
      replies: [
        "📞 Reach us anytime:\n\n• <b>Phone:</b> +91 95100 35320\n• <b>Email:</b> dascafefoodchain@gmail.com\n• <b>Instagram:</b> @dascafe12\n• <b>Facebook:</b> DAS CAFE\n\nOr fill our <a href='contact.html' style='color:#c8a96e;'>Contact form</a>!",
      ],
    },
    order: {
      patterns: [/order|buy|purchase|how to get|take away|takeaway|delivery/i],
      replies: [
        "🛒 To order, visit our <a href='menu.html' style='color:#c8a96e;'>Menu page</a> and click the <b>+</b> button on any item!\n\nYou can also:\n• Visit us in-store at DAS CAFE, Vega\n• Call us at +91 95100 35320\n\nWe look forward to serving you! ☕",
      ],
    },
    about: {
      patterns: [/about|story|history|founded|who|owner|das cafe/i],
      replies: [
        "✨ DAS CAFE was founded in <b>2023</b> out of a simple obsession — the perfect South Indian cup.\n\nWe source directly from single-origin farms across Karnataka and Tamil Nadu, roasting every bean in-house. Our baristas train for months before pulling their first shot.\n\nBecause great coffee deserves great company. ❤️",
      ],
    },
    thanks: {
      patterns: [/thank|thanks|thx|cheers|great|awesome|nice|good/i],
      replies: [
        "😊 You're most welcome! Is there anything else I can help you with?",
        "🙏 Happy to help! Anything else you'd like to know about DAS CAFE?",
        "☕ Anytime! Come visit us soon at DAS CAFE, Vega!",
      ],
    },
    bye: {
      patterns: [/bye|goodbye|see you|later|exit|quit/i],
      replies: [
        "👋 Goodbye! See you soon at DAS CAFE. Have a wonderful day! ☕",
        "🙏 Take care! Drop by anytime — we're open 10 AM to 10 PM daily!",
      ],
    },
  };

  const fallbacks = [
    "🤔 I'm not sure about that. Try asking me about our <b>menu</b>, <b>hours</b>, <b>location</b>, or <b>prices</b>!",
    "☕ Hmm, I didn't quite get that. You can ask about our coffee, food, opening times, or contact details!",
    "😊 I'm still learning! Ask me about our menu items, prices, or how to reach us.",
  ];

  function getBotReply(input) {
    const text = input.trim().toLowerCase();
    for (const cat of Object.values(KB)) {
      for (const pattern of cat.patterns) {
        if (pattern.test(text)) {
          const arr = cat.replies;
          return arr[Math.floor(Math.random() * arr.length)];
        }
      }
    }
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /* ── DOM references ─────────────────────────── */
  const toggle = document.getElementById("chatbot-toggle");
  const window_ = document.getElementById("chatbot-window");
  const closeBtn = document.getElementById("chatbot-close");
  const messages = document.getElementById("chatbot-messages");
  const input = document.getElementById("chatbot-input");
  const sendBtn = document.getElementById("chatbot-send");
  const badge = document.getElementById("chatbot-badge");

  if (!toggle) return; // guard — chatbot HTML not present

  /* ── Helpers ────────────────────────────────── */
  let isOpen = false;
  let unread = 0;

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function createMsg(html, role /* 'user'|'bot' */) {
    const wrap = document.createElement("div");
    wrap.className = `cb-msg cb-msg--${role}`;

    if (role === "bot") {
      const avatar = document.createElement("div");
      avatar.className = "cb-avatar";
      avatar.textContent = "☕";
      wrap.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "cb-bubble";
    bubble.innerHTML = html;
    wrap.appendChild(bubble);

    messages.appendChild(wrap);
    // animate in
    requestAnimationFrame(() => wrap.classList.add("cb-msg--in"));
    scrollBottom();
    return wrap;
  }

  function typingIndicator() {
    const wrap = document.createElement("div");
    wrap.className = "cb-msg cb-msg--bot cb-msg--in";
    wrap.innerHTML = `
      <div class="cb-avatar">☕</div>
      <div class="cb-bubble cb-typing">
        <span></span><span></span><span></span>
      </div>`;
    messages.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function sendUserMsg() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    createMsg(escHtml(text), "user");
    sendBtn.disabled = true;

    // simulate typing delay
    const loader = typingIndicator();
    setTimeout(
      () => {
        loader.remove();
        const reply = getBotReply(text);
        createMsg(reply, "bot");
        sendBtn.disabled = false;
        input.focus();
        if (!isOpen) {
          unread++;
          badge.textContent = unread;
          badge.hidden = false;
        }
      },
      700 + Math.random() * 500,
    );
  }

  function escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ── Events ─────────────────────────────────── */
  toggle.addEventListener("click", () => {
    isOpen = !isOpen;
    window_.classList.toggle("cb-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen);
    toggle.querySelector(".cb-toggle-icon").textContent = isOpen ? "✕" : "💬";
    if (isOpen) {
      unread = 0;
      badge.hidden = true;
      input.focus();
      scrollBottom();
    }
  });

  closeBtn.addEventListener("click", () => {
    isOpen = false;
    window_.classList.remove("cb-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".cb-toggle-icon").textContent = "💬";
  });

  sendBtn.addEventListener("click", sendUserMsg);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendUserMsg();
    }
  });

  /* ── Welcome message ─────────────────────────── */
  setTimeout(() => {
    createMsg(
      "☕ Hi there! I'm <b>Brew</b>, your DAS CAFE assistant.<br>Ask me about our <b>menu</b>, <b>prices</b>, <b>hours</b>, or <b>location</b>!",
      "bot",
    );
    if (!isOpen) {
      unread = 1;
      badge.textContent = 1;
      badge.hidden = false;
    }
  }, 2000);
})();
