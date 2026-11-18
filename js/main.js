{
    const API_BASE_URL = "http://127.0.0.1:8000";

    // 画面要素の取得
    const uploadBoxEl = document.querySelector(".upload-box");
    const uploadBtnEl = document.getElementById("uploadBtn");
    const imageUploadEl = document.getElementById("imageUpload");
    const previewImageEl = document.getElementById("previewImage");

    const uploadContentEl = document.querySelector(".upload-content");
    const loadingContentEl = document.querySelector(".loading-content");
    const paletteContentEl = document.querySelector(".palette-content");
    const coloringContentEl = document.querySelector(".coloring-content");
    const coloredResultContentEl = document.querySelector(".colored-result-content");
const uploadContent =
    document.getElementById("uploadContent");

const decideBtn =
    document.querySelector(".decide-btn");

uploadBtn.addEventListener("click", () => {

    const colorPreviewEl = document.getElementById("colorPreview");
    const colorCodeEl = document.getElementById("colorCode");
    const mainColorInputEl = document.getElementById("mainColor");
    const clearColorBtnEl = document.getElementById("clearColor");
    const themeInputEl = document.querySelector('.form-row input[type="text"]:not(#colorCode)');

    const decideBtnEl = document.querySelector(".decide-btn");
    const generateBtnEl = document.querySelector(".generate-btn");
    const paletteBtnsEl = document.querySelectorAll(".palette-btn");

    // 状態管理変数
    let selectedFile = null;
    let beforeImageDataUrl = null;
    let generatedPalettes = null;
    let selectedPaletteColors = null;

    // 表示エリアの切り替えヘルパー
    function showOnlySection(targetSection) {
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
        if (colorPreviewEl) {
            colorPreviewEl.style.backgroundColor = upperHex;
        }
    }
});

    // 初期カラーセット
    updateSelectedColor("#FF130A");

    if (colorPreviewEl && mainColorInputEl) {
        colorPreviewEl.style.cursor = "pointer";
        colorPreviewEl.addEventListener("click", () => mainColorInputEl.click());
    }
    if (colorCodeEl && mainColorInputEl) {
        colorCodeEl.style.cursor = "pointer";
        colorCodeEl.addEventListener("click", () => mainColorInputEl.click());
    }
    if (mainColorInputEl) {
        mainColorInputEl.addEventListener("input", (e) => {
            updateSelectedColor(e.target.value);
        });
    }
    if (clearColorBtnEl && mainColorInputEl) {
        clearColorBtnEl.addEventListener("click", () => {
            mainColorInputEl.value = "#FFFFFF";
            updateSelectedColor("#FFFFFF");
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
            if (previewImageEl) {
                previewImageEl.src = beforeImageDataUrl;
                previewImageEl.style.display = "block";
            }
            if (uploadBtnEl) {
                uploadBtnEl.textContent = `選択済み: ${file.name}`;
            }
        };
        reader.readAsDataURL(file);
    }

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

            showOnlySection(loadingContentEl);

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

                // 透過画像だった場合、バックエンドで白背景合成された画像をプレビューに反映
                if (data.processed_image && previewImageEl) {
                    beforeImageDataUrl = data.processed_image;
                    previewImageEl.src = data.processed_image;
                    previewImageEl.style.display = "block";
                }
    document.querySelector(".upload-box")
        .style.display = "none";

    let imageArea =
        document.querySelector(".selected-image-area");

    if (!imageArea) {

        imageArea =
            document.createElement("div");

        imageArea.className =
            "selected-image-area";

        document.querySelector(".tool-section")
            .insertBefore(
                imageArea,
                document.querySelector(".form-row")
            );

    }

   imageArea.innerHTML = `
    <div class="image-menu">
        ⋮
    </div>

    <img
        src="${imageUrl}"
        class="uploaded-image">
`;


});
document.addEventListener("click", (e) => {

    if (
        e.target.classList.contains(
            "image-menu"
        )
    ) {

        imageUpload.click();

    }

                // 3つのパレットボタンに色を反映（0:補色, 1:類似色, 2:三色配色）
                const paletteKeys = ["complementary", "analogous", "triadic"];
                paletteBtnsEl.forEach((btn, idx) => {
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
                });

                // デフォルトで1つ目（補色パレット）を選択状態にする
                selectPaletteButton(0);

                showOnlySection(paletteContentEl);
            } catch (err) {
                alert(`エラー: ${err.message}`);
                showOnlySection(uploadContentEl);
            }
        });
    }

    // --------------------------------------------------
    // 4. パレットボタンの選択処理
    // --------------------------------------------------
    function selectPaletteButton(index) {
        const paletteKeys = ["complementary", "analogous", "triadic"];
        paletteBtnsEl.forEach((btn, idx) => {
            if (idx === index) {
                btn.style.outline = "3px solid #4F46E5";
                btn.style.backgroundColor = "#EEF2FF";
            } else {
                btn.style.outline = "none";
                btn.style.backgroundColor = "";
            }
        });

        if (generatedPalettes) {
            const key = paletteKeys[index];
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
            if (!selectedPaletteColors) {
                alert("先にメインカラーを選んで「確定」ボタンを押し、パレットを選択してください。");
                return;
            }

            const themeText = themeInputEl ? themeInputEl.value.trim() : "";

            showOnlySection(coloringContentEl);

            try {
                const formData = new FormData();
                formData.append("image", selectedFile);
                formData.append("colors", JSON.stringify(selectedPaletteColors));
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

                // 着色前・着色後画像の表示
                const beforeBox = coloredResultContentEl.querySelector(".before-image .image-box");
                const afterBox = coloredResultContentEl.querySelector(".after-image .image-box");

                if (beforeBox) {
                    beforeBox.innerHTML = `<img src="${beforeImageDataUrl}" alt="着色前" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                }
                if (afterBox) {
                    afterBox.innerHTML = `<img src="${data.colored_image}" alt="着色後" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                }

                // 使用パレット3色の表示
                const usedBoxes = coloredResultContentEl.querySelectorAll(".selected-palette .color-box");
                usedBoxes.forEach((box, idx) => {
                    if (data.used_colors[idx]) {
                        box.style.backgroundColor = data.used_colors[idx];
                        box.title = data.used_colors[idx];
                    }
                });

                // AI解説文の表示
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
}