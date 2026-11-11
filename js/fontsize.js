const savedTheme =
    localStorage.getItem("theme");

if (savedTheme === "dark") {

    document.body.classList.add(
        "dark-mode"
    );

}

const root = document.documentElement;

const savedSize =
    localStorage.getItem("fontSize");

if (savedSize) {

    root.style.fontSize = savedSize;

}