const root = document.documentElement;

/* ===== 文字サイズ変更 ===== */

const smallBtn =
    document.getElementById("font-small");

const mediumBtn =
    document.getElementById("font-medium");

const largeBtn =
    document.getElementById("font-large");

smallBtn.addEventListener("click", () => {

    root.style.fontSize = "14px";

    localStorage.setItem(
        "fontSize",
        "14px"
    );

    setFontActive(smallBtn);
});

mediumBtn.addEventListener("click", () => {

    root.style.fontSize = "18px";

    localStorage.setItem(
        "fontSize",
        "18px"
    );

    setFontActive(mediumBtn);
});

largeBtn.addEventListener("click", () => {

    root.style.fontSize = "22px";

    localStorage.setItem(
        "fontSize",
        "22px"
    );

    setFontActive(largeBtn);
});

/* ===== 保存された文字サイズ復元 ===== */

const savedSize =
    localStorage.getItem("fontSize");

if (savedSize) {
    root.style.fontSize = savedSize;
}

/* ===== active復元 ===== */

function setFontActive(button) {

    smallBtn.classList.remove("active");
    mediumBtn.classList.remove("active");
    largeBtn.classList.remove("active");

    button.classList.add("active");
}

if (savedSize === "14px") {

    setFontActive(smallBtn);

} else if (savedSize === "22px") {

    setFontActive(largeBtn);

} else {

    setFontActive(mediumBtn);

}

/* ===== カラーテーマ切替表示 ===== */

const themeButtons =
document.querySelectorAll(
    ".theme-group button"
);

themeButtons.forEach(button => {

    button.addEventListener("click", () => {

        themeButtons.forEach(b =>
            b.classList.remove("active")
        );

        button.classList.add("active");

    });

});
const lightBtn =
    document.getElementById("light-theme");

const darkBtn =
    document.getElementById("dark-theme");
    lightBtn.addEventListener("click", () => {

    document.body.classList.remove(
        "dark-mode"
    );

    lightBtn.classList.add("active");
    darkBtn.classList.remove("active");

    localStorage.setItem(
        "theme",
        "light"
    );

});
darkBtn.addEventListener("click", () => {

    document.body.classList.add(
        "dark-mode"
    );

    darkBtn.classList.add("active");
    lightBtn.classList.remove("active");

    localStorage.setItem(
        "theme",
        "dark"
    );

});
const savedTheme =
    localStorage.getItem("theme");
    if (savedTheme === "dark") {

    document.body.classList.add(
        "dark-mode"
    );

    darkBtn.classList.add("active");
    lightBtn.classList.remove("active");

}
