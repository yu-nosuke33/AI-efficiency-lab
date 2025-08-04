// スムーススクロール
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ヘッダーのスクロール効果
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.98)';
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.style.boxShadow = 'none';
    }
});

// フォーム送信処理
document.querySelector('.contact-form form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // フォームデータ取得
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    // 簡単なバリデーション
    if (!data.name || !data.email || !data.message) {
        alert('必須項目を入力してください。');
        return;
    }
    
    // 名前の長さチェック
    if (data.name.length < 2 || data.name.length > 50) {
        alert('お名前は2文字以上50文字以下で入力してください。');
        return;
    }
    
    // メール形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        alert('正しいメールアドレスを入力してください。');
        return;
    }
    
    // メール長さチェック
    if (data.email.length > 100) {
        alert('メールアドレスは100文字以下で入力してください。');
        return;
    }
    
    // 会社名の長さチェック（任意項目だが入力時）
    if (data.company && data.company.length > 100) {
        alert('会社名は100文字以下で入力してください。');
        return;
    }
    
    // メッセージの長さチェック
    if (data.message.length < 10 || data.message.length > 1000) {
        alert('お問い合わせ内容は10文字以上1000文字以下で入力してください。');
        return;
    }
    
    // スパム的な文字列チェック
    const spamPatterns = [
        /https?:\/\//,  // URL
        /お得|限定|今すぐ|無料|格安/,  // 商業用語
        /クリック|登録|詳細|確認/,  // 誘導用語
        /(.)\1{4,}/,  // 同じ文字の連続
        /[！]{3,}/,   // 感嘆符の連続
        /副業|稼ぐ|儲ける|お金/  // 怪しい用語
    ];
    const hasSpam = spamPatterns.some(pattern => 
        pattern.test(data.message)
    );
    if (hasSpam) {
        alert('不適切な内容が含まれています。');
        return;
    }
    
    // 送信ボタンを無効化
    const submitBtn = this.querySelector('.btn-submit');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '送信中...';
    submitBtn.disabled = true;
    
    // GASにデータを送信（reCAPTCHA一時無効）
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbz3jh12hcnu_Z4UXOxPZ25y4BM2aEe6TW0jI8x4EnSGzfZTpu5Fsqgj0in-pceRfoBOrw/exec';
    
    fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(data)
    })
    .then(() => {
        alert('送信完了しました！');
        this.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    })
    .catch(error => {
        console.error('Error:', error);
        alert('エラーが発生しました');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
});

// FAQ項目のクリックでアコーディオン効果（オプション）
document.querySelectorAll('.faq-item h3').forEach(item => {
    item.addEventListener('click', function() {
        const content = this.nextElementSibling;
        const isActive = content.style.display === 'block';
        
        // 全て閉じる
        document.querySelectorAll('.faq-item p').forEach(p => {
            p.style.display = 'none';
        });
        
        // クリックしたものを開く/閉じる
        if (!isActive) {
            content.style.display = 'block';
        }
    });
});

// ページ読み込み時のアニメーション
window.addEventListener('load', function() {
    // ヒーローセクションのフェードイン
    const hero = document.querySelector('.hero');
    hero.style.opacity = '0';
    hero.style.transform = 'translateY(20px)';
    hero.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    
    setTimeout(() => {
        hero.style.opacity = '1';
        hero.style.transform = 'translateY(0)';
    }, 100);
});

// インtersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// セクションにアニメーションを適用
document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('.problems, .services, .cases, .process, .pricing, .faq, .contact');
    
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
});

// カード要素のホバーエフェクト強化
document.querySelectorAll('.service-card, .pricing-card, .case-item').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// モバイルメニュー（将来的な拡張用）
function toggleMobileMenu() {
    const nav = document.querySelector('.nav');
    nav.classList.toggle('mobile-active');
}

// スクロール位置に基づいたナビゲーションハイライト
window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav a[href^="#"]');
    
    let currentSection = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionHeight = section.clientHeight;
        
        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
            currentSection = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
});