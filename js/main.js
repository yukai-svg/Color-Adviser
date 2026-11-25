const API_BASE_URL =
    "https://glorious-space-memory-wv7qwqxvvx77hq66-8000.app.github.dev";

// 画面要素の取得
const uploadBoxEl = document.querySelector(".upload-box");
const uploadBtnEl = document.getElementById("uploadBtn");
const imageUploadEl = document.getElementById("imageUpload");

const uploadContentEl = document.getElementById("uploadContent");
const loadingContentEl = document.querySelector(".loading-content");
const paletteContentEl = document.querySelector(".palette-content");
const coloringContentEl = document.querySelector(".coloring-content");
const coloredResultContentEl = document.querySelector(".colored-result-content");

const colorPreviewEl = document.getElementById("colorPreview");
const colorCodeEl = document.getElementById("colorCode");
const mainColorInputEl = document.getElementById("mainColor");
const clearColorBtnEl = document.getElementById("clearColor");
const themeInputEl = document.querySelector('.form-row input[type="text"]:not(#colorCode)');

const decideBtnEl = document.querySelector(".decide-btn");
const generateBtnEl = document.querySelector(".generate-btn");
generateBtnEl.disabled = true;

const paletteBtnsEl = document.querySelectorAll(".palette-btn");

// 状態管理変数
let selectedFile = null;
let beforeImageDataUrl = null;
let generatedPalettes = null;
let selectedPaletteColors = null;



// タイムアウト付きfetchヘルパー（js/main.js の上部に追加）
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (err.name === "AbortError") {
            throw new Error("サーバーの応答がタイムアウトしました。時間をおいて再度お試しください。");
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}


// 表示エリアの切り替えヘルパー
function showOnlySection(targetSection) {
    // 親の .upload-box が画像選択時に非表示になっている場合は再表示する
    if (uploadBoxEl && targetSection !== uploadContentEl) {
        uploadBoxEl.style.display = "block";
    }
    [uploadContentEl, loadingContentEl, paletteContentEl, coloringContentEl, coloredResultContentEl].forEach((el) => {
        if (el) el.style.display = "none";
    });
    if (targetSection) targetSection.style.display = "block";
}

// 初期表示をアップロード画面に固定
showOnlySection(uploadContentEl);

// --------------------------------------------------
// 1. カラーピッカー操作
// --------------------------------------------------
function updateSelectedColor(hex) {
    const upperHex = hex.toUpperCase();
    if (colorCodeEl) colorCodeEl.value = upperHex;
    if (colorPreviewEl) colorPreviewEl.style.backgroundColor = upperHex;
}

if (colorCodeEl) colorCodeEl.value = "";
if (colorPreviewEl) colorPreviewEl.style.backgroundColor = "transparent";
if (mainColorInputEl) mainColorInputEl.value = "#FFFFFF";

// プレビュー枠またはテキスト欄クリックでカラーピッカーを開く
[colorPreviewEl, colorCodeEl].forEach((el) => {
    if (el && mainColorInputEl) {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
            mainColorInputEl.click();
        });
    }
});

// カラーピッカーで色を選んだときにプレビューとコード欄へ反映する
if (mainColorInputEl) {
    mainColorInputEl.addEventListener("input", (e) => {
        updateSelectedColor(e.target.value);
    });
}

if (clearColorBtnEl && mainColorInputEl && colorCodeEl && colorPreviewEl) {
    clearColorBtnEl.addEventListener("click", () => {
        colorCodeEl.value = "";
        colorCodeEl.placeholder = "#FFFFFF";
        colorPreviewEl.style.backgroundColor = "transparent";
        mainColorInputEl.value = "#FFFFFF";
    });

}

// --------------------------------------------------
// 2. 画像アップロード（クリック＆ドラッグ＆ドロップ）
// --------------------------------------------------
function handleFileSelected(file) {

    if (!file) return;

    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
        beforeImageDataUrl = ev.target.result;

        if (uploadBoxEl) {
            uploadBoxEl.style.display = "none";
        }

        let imageArea = document.querySelector(".selected-image-area");
        if (!imageArea) {
            imageArea = document.createElement("div");
            imageArea.className = "selected-image-area";
            document.querySelector(".tool-section").insertBefore(
    imageArea,
    paletteContentEl
);
        }

        imageArea.innerHTML = `
            <div class="image-menu">⋮</div>
            <img src="${beforeImageDataUrl}" class="uploaded-image">
        `;
    };
    reader.readAsDataURL(file);
}

document.addEventListener("click", (e) => {
    if (e.target.classList.contains("image-menu") && imageUploadEl) {
        imageUploadEl.click();
    }
});

if (uploadBtnEl && imageUploadEl) {
    uploadBtnEl.addEventListener("click", () => {
        imageUploadEl.click();
    });
}

if (imageUploadEl) {
    imageUploadEl.addEventListener("change", (e) => {
        handleFileSelected(e.target.files[0]);
    });
}

if (uploadBoxEl) {
    uploadBoxEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadBoxEl.style.borderColor = "#4F46E5";
    });
    uploadBoxEl.addEventListener("dragleave", () => {
        uploadBoxEl.style.borderColor = "";
    });
    uploadBoxEl.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadBoxEl.style.borderColor = "";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    });
}

// --------------------------------------------------
// 3. 「確定」ボタン押下 → パレット計算API呼び出し (POST /api/palette)
// --------------------------------------------------
if (decideBtnEl) {
    decideBtnEl.addEventListener("click", async () => {
        const mainColor = (colorCodeEl && colorCodeEl.value) ? colorCodeEl.value : "#FF130A";
const imageArea =
    document.querySelector(
        ".selected-image-area"
    );

if (imageArea) {

    imageArea.style.display =
        "none";

}

generateBtnEl.disabled = true;

generateBtnEl.textContent =
    "パレット生成中...";

showOnlySection(
    loadingContentEl
);
    
  
        try {
            const formData = new FormData();
            formData.append("main_color", mainColor);
            if (selectedFile) {
                formData.append("image", selectedFile);
            }

            const response = await fetch(`${API_BASE_URL}/api/palette`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "パレット生成に失敗しました");
            }

            const data = await response.json();
            generatedPalettes = data.palettes;

            if (data.processed_image) {
                beforeImageDataUrl = data.processed_image;
                const uploadedImgEl = document.querySelector(".uploaded-image");
                if (uploadedImgEl) {
                    uploadedImgEl.src = data.processed_image;
                }
            }

            // 最初の3つのパレットボタンに色を反映（0:補色, 1:類似色, 2:三色配色）
            const paletteKeys = ["complementary", "analogous", "triadic"];
            paletteBtnsEl.forEach((btn, idx) => {
                if (idx < 3) {
                    const key = paletteKeys[idx];
                    const colors = generatedPalettes[key] || [];
                    const boxes = btn.querySelectorAll(".color-box");
                    boxes.forEach((box, cIdx) => {
                        if (colors[cIdx]) {
                            box.style.backgroundColor = colors[cIdx];
                            box.title = colors[cIdx];
                        }
                    });
                    btn.dataset.paletteKey = key;
                } else {
                    // 4つ目：AIおまかせモード
                    btn.dataset.paletteKey = "ai_auto";
                }
            });

            // デフォルトで1つ目（補色パレット）を選択状態にする
        // デフォルトで1つ目（補色パレット）を選択状態にする
selectPaletteButton(0);

/* ローディング非表示 */
loadingContentEl.style.display =
    "none";

/* 画像再表示 */
if (imageArea) {

    imageArea.style.display =
        "block";

}
uploadBoxEl.style.display =
    "none";
/* パレット表示 */
paletteContentEl.style.display =
    "block";

/* 色を塗るボタン有効化 */
generateBtnEl.disabled =
    false;

generateBtnEl.textContent =
    "🎨 色を塗る";

        } catch (err) {
            alert(`エラー: ${err.message}`);
            if (selectedFile && uploadBoxEl) {
                uploadBoxEl.style.display = "none";
            } else {
                showOnlySection(uploadContentEl);
            }
        }
    });
}

// --------------------------------------------------
// 4. パレットボタンの選択処理（4つ目は「メインカラーのみ＋AIおまかせ」）
// --------------------------------------------------
function selectPaletteButton(index) {
    const paletteKeys = ["complementary", "analogous", "triadic", "ai_auto"];
    paletteBtnsEl.forEach((btn, idx) => {
        if (idx === index) {
            btn.style.outline = "3px solid #4F46E5";
            btn.style.backgroundColor = "#EEF2FF";
        } else {
            btn.style.outline = "none";
            btn.style.backgroundColor = "";
        }
    });

    const key = paletteKeys[index];
    if (key === "ai_auto") {
        // メインカラー1色だけを渡す（残りはバックエンドのAIがテーマから自動決定）
        const currentMain = (colorCodeEl && colorCodeEl.value) ? colorCodeEl.value : "#FF130A";
        selectedPaletteColors = [currentMain];
    } else if (generatedPalettes) {
        selectedPaletteColors = generatedPalettes[key];
    }
}

paletteBtnsEl.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
        selectPaletteButton(idx);
    });
});

// --------------------------------------------------
// 5. 「🎨 色を塗る」ボタン押下 → 解説＆彩色API呼び出し (POST /api/colorize)
// --------------------------------------------------
if (generateBtnEl) {
    generateBtnEl.addEventListener("click", async () => {
        if (!selectedFile) {
            alert("先に線画画像をアップロードしてください。");
            return;
        }

        // パレット未選択の場合でも、メインカラーが入っていれば「メインカラーのみ（AIおまかせ）」として自動進行
        let colorsToSend = selectedPaletteColors;
        if (!colorsToSend) {
            const currentMain = (colorCodeEl && colorCodeEl.value) ? colorCodeEl.value : null;
            if (!currentMain) {
                alert("先にメインカラーを選んでください。");
                return;
            }
            colorsToSend = [currentMain];
        }

        const themeText = themeInputEl ? themeInputEl.value.trim() : "";
        uploadBoxEl.style.display =
    "flex";
const imageArea =
    document.querySelector(
        ".selected-image-area"
    );

if (imageArea) {

    imageArea.style.display =
        "none";

}

paletteContentEl.style.display =
    "none";

document.querySelector(
    ".form-row"
).style.display =
    "none";

document.querySelector(
    ".generate-wrap"
).style.display =
    "none";
        showOnlySection(coloringContentEl);

        try {
            const formData = new FormData();
            formData.append("image", selectedFile);
            formData.append("colors", JSON.stringify(colorsToSend));
            formData.append("theme", themeText);

            const response = await fetch(`${API_BASE_URL}/api/colorize`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "彩色処理に失敗しました");
            }

            const data = await response.json();

            const beforeBox = coloredResultContentEl.querySelector(".before-image .image-box");
            const afterBox = coloredResultContentEl.querySelector(".after-image .image-box");

            if (beforeBox) {
                beforeBox.innerHTML = `<img src="${beforeImageDataUrl}" alt="着色前" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
            }
            if (afterBox) {
                afterBox.innerHTML = `<img src="${data.colored_image}" alt="着色後" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
            }

            // 使用パレットの表示（1色のみの場合は1枠だけ色を表示し、残りは隠す）
            const usedBoxes = coloredResultContentEl.querySelectorAll(".selected-palette .color-box");
            usedBoxes.forEach((box, idx) => {
                if (data.used_colors[idx]) {
                    box.style.display = "inline-block";
                    box.style.backgroundColor = data.used_colors[idx];
                    box.title = data.used_colors[idx];
                } else {
                    box.style.display = "none";
                }
            });

            const explanationEl = document.getElementById("aiExplanation");
            if (explanationEl) {
                explanationEl.textContent = data.explanation;
            }

            showOnlySection(coloredResultContentEl);
        } catch (err) {
            alert(`エラー: ${err.message}`);
            showOnlySection(paletteContentEl);
        }
    });
}

// --------------------------------------------------
// 6. ページトップへ戻るボタン
// --------------------------------------------------
const topBtnEl = document.getElementById("topBtn");
if (topBtnEl) {
    topBtnEl.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}
const privacyModal =
    document.getElementById("privacyModal");

const termsModal =
    document.getElementById("termsModal");

/* プライバシー */
document
    .getElementById("privacyLink")
    .addEventListener("click", (e) => {

        e.preventDefault();

        privacyModal.style.display =
            "flex";

    });

/* 利用規約 */
document
    .getElementById("termsLink")
    .addEventListener("click", (e) => {

        e.preventDefault();

        termsModal.style.display =
            "flex";

    });

/* プライバシー閉じる */
document
    .getElementById("closePrivacy")
    .addEventListener("click", () => {

        privacyModal.style.display =
            "none";

    });

/* 利用規約閉じる */
document
    .getElementById("closeTerms")
    .addEventListener("click", () => {

        termsModal.style.display =
            "none";

    });

/* モーダル外クリック */
window.addEventListener(
    "click",
    (e) => {

        if (e.target === privacyModal) {

            privacyModal.style.display =
                "none";

        }

        if (e.target === termsModal) {

            termsModal.style.display =
                "none";

        }

    }
);