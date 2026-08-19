// ===== MOBILE MENU =====
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenuBtn.innerHTML = navLinks.classList.contains('active') ? '✕' : '☰';
    });
}

// Close menu when clicking a link
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        mobileMenuBtn.innerHTML = '☰';
    });
});

// ===== COUNTDOWN TIMER =====
function updateCountdown() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2); // 2 days from now
    targetDate.setHours(23, 59, 59, 0);

    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
        document.querySelectorAll('.countdown-timer').forEach(timer => {
            timer.innerHTML = '<div class="countdown-title">¡Oferta finalizada!</div>';
        });
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.querySelectorAll('.countdown-digits').forEach(digits => {
        digits.innerHTML = `
            <div class="countdown-unit">
                <span class="days">${days.toString().padStart(2, '0')}</span>
                <span class="unit-label">Días</span>
            </div>
            <div class="countdown-unit">
                <span class="hours">${hours.toString().padStart(2, '0')}</span>
                <span class="unit-label">Horas</span>
            </div>
            <div class="countdown-unit">
                <span class="minutes">${minutes.toString().padStart(2, '0')}</span>
                <span class="unit-label">Minutos</span>
            </div>
            <div class="countdown-unit">
                <span class="seconds">${seconds.toString().padStart(2, '0')}</span>
                <span class="unit-label">Segundos</span>
            </div>
        `;
    });
}

// Initialize countdown
if (document.querySelector('.countdown-timer')) {
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// ===== FAQ ACCORDION =====
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const item = question.parentElement;
        item.classList.toggle('active');

        // Close other items (optional)
        // document.querySelectorAll('.faq-item').forEach(otherItem => {
        //     if (otherItem !== item) {
        //         otherItem.classList.remove('active');
        //     }
        // });
    });
});

// ===== INTERACTIVE DEMO =====
const demoPlaceholder = document.querySelector('.demo-placeholder');
const demoStats = document.querySelector('.demo-stats');

if (demoPlaceholder && demoStats) {
    const stats = [
        { value: '45', label: 'Workflows' },
        { value: '89%', label: 'Automatización' },
        { value: '3.2x', label: 'ROI' }
    ];

    // Update stats with animation
    let currentStats = [0, 0, 0];
    const targetStats = [45, 89, 3.2];
    const duration = 2000;
    const steps = 60;
    const increment = targetStats.map(val => val / steps);

    let step = 0;
    const updateStats = () => {
        if (step < steps) {
            currentStats = currentStats.map((curr, idx) => curr + increment[idx]);
            demoStats.innerHTML = currentStats.map((curr, idx) => `
                <div class="stat">
                    <div class="stat-value">${idx === 2 ? curr.toFixed(1) + 'x' : Math.round(curr)}${idx === 1 ? '%' : ''}</div>
                    <div class="stat-label">${stats[idx].label}</div>
                </div>
            `).join('');
            step++;
            setTimeout(updateStats, duration / steps);
        }
    };

    // Start animation when demo is in viewport
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            updateStats();
            observer.disconnect();
        }
    }, { threshold: 0.5 });

    observer.observe(demoPlaceholder);
}

// ===== EXIT INTENT POPUP =====
let exitIntentTriggered = false;

document.addEventListener('mouseout', (e) => {
    if (!exitIntentTriggered && e.clientY < 0) {
        showExitPopup();
        exitIntentTriggered = true;
    }
});

function showExitPopup() {
    const popup = document.getElementById('exit-intent-popup');
    if (popup) {
        popup.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hideExitPopup() {
    const popup = document.getElementById('exit-intent-popup');
    if (popup) {
        popup.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Close popup when clicking X or outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('popup-close') || e.target.id === 'exit-intent-popup') {
        hideExitPopup();
    }
});

// ===== LIVE CHAT WIDGET =====
let chatOpen = false;

function toggleChat() {
    const chatWindow = document.getElementById('chat-window');
    const toggleBtn = document.querySelector('.chat-toggle');
    
    if (!chatWindow) {
        createChatWindow();
        chatOpen = true;
        toggleBtn.innerHTML = '✕';
    } else {
        chatOpen = !chatOpen;
        chatWindow.style.display = chatOpen ? 'block' : 'none';
        toggleBtn.innerHTML = chatOpen ? '✕' : '💬';
    }
}

function createChatWindow() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-window';
    chatContainer.style.cssText = `
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 350px;
        max-width: calc(100vw - 40px);
        height: 500px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

    chatContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #4361ee, #7209b7); color: white; padding: 1.5rem; font-weight: 700; font-size: 1.2rem;">
            💬 Soporte AI Profit Army
        </div>
        <div id="chat-messages" style="flex: 1; padding: 1.5rem; overflow-y: auto; font-size: 0.9rem;">
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; align-self: flex-start; max-width: 80%;">
                <strong>Asistente IA:</strong> ¡Hola! Soy tu asistente de AI Profit Army. ¿En qué puedo ayudarte?
            </div>
        </div>
        <div style="padding: 1rem; border-top: 1px solid #e9ecef;">
            <div style="display: flex; gap: 10px;">
                <input type="text" id="chat-input" placeholder="Escribe tu mensaje..." style="flex: 1; padding: 0.75rem; border: 1px solid #ddd; border-radius: 25px; font-size: 0.9rem;">
                <button onclick="sendChatMessage()" style="background: #4361ee; color: white; border: none; border-radius: 25px; padding: 0 1.5rem; cursor: pointer;">Enviar</button>
            </div>
            <div style="font-size: 0.8rem; color: #6c757d; margin-top: 0.5rem; text-align: center;">
                Respuesta automática en segundos
            </div>
        </div>
    `;

    document.body.appendChild(chatContainer);
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    
    if (!input || !messages || !input.value.trim()) return;

    // User message
    messages.innerHTML += `
        <div style="background: #4361ee; color: white; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; align-self: flex-end; max-width: 80%; margin-left: auto;">
            <strong>Tú:</strong> ${input.value}
        </div>
    `;

    // Auto-reply after delay
    setTimeout(() => {
        const replies = [
            "Nuestros workflows de automatización pueden ahorrarte hasta 40 horas semanales. ¿Te interesa alguna categoría específica?",
            "Tenemos más de 45 workflows listos para implementar. ¿Quieres que te muestre algunos ejemplos?",
            "Ofrecemos garantía de ROI de 3 meses. Si no ves resultados, te devolvemos el 100%.",
            "Puedo conectarte con un especialista para una demo personalizada. ¿Te vendría bien?"
        ];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        
        messages.innerHTML += `
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; align-self: flex-start; max-width: 80%;">
                <strong>Asistente IA:</strong> ${reply}
            </div>
        `;
        messages.scrollTop = messages.scrollHeight;
    }, 1000);

    input.value = '';
    messages.scrollTop = messages.scrollHeight;
}

// Enter key to send
document.addEventListener('keypress', (e) => {
    if (e.target.id === 'chat-input' && e.key === 'Enter') {
        sendChatMessage();
    }
});

// ===== TRUST BADGES ANIMATION =====
const badges = document.querySelectorAll('.badge');
badges.forEach(badge => {
    badge.addEventListener('mouseenter', () => {
        badge.style.transform = 'translateY(-5px)';
    });
    badge.addEventListener('mouseleave', () => {
        badge.style.transform = 'translateY(0)';
    });
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// ===== LAZY LOAD IMAGES =====
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img.lazy').forEach(img => imageObserver.observe(img));
}

// ===== INITIALIZE ON LOAD =====
document.addEventListener('DOMContentLoaded', () => {
    // Add current year to footer
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Initialize demo animation
    if (document.querySelector('.demo-placeholder')) {
        // Already handled by IntersectionObserver
    }

    // Add loading animation to buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="spinner"></span> Procesando...';
            this.disabled = true;
            
            // Simulate loading
            setTimeout(() => {
                this.innerHTML = originalText;
                this.disabled = false;
            }, 1500);
        });
    });
});