/**
 * フェーズ1：コード整理（安定・強化版）
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
    init() {
        // データ読み込み失敗時の強力なエラーハンドリング
        if (typeof allUnits === 'undefined') {
            const errorText = `【エラー】単語データが見つかりません。\n\n以下の原因が考えられます：\n1. ファイル名が「data.js」になっていない（Data.jsなど大文字はNG）\n2. index.html と同じフォルダに data.js がアップロードされていない\n3. ブラウザが古いデータを記憶している（Ctrl+F5 で更新してください）\n4. data.js の中のデータ形式が壊れている`;
            
            this.showError(errorText);
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
        if(confirm("名前を削除してログアウトしますか？")) {
            localStorage.removeItem('studentName');
            document.getElementById('name-input').value = "";
            this.showScreen('login-screen');
        }
    },

    renderUnitList() {
        const list = document.getElementById('unit-list');
        if (!list || typeof allUnits === 'undefined') return; // undefinedなら描画しない
        
        list.innerHTML = "";
        Object.keys(allUnits).forEach(unit => {
            const btn = document.createElement('button');
            btn.className = "unit-btn";
            btn.innerText = unit;
            btn.onclick = () => this.startLearning(unit);
            list.appendChild(btn);
        });
    },

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
        } catch (e) {
            console.error("Firebase取得失敗:", e);
            state.masteredWords = [];
        }

        this.prepareIndices();
        this.showScreen('learning-screen');
        this.showCard();
    },

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

    showCard() {
        if (!state.wordList || state.wordList.length === 0) return;
        
        const realIndex = state.displayIndices[state.currentIndex];
        const data = state.wordList[realIndex];
        const isMastered = state.masteredWords.includes(data.Word);

        const cardElement = document.getElementById('card');
        if(cardElement) cardElement.classList.remove('is-flipped');

        document.getElementById("word-display").innerText = data.Word;
        document.getElementById("pos-display").innerText = data["品詞"] || "";
        document.getElementById("phonetic-display").innerText = data["発音記号"] || "";
        document.getElementById("complete-badge").style.display = isMastered ? "block" : "none";

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

    async toggleMastered(event, word) {
        event.stopPropagation();
        if (event.target.checked) {
            if (!state.masteredWords.includes(word)) state.masteredWords.push(word);
        } else {
            state.masteredWords = state.masteredWords.filter(w => w !== word);
        }
        document.getElementById("complete-badge").style.display = event.target.checked ? "block" : "none";

        try {
            if (window.fb) {
                const { db, doc, setDoc } = window.fb;
                const docRef = doc(db, "progress", state.studentName, "units", state.currentUnit);
                await setDoc(docRef, { masteredWords: state.masteredWords }, { merge: true });
            }
        } catch (e) { console.error("Firebase保存失敗:", e); }
    },

    nextCard() {
        if (state.currentIndex < state.displayIndices.length - 1) {
            state.currentIndex++;
            this.showCard();
        } else {
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
        const bar = document.getElementById('progress-bar');
        if(bar) bar.style.width = `${(current / total) * 100}%`;
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

// 待機時間を少し長め（200ms）にとり、全てのスクリプト展開を確実に待つ
window.addEventListener('load', () => {
    setTimeout(() => {
        app.init();
    }, 200);
});