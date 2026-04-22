/**
 * フェーズ1：コード整理（stateオブジェクトへの集約版）
 */

const state = {
    studentName: "",
    currentUnit: "",
    wordList: [],
    displayIndices: [],
    currentIndex: 0,
    isRandom: false,
    masteredWords: [],
    activeScreen: ""
};

const app = {
    // --- 初期化 ---
    init() {
        // data.js の読み込みチェック
        if (typeof allUnits === 'undefined') {
            this.showError("data.js が読み込めませんでした。ファイルを確認してください。");
            this.showScreen('setup-screen'); // エラーを表示するためにセットアップ画面へ
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

    // --- 画面遷移管理 ---
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            state.activeScreen = screenId;
        }
        
        if (screenId === 'setup-screen') {
            document.getElementById('display-name').innerText = state.studentName;
        }
    },

    // --- ログイン・ログアウト ---
    login() {
        const input = document.getElementById('name-input').value.trim();
        if (!input) {
            alert("名前を入力してください");
            return;
        }
        state.studentName = input;
        localStorage.setItem('studentName', input);
        this.showScreen('setup-screen');
        this.renderUnitList();
    },

    logout() {
        localStorage.removeItem('studentName');
        document.getElementById('name-input').value = "";
        this.showScreen('login-screen');
    },

    // --- Unitリスト生成 ---
    renderUnitList() {
        const list = document.getElementById('unit-list');
        list.innerHTML = "";
        Object.keys(allUnits).forEach(unit => {
            const btn = document.createElement('button');
            btn.className = "unit-btn";
            btn.innerText = unit;
            btn.onclick = () => this.startLearning(unit);
            list.appendChild(btn);
        });
    },

    // --- 学習開始 ---
    async startLearning(unitName) {
        state.currentUnit = unitName;
        state.wordList = allUnits[unitName];
        state.currentIndex = 0;

        // Firebaseから進捗取得
        try {
            const { db, doc, getDoc } = window.fb;
            const docRef = doc(db, "progress", state.studentName, "units", unitName);
            const docSnap = await getDoc(docRef);
            state.masteredWords = docSnap.exists() ? (docSnap.data().masteredWords || []) : [];
        } catch (e) {
            console.error("Firebase取得失敗:", e);
            state.masteredWords = [];
        }

        this.prepareIndices();
        this.showScreen('learning-screen');
        this.showCard();
    },

    // --- 表示順序の準備 ---
    prepareIndices() {
        state.displayIndices = state.wordList.map((_, i) => i);
        if (state.isRandom) {
            state.displayIndices.sort(() => Math.random() - 0.5);
        }
    },

    setOrder(random) {
        state.isRandom = random;
        document.getElementById('btn-order').classList.toggle('selected', !random);
        document.getElementById('btn-random').classList.toggle('selected', random);
    },

    // --- カード表示 ---
    showCard() {
        const realIndex = state.displayIndices[state.currentIndex];
        const data = state.wordList[realIndex];
        const isMastered = state.masteredWords.includes(data.Word);

        // カードを表面に戻す
        document.getElementById('card').classList.remove('is-flipped');

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
                        <input type="checkbox" style="width: 20px; height: 20px;" 
                        ${isMastered ? 'checked' : ''} onchange="app.toggleMastered(event, '${data.Word}')">
                        <span>覚えた！</span>
                    </label>
                </div>
            </div>
        `;
        document.getElementById("card-back-contents").innerHTML = html;
    },

    // --- 習得保存 ---
    async toggleMastered(event, word) {
        event.stopPropagation();
        if (event.target.checked) {
            if (!state.masteredWords.includes(word)) state.masteredWords.push(word);
        } else {
            state.masteredWords = state.masteredWords.filter(w => w !== word);
        }
        document.getElementById("complete-badge").style.display = event.target.checked ? "block" : "none";

        const { db, doc, setDoc } = window.fb;
        const docRef = doc(db, "progress", state.studentName, "units", state.currentUnit);
        try {
            await setDoc(docRef, { masteredWords: state.masteredWords }, { merge: true });
        } catch (e) { console.error("保存失敗", e); }
    },

    // --- ナビゲーション ---
    nextCard() {
        if (state.currentIndex < state.displayIndices.length - 1) {
            state.currentIndex++;
            this.showCard();
        } else {
            // 指導事項7: alertをUI表示にしたいが、一旦はシンプルなメッセージ
            if(confirm("最後まで到達しました。もう一度学習しますか？")) {
                state.currentIndex = 0;
                if(state.isRandom) this.prepareIndices();
                this.showCard();
            } else {
                this.showScreen('setup-screen');
            }
        }
    },

    prevCard() {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            this.showCard();
        }
    },

    updateUI() {
        const total = state.wordList.length;
        const current = state.currentIndex + 1;
        document.getElementById('progress-text').innerText = `${current} / ${total}`;
        document.getElementById('progress-bar').style.width = `${(current / total) * 100}%`;
    },

    // --- 音声再生 ---
    playAudio(event) {
        if (event) event.stopPropagation();
        const word = document.getElementById('word-display').innerText;
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(word);
        ut.lang = 'en-US';
        ut.rate = 0.9;
        window.speechSynthesis.speak(ut);
    },

    showError(msg) {
        const err = document.getElementById('error-message');
        err.innerText = msg;
        err.style.display = 'block';
    }
};

// 初期化実行
window.onload = () => app.init();
// グローバルにappを公開（HTMLのonclick属性から呼ぶため）
window.app = app; // HTMLからapp.login()などを呼べるようにする

window.addEventListener('load', () => {
    // データの読み込み待ちを考慮して100ms遅らせて起動
    setTimeout(() => {
        app.init();
    }, 100);
});