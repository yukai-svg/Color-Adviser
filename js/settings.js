const modal =
    document.getElementById("passwordModal");

document
    .getElementById("openModal")
    .addEventListener("click", () => {

        modal.style.display = "flex";

    });

document
    .querySelector(".cancel-btn")
    .addEventListener("click", () => {

        modal.style.display = "none";

    });
const root = document.documentElement;

/* ===== 文字サイズ ===== */

const smallBtn =
    document.getElementById("font-small");

const mediumBtn =
    document.getElementById("font-medium");

const largeBtn =
    document.getElementById("font-large");

function setFontActive(button) {

    smallBtn.classList.remove("active");
    mediumBtn.classList.remove("active");
    largeBtn.classList.remove("active");

    button.classList.add("active");
}

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

const savedSize =
    localStorage.getItem("fontSize");

if (savedSize === "14px") {

    setFontActive(smallBtn);

} else if (savedSize === "22px") {

    setFontActive(largeBtn);

} else {

    setFontActive(mediumBtn);

}

/* ===== ダークモード ===== */

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

} else {

    lightBtn.classList.add("active");
    darkBtn.classList.remove("active");

}