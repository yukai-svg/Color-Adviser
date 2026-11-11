
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
