
const savedTheme =
    localStorage.getItem("theme");

if (savedTheme === "dark") {

    document.body.classList.add(
        "dark-mode"
    );

}

const root = document.documentElement;

/* 保存済みサイズ適用 */

const savedSize =
    localStorage.getItem("fontSize");

if (savedSize) {

    root.style.fontSize = savedSize;

}

/* ボタン取得 */

const smallBtn =
    document.getElementById("font-small");

const mediumBtn =
    document.getElementById("font-medium");

const largeBtn =
    document.getElementById("font-large");

/* ボタンが存在するときだけ */

if (
    smallBtn &&
    mediumBtn &&
    largeBtn
) {

    smallBtn.addEventListener("click", () => {

        root.style.fontSize = "14px";

        localStorage.setItem(
            "fontSize",
            "14px"
        );

    });

    mediumBtn.addEventListener("click", () => {

        root.style.fontSize = "18px";

        localStorage.setItem(
            "fontSize",
            "18px"
        );

    });

    largeBtn.addEventListener("click", () => {

        root.style.fontSize = "22px";

        localStorage.setItem(
            "fontSize",
            "22px"
        );

    });

}
/* ===== ボタン状態復元 ===== */

if (
    smallBtn &&
    mediumBtn &&
    largeBtn
) {

    smallBtn.classList.remove("active");
    mediumBtn.classList.remove("active");
    largeBtn.classList.remove("active");

    if (savedSize === "14px") {

        smallBtn.classList.add("active");

    } else if (savedSize === "22px") {

        largeBtn.classList.add("active");

    } else {

        mediumBtn.classList.add("active");

    }

}
const colorCode =
    document.getElementById("colorCode");

const colorPicker =
    document.getElementById("mainColor");
    const colorPreview =
    document.getElementById("colorPreview");

/* テキストボックスクリック */

colorCode.addEventListener("click", () => {

    colorPicker.click();

});
colorPreview.addEventListener("click", () => {

    colorPicker.click();

});
/* 色選択 */
colorPicker.addEventListener("input", () => {

    const color =
        colorPicker.value.toUpperCase();

    colorCode.value = color;

    colorPreview.style.backgroundColor =
        color;

});

/* 色を消す */
const clearColor =
    document.getElementById("clearColor");
clearColor.addEventListener("click", () => {

    colorCode.value = "";

    colorCode.placeholder = "#FFFFFF";

    colorPicker.value = "#ffffff";

    colorPreview.style.backgroundColor =
    "transparent";

});
