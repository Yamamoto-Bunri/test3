/**
 * 英単語学習システム Ver3.2 (フェーズ3対応版)
 */

const state = {
    studentName: "",
    currentUnit: "",
    wordList: [],
    displayIndices: [],
    currentIndex: 0,
    isRandom: false,
    isOnlyUnlearned: false, // 未習得のみフィルタ
    masteredWords: [],
    activeScreen: ""
};

const app = {
    // --- 初期化 ---
    init() {
        if (typeof allUnits === 'undefined') {
            this.showError("data.js が読み込めませんでした。ファイルを確認してください。");
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
            const err = document.getElementById('error-message');
            if (typeof allUnits !== 'undefined' && err) err.style.display = 'none';
        }
    },

    // --- 設定変更（表示順・フィルタ） ---
    setOrder(random) {
        state.isRandom = random;
        document.getElementById('btn-order').classList.toggle('selected', !random);
        document.getElementById('btn-random').classList.toggle('selected', random);
    },

    toggleFilterMode(onlyUnlearned) {
        state.isOnlyUnlearned = onlyUnlearned;
        document.getElementById('btn-filter-all').classList.toggle('selected', !onlyUnlearned);
        document.getElementById('btn-filter-unlearned').classList.toggle('selected', onlyUnlearned);
        
        // 学習中であれば、リストを再構成して最初に戻る
        if (state.activeScreen === 'learning-screen') {
            this.prepareIndices();
            state.currentIndex = 0;
            if (state.displayIndices.length > 0) {
                this.showCard();
            } else {
                alert("表示できる単語がありません。設定を戻します。");
                this.toggleFilterMode(false);
            }
        }
    },

    // --- ログイン・ログアウト ---
    login() {
        const input = document.getElementById('name-input').value.trim();
        if (!input) { alert("名前を入力してください"); return; }
        state.studentName = input;
        localStorage.setItem('studentName', input);
        this.showScreen('setup-screen');
        this.renderUnitList();
    },

    logout() {
        if(confirm("ログアウトしますか？")) {
            localStorage.removeItem('studentName');
            this.showScreen('login-screen');
        }
    },

    // --- Unitリスト生成 ---
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

    // --- 学習開始 ---
    async startLearning(unitName) {
        state.currentUnit = unitName;
        state.wordList = allUnits[unitName];
        state.currentIndex = 0;

        // Firebaseから進捗取得
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
        
        if (state.displayIndices.length === 0) {
            alert("このユニットには未習得の単語がありません！");
            return;
        }

        this.showScreen('learning-screen');
        this.showCard();
    },

    // --- 表示順序とフィルタの準備 ---
    prepareIndices() {
        // すべてのインデックス
        let indices = state.wordList.map((_, i) => i);

        // 未習得のみフィルタがONの場合
        if (state.isOnlyUnlearned) {
            indices = indices.filter(i => !state.masteredWords.includes(state.wordList[i].Word));
        }

        // ランダム設定があればシャッフル
        if (state.isRandom) {
            indices.sort(() => Math.random() - 0.5);
        }

        state.displayIndices = indices;
    },

    // --- カード表示 ---
    showCard() {
        if (state.displayIndices.length === 0) return;
        
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
                        <input type="checkbox" style="width: 22px; height: 22px;" 
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
        
        this.updateUI(); // 習得率を即座に更新

        try {
            if (window.fb) {
                const { db, doc, setDoc } = window.fb;
                const docRef = doc(db, "progress", state.studentName, "units", state.currentUnit);
                await setDoc(docRef, { masteredWords: state.masteredWords }, { merge: true });
            }
        } catch (e) { console.error("Firebase保存失敗:", e); }
    },

    // --- ナビゲーション ---
    nextCard() {
        if (state.currentIndex < state.displayIndices.length - 1) {
            state.currentIndex++;
            this.showCard();
        } else {
            if(confirm("最後まで到達しました。もう一度学習しますか？")) {
                this.prepareIndices(); // フィルタ条件で再構成
                state.currentIndex = 0;
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

    // --- UI更新（習得率の視覚化） ---
    updateUI() {
        const totalInUnit = state.wordList.length;
        const masteredInUnit = state.masteredWords.length;
        const progressPercent = (masteredInUnit / totalInUnit) * 100;

        // 習得状況をテキストで表示
        const currentPos = state.currentIndex + 1;
        const displayTotal = state.displayIndices.length;
        document.getElementById('progress-text').innerText = 
            `Unit習得率: ${Math.round(progressPercent)}% (${masteredInUnit}/${totalInUnit}) | 表示中: ${currentPos}/${displayTotal}`;
        
        // プログレスバーの更新（習得率を表示）
        const bar = document.getElementById('progress-bar');
        if(bar) {
            bar.style.width = `${progressPercent}%`;
            // 完了したら色を変える
            bar.style.backgroundColor = progressPercent === 100 ? "#4caf50" : "#007bff";
        }
    },

    // --- 音声再生 ---
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

// 通信遅延（data.js読み込み）を考慮した初期化
window.addEventListener('load', () => {
    let retry = 0;
    const check = () => {
        if (typeof allUnits !== 'undefined') {
            app.init();
        } else if (retry < 50) {
            retry++;
            setTimeout(check, 100);
        } else {
            app.init(); // 5秒待ってダメならエラー表示へ
        }
    };
    check();
});