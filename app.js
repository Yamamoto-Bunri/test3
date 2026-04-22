/**
 * 英単語学習システム Ver5.1 
 */

const state = {
    studentName: "",
    currentUnit: "",
    wordList: [],
    displayIndices: [],
    currentIndex: 0,
    isRandom: false,
    isOnlyUnlearned: false,
    masteredWords: [],
    activeScreen: ""
};

const app = {
    // --- 初期化 ---
    init() {
        if (typeof allUnits === 'undefined') {
            this.showError("data.js が読み込めませんでした。");
            this.showScreen('setup-screen'); 
            return;
        }
        const savedName = localStorage.getItem('studentName');
        if (savedName) {
            state.studentName = savedName;
            this.showScreen('setup-screen');
            this.renderUnitList();
        } else {
            this.showScreen('login-screen');
        }
    },

    // --- カード操作 ---
    flipCard() {
        const card = document.getElementById('card');
        if(card) card.classList.toggle('is-flipped');
    },

    // --- UX: トースト通知 ---
    showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    },

    // --- 画面遷移 ---
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            state.activeScreen = screenId;
        }
        if (screenId === 'setup-screen') {
            document.getElementById('display-name').innerText = state.studentName;
            const err = document.getElementById('error-message');
            if (typeof allUnits !== 'undefined' && err) err.style.display = 'none';
        }
    },

    // --- 設定変更 ---
    setOrder(random) {
        state.isRandom = random;
        document.getElementById('btn-order').classList.toggle('selected', !random);
        document.getElementById('btn-random').classList.toggle('selected', random);
        this.showToast(random ? "ランダム順に設定しました" : "順番通りに設定しました");
    },

    toggleFilterMode(onlyUnlearned) {
        state.isOnlyUnlearned = onlyUnlearned;
        document.getElementById('btn-filter-all').classList.toggle('selected', !onlyUnlearned);
        document.getElementById('btn-filter-unlearned').classList.toggle('selected', onlyUnlearned);
        
        if (state.activeScreen === 'learning-screen') {
            this.prepareIndices();
            state.currentIndex = 0;
            if (state.displayIndices.length > 0) {
                this.updateCardContent(); // 直接コンテンツ更新
                this.showToast(onlyUnlearned ? "未習得のみ表示" : "すべて表示");
            } else {
                this.showToast("未習得の単語はありません。すべて表示に戻します。");
                this.toggleFilterMode(false);
            }
        }
    },

    // --- ログイン・ログアウト ---
    login() {
        const input = document.getElementById('name-input').value.trim();
        if (!input) { this.showToast("名前を入力してください"); return; }
        state.studentName = input;
        localStorage.setItem('studentName', input);
        this.showScreen('setup-screen');
        this.renderUnitList();
        this.showToast(`ようこそ、${input}さん`);
    },

    logout() {
        if(confirm("ログアウトしますか？")) {
            localStorage.removeItem('studentName');
            this.showScreen('login-screen');
        }
    },

    // --- Unitリスト ---
    renderUnitList() {
        const list = document.getElementById('unit-list');
        if (!list || typeof allUnits === 'undefined') return;
        list.innerHTML = "";
        Object.keys(allUnits).forEach(unit => {
            const btn = document.createElement('button');
            btn.className = "unit-btn";
            btn.innerText = unit;
            btn.onclick = () => this.startLearning(unit);
            list.appendChild(btn);
        });
    },

    // --- 学習ロジック ---
    async startLearning(unitName) {
        state.currentUnit = unitName;
        state.wordList = allUnits[unitName];
        state.currentIndex = 0;

        try {
            if (window.fb) {
                const { db, doc, getDoc } = window.fb;
                const docRef = doc(db, "progress", state.studentName, "units", unitName);
                const docSnap = await getDoc(docRef);
                state.masteredWords = docSnap.exists() ? (docSnap.data().masteredWords || []) : [];
            }
        } catch (e) { state.masteredWords = []; }

        this.prepareIndices();
        
        if (state.displayIndices.length === 0) {
            this.showToast("未習得がありません。「すべて」で開始します。");
            state.isOnlyUnlearned = false;
            this.prepareIndices();
        }

        this.showScreen('learning-screen');
        this.updateCardContent(); 
    },

    prepareIndices() {
        let indices = state.wordList.map((_, i) => i);
        if (state.isOnlyUnlearned) {
            indices = indices.filter(i => !state.masteredWords.includes(state.wordList[i].Word));
        }
        if (state.isRandom) {
            indices.sort(() => Math.random() - 0.5);
        }
        state.displayIndices = indices;
    },

    // 【重要：修正】データ更新と表示を分離
    updateCardContent() {
        if (state.displayIndices.length === 0) return;
        
        const realIndex = state.displayIndices[state.currentIndex];
        const data = state.wordList[realIndex];
        const isMastered = state.masteredWords.includes(data.Word);

        // 表面の更新
        document.getElementById("word-display").innerText = data.Word;
        document.getElementById("pos-display").innerText = data["品詞"] || "";
        document.getElementById("phonetic-display").innerText = data["発音記号"] || "";
        document.getElementById("complete-badge").style.display = isMastered ? "block" : "none";

        // 裏面の更新
        this.renderBackSide(data, isMastered);
        this.updateUI();
    },

    renderBackSide(data, isMastered) {
        const meanings = [data["意味1"], data["意味2"], data["意味3"]]
            .filter(m => m && m.trim() !== "").join(" / ");
        
        let html = `
            <div style="padding: 20px; text-align: center;">
                <h2 style="color: #007bff; margin-bottom: 10px;">${meanings}</h2>
                <div style="text-align: left; font-size: 0.85em; border-top: 1px solid #eee; margin-top: 10px; padding-top: 10px;">
        `;
        if (data["別の品詞"]) html += `<div style="background:#f8f9fa; padding:5px; margin-bottom:8px;"><strong>【別の品詞】</strong><br>${data["別の品詞"]}: ${data["意味"] || ""}</div>`;
        if (data["派生語1"]) html += `<div style="margin-bottom:5px;"><strong>【派生語1】</strong><br>${data["派生語1"]} [${data["品詞1"] || ""}]<br>${data["意味1.1"] || ""}</div>`;
        if (data["派生語2"]) html += `<div><strong>【派生語2】</strong><br>${data["派生語2"]} [${data["品詞2"] || ""}]<br>${data["意味2.1"] || ""}</div>`;

        html += `
                </div>
                <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                    <label style="font-size: 1.2em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <input type="checkbox" style="width: 22px; height: 22px;" 
                        ${isMastered ? 'checked' : ''} onchange="app.toggleMastered(event, '${data.Word}')">
                        <span>覚えた！</span>
                    </label>
                </div>
            </div>
        `;
        document.getElementById("card-back-contents").innerHTML = html;
    },

    async toggleMastered(event, word) {
        event.stopPropagation();
        if (event.target.checked) {
            if (!state.masteredWords.includes(word)) state.masteredWords.push(word);
            this.showToast("習得済みに追加");
        } else {
            state.masteredWords = state.masteredWords.filter(w => w !== word);
        }
        document.getElementById("complete-badge").style.display = event.target.checked ? "block" : "none";
        this.updateUI();

        try {
            if (window.fb) {
                const { db, doc, setDoc } = window.fb;
                const docRef = doc(db, "progress", state.studentName, "units", state.currentUnit);
                await setDoc(docRef, { masteredWords: state.masteredWords }, { merge: true });
            }
        } catch (e) { console.error("Firebase Error", e); }
    },

    // 【重要：修正】次のカードへ行く前に、必ずカードを表面に戻す
    nextCard() {
        const card = document.getElementById('card');
        const isFlipped = card.classList.contains('is-flipped');

        const moveNext = () => {
            if (state.currentIndex < state.displayIndices.length - 1) {
                state.currentIndex++;
                this.updateCardContent();
            } else {
                if(confirm("最後まで到達しました。もう一度学習しますか？")) {
                    this.prepareIndices();
                    state.currentIndex = 0;
                    this.updateCardContent();
                    this.showToast("最初から再開します");
                } else {
                    this.showScreen('setup-screen');
                }
            }
        };

        if (isFlipped) {
            // 裏側だったら、まず表面に戻してから（アニメーション待ち：0.2秒）データを書き換える
            card.classList.remove('is-flipped');
            setTimeout(moveNext, 200); 
        } else {
            // 表側だったらそのまま書き換える
            moveNext();
        }
    },

    prevCard() {
        const card = document.getElementById('card');
        const isFlipped = card.classList.contains('is-flipped');

        const movePrev = () => {
            if (state.currentIndex > 0) {
                state.currentIndex--;
                this.updateCardContent();
            }
        };

        if (isFlipped) {
            card.classList.remove('is-flipped');
            setTimeout(movePrev, 200);
        } else {
            movePrev();
        }
    },

    updateUI() {
        const totalInUnit = state.wordList.length;
        const masteredInUnit = state.masteredWords.length;
        const progressPercent = (masteredInUnit / totalInUnit) * 100;
        const currentPos = state.currentIndex + 1;
        const displayTotal = state.displayIndices.length;

        document.getElementById('progress-text').innerText = 
            `習得: ${Math.round(progressPercent)}% (${masteredInUnit}/${totalInUnit}) | カード: ${currentPos}/${displayTotal}`;
        
        const bar = document.getElementById('progress-bar');
        if(bar) {
            bar.style.width = `${progressPercent}%`;
            bar.style.backgroundColor = progressPercent === 100 ? "#4caf50" : "#007bff";
        }
    },

    playAudio(event) {
        if (event) event.stopPropagation();
        const word = document.getElementById('word-display').innerText;
        if (!word) return;
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(word);
        ut.lang = 'en-US';
        ut.rate = 0.9;
        window.speechSynthesis.speak(ut);
    },

    showError(msg) {
        const err = document.getElementById('error-message');
        if(err) {
            err.innerText = msg;
            err.style.display = 'block';
        }
    }
};

window.app = app;

window.addEventListener('load', () => {
    let retry = 0;
    const check = () => {
        if (typeof allUnits !== 'undefined') {
            app.init();
        } else if (retry < 50) {
            retry++;
            setTimeout(check, 100);
        } else {
            app.init();
        }
    };
    check();
});